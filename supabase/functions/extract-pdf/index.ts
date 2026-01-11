import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // For images, we can use vision capabilities
    // For PDFs, we'll extract text using AI vision
    const isImage = fileType?.startsWith("image/") || fileUrl?.match(/\.(jpg|jpeg|png|webp)$/i);

    const systemPrompt = `Du bist ein Experte für das Extrahieren von Daten aus Handwerker-Angeboten.
Analysiere das Dokument und extrahiere ALLE Positionen mit folgenden Informationen:
- Positionsnummer
- Beschreibung der Leistung
- Material (falls angegeben)
- Menge
- Einheit (m², Stück, pauschal, etc.)
- Einzelpreis
- Gesamtpreis

Extrahiere auch:
- Handwerker/Firma Name
- Datum
- Angebotssumme

Gib die Daten strukturiert zurück. Achte auf korrekte Zahlenformate (Komma als Dezimaltrennzeichen in deutsche Preisangaben umwandeln zu Punkt).`;

    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt },
    ];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: "Extrahiere alle Positionen und Informationen aus diesem Handwerker-Angebot:" },
          { type: "image_url", image_url: { url: fileUrl } },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Analysiere dieses Dokument und extrahiere alle Angebotspositionen. Dokument-URL: ${fileUrl}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "extract_angebot",
              description: "Extrahiert strukturierte Daten aus einem Handwerker-Angebot",
              parameters: {
                type: "object",
                properties: {
                  handwerker_firma: { type: "string" },
                  handwerker_name: { type: "string" },
                  datum: { type: "string" },
                  angebots_nummer: { type: "string" },
                  positionen: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        position_nummer: { type: "number" },
                        beschreibung: { type: "string" },
                        material: { type: "string" },
                        menge: { type: "number" },
                        einheit: { type: "string" },
                        einzelpreis: { type: "number" },
                        gesamtpreis: { type: "number" },
                      },
                      required: ["beschreibung"],
                    },
                  },
                  gesamtsumme_netto: { type: "number" },
                  mwst: { type: "number" },
                  gesamtsumme_brutto: { type: "number" },
                },
                required: ["positionen"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_angebot" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht. Bitte versuchen Sie es später erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-Kontingent erschöpft." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Failed to extract document");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("No extraction result from AI");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log("Extracted data:", extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Extract PDF error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});