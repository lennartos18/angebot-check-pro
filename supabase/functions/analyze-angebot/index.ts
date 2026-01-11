import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Position {
  beschreibung: string;
  material?: string;
  menge?: number;
  einheit?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
}

interface AnalysisResult {
  positionen: Array<{
    beschreibung: string;
    material?: string;
    menge?: number;
    einheit?: string;
    einzelpreis?: number;
    gesamtpreis?: number;
    status: "green" | "yellow" | "red";
    plausibility_score: number;
    hinweis: string;
    marktpreis_min?: number;
    marktpreis_max?: number;
    marktpreis_durchschnitt?: number;
    abweichung_prozent?: number;
    gewerk_name?: string;
  }>;
  gesamtpreis: number;
  plausibility_score: number;
  analysis_summary: string;
  handwerker_firma?: string;
  titel?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { angebotId, extractedText, extractedPositionen, fileBase64, fileType } = await req.json();
    
    console.log("Received request:", { 
      hasAngebotId: !!angebotId, 
      hasExtractedText: !!extractedText, 
      hasExtractedPositionen: !!extractedPositionen,
      hasFileBase64: !!fileBase64,
      fileType: fileType || "none"
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch market price data for comparison
    const { data: marktpreise } = await supabase
      .from("marktpreise")
      .select("*, gewerke(name)");

    const marktpreisInfo = marktpreise?.map(m => 
      `${m.gewerke?.name}: ${m.position_kategorie} - ${m.material} (${m.einheit}): ${m.preis_min}-${m.preis_max}€, Durchschnitt: ${m.preis_durchschnitt}€`
    ).join("\n") || "";

    // Get gewerke for categorization
    const { data: gewerke } = await supabase.from("gewerke").select("*");
    const gewerkeList = gewerke?.map(g => g.name).join(", ") || "";

    const systemPrompt = `Du bist ein Experte für die Analyse von Handwerker-Angeboten in Deutschland. 
Du prüfst Angebote auf Plausibilität und vergleichst Preise mit Marktdaten.

DEINE AUFGABE:
1. Analysiere jede Position des Angebots
2. Vergleiche mit den Marktpreisen (wenn verfügbar)
3. Bewerte jede Position mit einem Status:
   - "green": Preis ist plausibel und marktüblich
   - "yellow": Preis liegt 15-30% über Durchschnitt, nachfragen empfohlen
   - "red": Preis liegt >30% über Durchschnitt oder ist auffällig
4. Gib konkrete, hilfreiche Hinweise

MARKTPREIS-REFERENZDATEN:
${marktpreisInfo}

VERFÜGBARE GEWERKE: ${gewerkeList}

WICHTIG:
- Sei fair aber kritisch
- Berücksichtige regionale Unterschiede
- Beachte Materialqualität
- Gib praktische Verhandlungstipps`;

    // Build user message content - use Vision for images/PDFs, text otherwise
    let userMessageContent: any;
    
    if (fileBase64 && fileType) {
      console.log("Using Vision mode for document analysis");
      // For images and PDFs, use multimodal Vision capabilities
      const textInstruction = `Analysiere dieses Handwerker-Angebot im Detail. 
Extrahiere ALLE Positionen mit:
- Beschreibung der Leistung
- Material (falls angegeben)
- Menge und Einheit
- Einzelpreis und Gesamtpreis

Wichtig: Lies das Dokument vollständig und extrahiere die echten Daten daraus!
${extractedText ? `Zusätzliche Info: ${extractedText}` : ""}`;
      
      userMessageContent = [
        { type: "text", text: textInstruction },
        { type: "image_url", image_url: { url: fileBase64 } }
      ];
    } else if (extractedPositionen) {
      userMessageContent = `Analysiere diese Angebotspositionen:\n${JSON.stringify(extractedPositionen, null, 2)}`;
    } else {
      userMessageContent = `Analysiere diesen Angebotstext und extrahiere alle Positionen:\n${extractedText}`;
    }

    console.log("Sending to AI Gateway...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessageContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_angebot",
              description: "Analysiert ein Handwerker-Angebot und gibt strukturierte Bewertung zurück",
              parameters: {
                type: "object",
                properties: {
                  titel: { type: "string", description: "Titel/Bezeichnung des Angebots" },
                  handwerker_firma: { type: "string", description: "Name der Handwerkerfirma falls erkennbar" },
                  positionen: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        beschreibung: { type: "string" },
                        material: { type: "string" },
                        menge: { type: "number" },
                        einheit: { type: "string" },
                        einzelpreis: { type: "number" },
                        gesamtpreis: { type: "number" },
                        status: { type: "string", enum: ["green", "yellow", "red"] },
                        plausibility_score: { type: "number", description: "0-100" },
                        hinweis: { type: "string", description: "Konkreter Hinweis für den Kunden" },
                        marktpreis_min: { type: "number" },
                        marktpreis_max: { type: "number" },
                        marktpreis_durchschnitt: { type: "number" },
                        abweichung_prozent: { type: "number" },
                        gewerk_name: { type: "string", description: "Zugehöriges Gewerk" },
                      },
                      required: ["beschreibung", "status", "plausibility_score", "hinweis"],
                    },
                  },
                  gesamtpreis: { type: "number" },
                  plausibility_score: { type: "number", description: "Gesamt-Score 0-100" },
                  analysis_summary: { type: "string", description: "Zusammenfassung der Analyse mit Handlungsempfehlungen" },
                },
                required: ["positionen", "gesamtpreis", "plausibility_score", "analysis_summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_angebot" } },
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
          JSON.stringify({ error: "AI-Kontingent erschöpft. Bitte Guthaben aufladen." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("AI Gateway error");
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const analysisResult: AnalysisResult = JSON.parse(toolCall.function.arguments);

    // Update angebot with analysis results if angebotId provided
    if (angebotId) {
      // Update angebot
      await supabase
        .from("angebote")
        .update({
          status: "completed",
          gesamtpreis: analysisResult.gesamtpreis,
          plausibility_score: analysisResult.plausibility_score,
          analysis_summary: analysisResult.analysis_summary,
          handwerker_firma: analysisResult.handwerker_firma,
          title: analysisResult.titel || "Analysiertes Angebot",
        })
        .eq("id", angebotId);

      // Get gewerk IDs for positions
      const { data: gewerkeData } = await supabase.from("gewerke").select("id, name");
      const gewerkeMap = new Map(gewerkeData?.map(g => [g.name.toLowerCase(), g.id]) || []);

      // Insert positions
      const positionenToInsert = analysisResult.positionen.map((pos, idx) => ({
        angebot_id: angebotId,
        position_nummer: idx + 1,
        gewerk_id: pos.gewerk_name ? gewerkeMap.get(pos.gewerk_name.toLowerCase()) : null,
        beschreibung: pos.beschreibung,
        material: pos.material,
        menge: pos.menge,
        einheit: pos.einheit,
        einzelpreis: pos.einzelpreis,
        gesamtpreis: pos.gesamtpreis,
        status: pos.status,
        plausibility_score: pos.plausibility_score,
        hinweis: pos.hinweis,
        marktpreis_min: pos.marktpreis_min,
        marktpreis_max: pos.marktpreis_max,
        marktpreis_durchschnitt: pos.marktpreis_durchschnitt,
        abweichung_prozent: pos.abweichung_prozent,
      }));

      await supabase.from("positionen").insert(positionenToInsert);

      console.log(`Analyzed angebot ${angebotId}: Score ${analysisResult.plausibility_score}`);
    }

    return new Response(
      JSON.stringify({ success: true, analysis: analysisResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analyze angebot error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});