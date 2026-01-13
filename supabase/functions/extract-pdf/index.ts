import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractionResult {
  handwerker_firma?: string;
  handwerker_name?: string;
  datum?: string;
  angebots_nummer?: string;
  positionen: Array<{
    position_nummer?: number;
    beschreibung: string;
    material?: string;
    menge?: number;
    einheit?: string;
    einzelpreis?: number;
    gesamtpreis?: number;
  }>;
  gesamtsumme_netto?: number;
  mwst?: number;
  gesamtsumme_brutto?: number;
  document_info?: {
    page_count?: number;
    document_type?: string;
    language?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileType, fileBase64, pageCount } = await req.json();

    console.log("Extract PDF request:", { 
      hasFileUrl: !!fileUrl, 
      fileType, 
      hasBase64: !!fileBase64,
      base64Length: fileBase64?.length,
      pageCount: pageCount || "unknown"
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine file type and processing mode
    const isPDF = fileType === "application/pdf" || fileUrl?.toLowerCase().endsWith(".pdf");
    const isImage = fileType?.startsWith("image/") || fileUrl?.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    const isExcel = fileType?.includes("spreadsheet") || fileType?.includes("excel") || 
                    fileUrl?.match(/\.(xlsx|xls|csv)$/i);

    console.log("Document type detection:", { isPDF, isImage, isExcel });

    // System prompt for document extraction
    const systemPrompt = `Du bist ein Experte für das Extrahieren von Daten aus Handwerker-Angeboten, Kostenvoranschlägen und Rechnungen.

DEINE AUFGABE:
Analysiere das Dokument VOLLSTÄNDIG und extrahiere ALLE Positionen mit folgenden Informationen:

PRO POSITION:
- Positionsnummer (falls vorhanden)
- Beschreibung der Leistung (vollständig, nicht gekürzt)
- Material (falls separat angegeben)
- Menge (als Zahl)
- Einheit (m², Stück, pauschal, Stunde, etc.)
- Einzelpreis (als Zahl, Dezimaltrennzeichen als Punkt)
- Gesamtpreis (als Zahl)

DOKUMENT-METADATA:
- Handwerker/Firma Name
- Datum des Dokuments
- Angebots-/Rechnungsnummer
- Nettosumme, MwSt, Bruttosumme

WICHTIGE REGELN:
1. Deutsche Zahlenformate umwandeln: Komma → Punkt für Dezimalzahlen
2. Tausendertrennzeichen ignorieren (1.234,56 → 1234.56)
3. Bei mehrseitigen Dokumenten: ALLE Seiten vollständig auswerten
4. Jede einzelne Position erfassen, keine Zusammenfassungen
5. Bei unklaren Werten: Bestmögliche Interpretation, keine Nullwerte

DOKUMENTTYP-ERKENNUNG:
- Angebot / Kostenvoranschlag
- Rechnung
- Auftragsbestätigung
- Lieferschein`;

    // Build message content based on input type
    let userMessageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
    
    const textInstruction = `Extrahiere ALLE Positionen und Informationen aus diesem Handwerker-Dokument.
${pageCount ? `Das Dokument hat ${pageCount} Seiten - analysiere ALLE Seiten vollständig.` : ""}
Gib die Daten strukturiert zurück.`;

    if (fileBase64) {
      // Direct Base64 input - works for both images and PDFs (Gemini supports PDF natively)
      console.log("Using Base64 input for Vision API");
      
      userMessageContent = [
        { type: "text", text: textInstruction },
        { 
          type: "image_url", 
          image_url: { 
            url: fileBase64.startsWith("data:") ? fileBase64 : `data:${fileType || "application/pdf"};base64,${fileBase64}`
          } 
        },
      ];
    } else if (fileUrl && isImage) {
      // Image URL
      console.log("Using image URL for Vision API");
      userMessageContent = [
        { type: "text", text: textInstruction },
        { type: "image_url", image_url: { url: fileUrl } },
      ];
    } else if (fileUrl) {
      // URL but not directly processable - fallback to text description
      console.log("Using URL reference (limited extraction capability)");
      userMessageContent = [
        { 
          type: "text", 
          text: `${textInstruction}\n\nDokument-URL: ${fileUrl}\n\nHinweis: Falls das Dokument nicht direkt analysiert werden kann, gib eine leere Positionsliste zurück.` 
        },
      ];
    } else {
      throw new Error("Keine gültige Datei-Eingabe (fileBase64 oder fileUrl erforderlich)");
    }

    console.log("Sending to AI Gateway with Gemini 2.5 Flash...");
    
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
              name: "extract_angebot",
              description: "Extrahiert strukturierte Daten aus einem Handwerker-Dokument (Angebot, Rechnung, KVA)",
              parameters: {
                type: "object",
                properties: {
                  handwerker_firma: { type: "string", description: "Name der Firma/des Betriebs" },
                  handwerker_name: { type: "string", description: "Name der Kontaktperson" },
                  datum: { type: "string", description: "Dokumentdatum im Format YYYY-MM-DD" },
                  angebots_nummer: { type: "string", description: "Angebots-/Rechnungsnummer" },
                  positionen: {
                    type: "array",
                    description: "Alle Positionen des Dokuments",
                    items: {
                      type: "object",
                      properties: {
                        position_nummer: { type: "number", description: "Positionsnummer falls vorhanden" },
                        beschreibung: { type: "string", description: "Vollständige Beschreibung der Leistung" },
                        material: { type: "string", description: "Material falls separat angegeben" },
                        menge: { type: "number", description: "Menge als Dezimalzahl" },
                        einheit: { type: "string", description: "Einheit (qm, Stück, pauschal, Std, etc.)" },
                        einzelpreis: { type: "number", description: "Einzelpreis als Dezimalzahl" },
                        gesamtpreis: { type: "number", description: "Gesamtpreis als Dezimalzahl" },
                      },
                      required: ["beschreibung"],
                    },
                  },
                  gesamtsumme_netto: { type: "number", description: "Nettosumme" },
                  mwst: { type: "number", description: "MwSt-Betrag" },
                  gesamtsumme_brutto: { type: "number", description: "Bruttosumme" },
                  document_info: {
                    type: "object",
                    properties: {
                      page_count: { type: "number", description: "Anzahl der Seiten" },
                      document_type: { 
                        type: "string", 
                        enum: ["angebot", "rechnung", "kostenvoranschlag", "auftragsbestaetigung", "lieferschein", "unbekannt"],
                        description: "Art des Dokuments"
                      },
                      language: { type: "string", description: "Sprache des Dokuments (de, en, etc.)" },
                    },
                  },
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
        console.error("Rate limit reached");
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht. Bitte versuchen Sie es später erneut." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("AI quota exhausted");
        return new Response(
          JSON.stringify({ error: "AI-Kontingent erschöpft." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(aiResponse).slice(0, 500));
      throw new Error("No extraction result from AI");
    }

    const extractedData: ExtractionResult = JSON.parse(toolCall.function.arguments);
    
    // Post-processing: Validate and clean data
    if (extractedData.positionen) {
      extractedData.positionen = extractedData.positionen.map((pos, idx) => ({
        ...pos,
        position_nummer: pos.position_nummer || idx + 1,
        // Ensure numeric values are actually numbers
        menge: typeof pos.menge === 'string' ? parseFloat(pos.menge) || undefined : pos.menge,
        einzelpreis: typeof pos.einzelpreis === 'string' ? parseFloat(pos.einzelpreis) || undefined : pos.einzelpreis,
        gesamtpreis: typeof pos.gesamtpreis === 'string' ? parseFloat(pos.gesamtpreis) || undefined : pos.gesamtpreis,
      }));
    }
    
    console.log("Extraction successful:", {
      positionCount: extractedData.positionen?.length || 0,
      hasMetadata: !!extractedData.handwerker_firma,
      documentType: extractedData.document_info?.document_type,
      pageCount: extractedData.document_info?.page_count
    });

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
