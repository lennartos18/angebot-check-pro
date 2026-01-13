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
    // Neue Felder fuer Bewertungs-Engine
    einordnung_stufe?: string;
    einordnung_begruendung?: string;
    datengrundlage?: string;
    unsicherheitshinweis?: string;
    datenquelle?: string;
    interne_vergleiche?: number;
  }>;
  gesamtpreis: number;
  plausibility_score: number;
  analysis_summary: string;
  handwerker_firma?: string;
  titel?: string;
}

interface EvaluationResult {
  evaluation_level: string;
  evaluation_reason: string;
  data_basis_description: string;
  uncertainty_note?: string;
  data_source: string;
  internal_count: number;
  external_source_name?: string;
  statistics?: {
    quartile_1: number;
    median: number;
    quartile_3: number;
  };
  deviation_percent: number | null;
}

// Mapping von alten Status zu neuen Bewertungsstufen
function mapStatusToEvaluationLevel(status: string, abweichungProzent?: number): string {
  if (abweichungProzent !== undefined) {
    if (abweichungProzent <= -25) return "auffaellig_niedrig";
    if (abweichungProzent >= 30) return "auffaellig_hoch";
    if (abweichungProzent > 15) return "leicht_ueber_vergleich";
  }
  
  switch (status) {
    case "green": return "im_regionalen_rahmen";
    case "yellow": return "leicht_ueber_vergleich";
    case "red": return "auffaellig_hoch";
    default: return "nicht_einordenbar";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { angebotId, extractedText, extractedPositionen, fileBase64, fileType, plz, guestMode } = await req.json();
    
    console.log("Received request:", { 
      hasAngebotId: !!angebotId, 
      hasExtractedText: !!extractedText, 
      hasExtractedPositionen: !!extractedPositionen,
      hasFileBase64: !!fileBase64,
      fileType: fileType || "none",
      plz: plz || "none",
      guestMode: !!guestMode
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

    // Neues System-Prompt gemaess Bewertungs-Charta
    const systemPrompt = `Du bist ein Experte für die Analyse von Handwerker-Angeboten in Deutschland.

DEINE AUFGABE:
1. Extrahiere ALLE Positionen des Angebots vollständig
2. Identifiziere für jede Position: Beschreibung, Material, Menge, Einheit, Einzelpreis, Gesamtpreis
3. Ordne jede Position einer der 5 Bewertungsstufen zu

BEWERTUNGSSTUFEN (verbindlich, exklusiv):
- "im_regionalen_rahmen": Preis entspricht dem regionalen Vergleichswert
- "leicht_ueber_vergleich": Preis liegt leicht über dem Durchschnitt (15-25% über Median)
- "auffaellig_hoch": Preis liegt ≥30% über dem regionalen Vergleich
- "auffaellig_niedrig": Preis liegt ≥25% unter dem regionalen Vergleich
- "nicht_einordenbar": Keine ausreichenden Vergleichsdaten verfügbar

GRUNDPRINZIPIEN:
- Keine Kauf- oder Auftragsempfehlungen
- Keine rechtlichen Bewertungen
- Keine Aussagen über Seriosität von Betrieben
- Alle Aussagen sind indikativ, nicht absolut
- Bewertungen erfolgen positionsbezogen

MARKTPREIS-REFERENZDATEN (letzte 12 Monate):
${marktpreisInfo}

VERFÜGBARE GEWERKE: ${gewerkeList}

Für jede Position gib auch die alte "status" Ampelfarbe an für Rückwärtskompatibilität:
- "green" = im_regionalen_rahmen
- "yellow" = leicht_ueber_vergleich / nicht_einordenbar
- "red" = auffaellig_hoch / auffaellig_niedrig`;

    // Build user message content
    let userMessageContent: any;
    
    if (fileBase64 && fileType) {
      console.log("Using Vision mode for document analysis");
      const textInstruction = `Analysiere dieses Handwerker-Angebot im Detail. 
Extrahiere ALLE Positionen mit:
- Beschreibung der Leistung
- Material (falls angegeben)
- Menge und Einheit
- Einzelpreis und Gesamtpreis

Wichtig: Lies das Dokument vollständig und extrahiere die echten Daten daraus!
${extractedText ? `Zusätzliche Info: ${extractedText}` : ""}
${plz ? `PLZ/Region: ${plz}` : ""}`;
      
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
                        // Legacy-Felder
                        status: { type: "string", enum: ["green", "yellow", "red"] },
                        plausibility_score: { type: "number", description: "0-100" },
                        hinweis: { type: "string", description: "Konkreter Hinweis für den Kunden" },
                        marktpreis_min: { type: "number" },
                        marktpreis_max: { type: "number" },
                        marktpreis_durchschnitt: { type: "number" },
                        abweichung_prozent: { type: "number" },
                        gewerk_name: { type: "string" },
                        // Neue Bewertungs-Engine Felder
                        einordnung_stufe: { 
                          type: "string", 
                          enum: ["im_regionalen_rahmen", "leicht_ueber_vergleich", "auffaellig_hoch", "auffaellig_niedrig", "nicht_einordenbar"],
                          description: "Die verbindliche Bewertungsstufe"
                        },
                        einordnung_begruendung: { type: "string", description: "Kurze Begründung der Einordnung (1-2 Sätze)" },
                        datengrundlage: { type: "string", description: "z.B. 'Referenz: Marktdaten Handwerk, bundesweit'" },
                      },
                      required: ["beschreibung", "status", "plausibility_score", "hinweis", "einordnung_stufe", "einordnung_begruendung"],
                    },
                  },
                  gesamtpreis: { type: "number" },
                  plausibility_score: { type: "number", description: "Gesamt-Score 0-100" },
                  analysis_summary: { 
                    type: "string", 
                    description: "Sachliche Zusammenfassung ohne Empfehlungen. Beschreibe nur die Einordnung der Positionen." 
                  },
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

    // Ergänze fehlende Bewertungsfelder
    analysisResult.positionen = analysisResult.positionen.map(pos => {
      // Falls einordnung_stufe fehlt, aus status ableiten
      if (!pos.einordnung_stufe) {
        pos.einordnung_stufe = mapStatusToEvaluationLevel(pos.status, pos.abweichung_prozent);
      }
      
      // Falls einordnung_begruendung fehlt, aus hinweis übernehmen
      if (!pos.einordnung_begruendung && pos.hinweis) {
        pos.einordnung_begruendung = pos.hinweis;
      }
      
      // Datengrundlage ergänzen wenn nicht vorhanden
      if (!pos.datengrundlage) {
        if (pos.marktpreis_durchschnitt) {
          pos.datengrundlage = "Referenz: Marktdaten, bundesweit, letzte 12 Monate";
        } else {
          pos.datengrundlage = "Keine Vergleichsdaten verfügbar";
        }
      }
      
      return pos;
    });

    // Update angebot with analysis results if angebotId provided (not guest mode)
    if (angebotId && !guestMode) {
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

      // Insert positions mit neuen Bewertungsfeldern
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
        // Neue Felder
        einordnung_stufe: pos.einordnung_stufe,
        einordnung_begruendung: pos.einordnung_begruendung,
        datengrundlage: pos.datengrundlage,
        unsicherheitshinweis: pos.unsicherheitshinweis,
        datenquelle: pos.datenquelle || "external_only",
        interne_vergleiche: pos.interne_vergleiche || 0,
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
