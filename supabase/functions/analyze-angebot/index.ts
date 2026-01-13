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

interface ExtractedPosition {
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
    einordnung_stufe?: string;
    einordnung_begruendung?: string;
    datengrundlage?: string;
    ist_sonderleistung?: boolean;
    validierungshinweise?: string[];
  }>;
  gesamtpreis: number;
  plausibility_score: number;
  analysis_summary: string;
  handwerker_firma?: string;
  titel?: string;
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

// Phase 4: Sonderleistungen erkennen
function isSpecialService(text: string): boolean {
  const specialKeywords = [
    'notdienst', 'notfall', 'sofort', 'express', 'eilauftrag', 'wochenende',
    'feiertag', 'nacht', 'sonderanfertigung', 'einzelstueck', 'einzelstück',
    'spezialanfertigung', 'massanfertigung', 'maßanfertigung', 'unikat'
  ];
  const lowerText = text.toLowerCase();
  return specialKeywords.some(kw => lowerText.includes(kw));
}

// Phase 4: Position validieren
function validatePosition(pos: Position): string[] {
  const warnings: string[] = [];
  
  if (!pos.menge && pos.menge !== 0) {
    warnings.push('Keine Mengenangabe');
  }
  
  if (!pos.einheit) {
    warnings.push('Keine Einheit');
  }
  
  if (!pos.einzelpreis && pos.einzelpreis !== 0) {
    warnings.push('Kein Einzelpreis');
  }
  
  if (pos.beschreibung && pos.beschreibung.length < 5) {
    warnings.push('Beschreibung sehr kurz');
  }
  
  return warnings;
}

// PHASE 1: Nur Positionen extrahieren (ohne Bewertung)
async function extractPositionsFromDocument(
  documentData: string,
  docType: string,
  extractedText: string | undefined,
  plz: string | undefined,
  isKfz: boolean,
  lovableApiKey: string
): Promise<ExtractedPosition[]> {
  console.log("PHASE 1: Extracting positions from document...");
  
  const extractionPrompt = `Du bist ein Experte für das Auslesen von ${isKfz ? 'Kfz-Werkstatt-Dokumenten' : 'Handwerker-Angeboten'}.

DEINE EINZIGE AUFGABE: Extrahiere ALLE Positionen aus dem Dokument.
Für jede Position extrahiere:
- beschreibung: Was wird gemacht/geliefert
- material: Welches Material (falls angegeben)
- menge: Anzahl/Menge
- einheit: Einheit (Stück, m², Stunden, pauschal, etc.)
- einzelpreis: Preis pro Einheit
- gesamtpreis: Gesamtpreis der Position

WICHTIG: 
- Lies das Dokument VOLLSTÄNDIG
- Extrahiere ALLE Positionen, auch Kleinpositionen
- Bei pauschalen Positionen: menge=1, einheit="pauschal"
- Preise IMMER als Zahlen ohne €-Zeichen
- KEINE Bewertung oder Einordnung - nur extrahieren!`;

  const userContent = [
    { 
      type: "text", 
      text: `Extrahiere alle Positionen aus diesem ${isKfz ? 'Werkstatt-Dokument' : 'Handwerker-Angebot'}.
${extractedText ? `Zusätzlicher Text: ${extractedText}` : ""}
${plz ? `Region: PLZ ${plz}` : ""}`
    },
    { type: "image_url", image_url: { url: documentData } }
  ];

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: extractionPrompt },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_positions",
            description: "Extrahiert alle Positionen aus einem Dokument",
            parameters: {
              type: "object",
              properties: {
                positionen: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      beschreibung: { type: "string", description: "Beschreibung der Leistung/des Materials" },
                      material: { type: "string", description: "Material falls angegeben" },
                      menge: { type: "number", description: "Menge/Anzahl" },
                      einheit: { type: "string", description: "Einheit (Stück, m², Std, pauschal, etc.)" },
                      einzelpreis: { type: "number", description: "Einzelpreis in Euro" },
                      gesamtpreis: { type: "number", description: "Gesamtpreis in Euro" },
                    },
                    required: ["beschreibung"],
                  },
                },
                handwerker_firma: { type: "string", description: "Name der Firma falls erkennbar" },
                titel: { type: "string", description: "Titel/Betreff des Dokuments" },
              },
              required: ["positionen"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_positions" } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Extraction failed: ${response.status}`);
  }

  const aiResponse = await response.json();
  const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error("No extraction result");
  }

  const extracted = JSON.parse(toolCall.function.arguments);
  console.log(`PHASE 1 complete: Extracted ${extracted.positionen?.length || 0} positions`);
  
  return extracted.positionen || [];
}

// PHASE 2: Marktdaten für Positionen abrufen
async function fetchMarketDataForPositions(
  positions: ExtractedPosition[],
  kategorie: string,
  supabaseUrl: string,
  supabaseKey: string,
  internalMarktpreise: any[]
): Promise<Map<number, any>> {
  console.log(`PHASE 2: Fetching market data for ${positions.length} positions...`);
  
  const marketData = new Map<number, any>();
  
  // Erst interne Daten matchen
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const beschreibungLower = pos.beschreibung.toLowerCase();
    
    // Suche in internen Marktpreisen
    const match = internalMarktpreise?.find(m => {
      const kategorieLower = m.position_kategorie?.toLowerCase() || '';
      const materialLower = m.material?.toLowerCase() || '';
      return beschreibungLower.includes(kategorieLower) || 
             beschreibungLower.includes(materialLower) ||
             kategorieLower.includes(beschreibungLower.split(' ')[0]);
    });
    
    if (match) {
      marketData.set(i, {
        source: 'internal',
        preis_min: match.preis_min,
        preis_max: match.preis_max,
        preis_durchschnitt: match.preis_durchschnitt,
        gewerk: match.gewerke?.name,
      });
    }
  }
  
  // Für Positionen ohne interne Daten: Externe Recherche
  const positionsNeedingExternal = positions
    .map((pos, i) => ({ pos, index: i }))
    .filter(({ index }) => !marketData.has(index));
  
  if (positionsNeedingExternal.length > 0) {
    console.log(`Fetching external data for ${positionsNeedingExternal.length} positions...`);
    
    try {
      const externalResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-market-prices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          positionen: positionsNeedingExternal.map(({ pos }) => ({
            beschreibung: pos.beschreibung,
            material: pos.material,
            einheit: pos.einheit,
            menge: pos.menge,
          })),
          kategorie: kategorie,
        }),
      });
      
      if (externalResponse.ok) {
        const externalData = await externalResponse.json();
        
        if (externalData.success && externalData.results) {
          for (const [idx, result] of Object.entries(externalData.results) as [string, any][]) {
            const originalIndex = positionsNeedingExternal[parseInt(idx)]?.index;
            if (originalIndex !== undefined && result.gefunden) {
              marketData.set(originalIndex, {
                source: 'external',
                preis_min: result.preis_min,
                preis_max: result.preis_max,
                preis_durchschnitt: result.preis_durchschnitt,
                quellen: result.quellen,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('External market data fetch error:', error);
    }
  }
  
  console.log(`PHASE 2 complete: Found market data for ${marketData.size}/${positions.length} positions`);
  return marketData;
}

// PHASE 3: Positionen mit Marktdaten bewerten
async function evaluatePositionsWithMarketData(
  positions: ExtractedPosition[],
  marketData: Map<number, any>,
  plz: string | undefined,
  isKfz: boolean,
  lovableApiKey: string,
  internalMarktpreisInfo: string
): Promise<AnalysisResult> {
  console.log("PHASE 3: Evaluating positions with market data...");
  
  // Baue detaillierte Positionsliste mit Marktdaten
  const positionsWithData = positions.map((pos, i) => {
    const data = marketData.get(i);
    let marketInfo = "Keine Vergleichsdaten verfügbar";
    
    if (data) {
      if (data.source === 'internal') {
        marketInfo = `INTERNE DB: ${data.preis_min?.toFixed(2)}-${data.preis_max?.toFixed(2)}€ (Ø ${data.preis_durchschnitt?.toFixed(2)}€), Gewerk: ${data.gewerk || 'Allgemein'}`;
      } else if (data.source === 'external') {
        marketInfo = `WEB-RECHERCHE: ${data.preis_min?.toFixed(2)}-${data.preis_max?.toFixed(2)}€ (Ø ${data.preis_durchschnitt?.toFixed(2)}€), Quellen: ${data.quellen?.join(', ') || 'diverse'}`;
      }
    }
    
    return {
      index: i + 1,
      beschreibung: pos.beschreibung,
      material: pos.material,
      menge: pos.menge,
      einheit: pos.einheit,
      einzelpreis: pos.einzelpreis,
      gesamtpreis: pos.gesamtpreis,
      vergleichsdaten: marketInfo,
      hatVergleichsdaten: !!data,
    };
  });

  const evaluationPrompt = `Du bist ein Experte für die Bewertung von ${isKfz ? 'Kfz-Werkstatt-Rechnungen' : 'Handwerker-Angeboten'} in Deutschland.

DEINE AUFGABE: Bewerte jede Position anhand der bereitgestellten Vergleichsdaten.

BEWERTUNGSSTUFEN (verbindlich):
- "im_regionalen_rahmen": Preis entspricht dem Vergleichswert (±15%)
- "leicht_ueber_vergleich": Preis liegt 15-25% über dem Durchschnitt
- "auffaellig_hoch": Preis liegt ≥30% über dem Vergleich
- "auffaellig_niedrig": Preis liegt ≥25% unter dem Vergleich
- "nicht_einordenbar": Keine Vergleichsdaten ODER fehlende Angaben

WICHTIGE REGELN:
1. Wenn Vergleichsdaten vorhanden sind, MÜSSEN diese für die Bewertung verwendet werden!
2. Berechne die prozentuale Abweichung: (Angebotspreis - Durchschnitt) / Durchschnitt * 100
3. Bei WEB-RECHERCHE-Daten: Die Quellen in der Begründung nennen
4. Bei fehlenden Angaben (keine Menge, kein Preis): "nicht_einordenbar" mit konkretem Hinweis

BEWERTUNGSLOGIK:
- Einzelpreis oder Gesamtpreis mit Durchschnitt vergleichen
- Bei Pauschalpreisen: Gesamtpreis bewerten
- Bei Mengenangaben: Einzelpreis pro Einheit vergleichen

${isKfz ? `
KFZ-SPEZIFISCH:
- Ersatzteile: OEM vs Aftermarket berücksichtigen
- Arbeitswerte relativ vergleichen
` : ''}

Für Rückwärtskompatibilität:
- status "green" = im_regionalen_rahmen
- status "yellow" = leicht_ueber_vergleich oder nicht_einordenbar
- status "red" = auffaellig_hoch oder auffaellig_niedrig`;

  const positionsText = positionsWithData.map(p => 
    `Position ${p.index}: ${p.beschreibung}
   Material: ${p.material || 'nicht angegeben'}
   Menge: ${p.menge ?? 'N/A'} ${p.einheit || ''}
   Einzelpreis: ${p.einzelpreis ? `${p.einzelpreis.toFixed(2)}€` : 'N/A'}
   Gesamtpreis: ${p.gesamtpreis ? `${p.gesamtpreis.toFixed(2)}€` : 'N/A'}
   >>> VERGLEICHSDATEN: ${p.vergleichsdaten}`
  ).join('\n\n');

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: evaluationPrompt },
        { 
          role: "user", 
          content: `Bewerte die folgenden ${positions.length} Positionen:

${positionsText}

REGION: ${plz ? `PLZ ${plz}` : 'Deutschland (bundesweit)'}

WICHTIG: 
- Übernimm die Positionsdaten exakt
- Nutze die bereitgestellten Vergleichsdaten für die Bewertung
- Gib für JEDE Position eine konkrete Einordnung mit Begründung`
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "evaluate_positions",
            description: "Bewertet Angebotspositionen mit Marktdaten",
            parameters: {
              type: "object",
              properties: {
                titel: { type: "string" },
                handwerker_firma: { type: "string" },
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
                      plausibility_score: { type: "number" },
                      hinweis: { type: "string" },
                      marktpreis_min: { type: "number" },
                      marktpreis_max: { type: "number" },
                      marktpreis_durchschnitt: { type: "number" },
                      abweichung_prozent: { type: "number" },
                      gewerk_name: { type: "string" },
                      einordnung_stufe: { 
                        type: "string", 
                        enum: ["im_regionalen_rahmen", "leicht_ueber_vergleich", "auffaellig_hoch", "auffaellig_niedrig", "nicht_einordenbar"]
                      },
                      einordnung_begruendung: { type: "string" },
                      datengrundlage: { type: "string" },
                    },
                    required: ["beschreibung", "status", "plausibility_score", "hinweis", "einordnung_stufe", "einordnung_begruendung"],
                  },
                },
                gesamtpreis: { type: "number" },
                plausibility_score: { type: "number" },
                analysis_summary: { type: "string" },
              },
              required: ["positionen", "gesamtpreis", "plausibility_score", "analysis_summary"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "evaluate_positions" } },
    }),
  });

  if (!response.ok) {
    throw new Error(`Evaluation failed: ${response.status}`);
  }

  const aiResponse = await response.json();
  const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall) {
    throw new Error("No evaluation result");
  }

  const result: AnalysisResult = JSON.parse(toolCall.function.arguments);
  console.log(`PHASE 3 complete: Evaluated ${result.positionen?.length || 0} positions`);
  
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { 
      angebotId, 
      extractedText, 
      extractedPositionen, 
      manualPositions,
      fileBase64, 
      pdfBase64,
      fileType, 
      documentType,
      plz, 
      guestMode, 
      serviceDomain 
    } = body;
    
    const positions = extractedPositionen || manualPositions;
    const documentData = fileBase64 || pdfBase64;
    const docType = fileType || documentType;
    
    console.log("Received request:", { 
      hasAngebotId: !!angebotId, 
      hasExtractedText: !!extractedText, 
      hasPositions: !!positions,
      positionCount: positions?.length || 0,
      hasDocumentData: !!documentData,
      docType: docType || "none",
      plz: plz || "none",
      guestMode: !!guestMode,
      serviceDomain: serviceDomain || "handwerk"
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch internal market price data
    const { data: marktpreise } = await supabase
      .from("marktpreise")
      .select("*, gewerke(name)");

    const marktpreisInfo = marktpreise?.map(m => 
      `${m.gewerke?.name}: ${m.position_kategorie} - ${m.material} (${m.einheit}): ${m.preis_min}-${m.preis_max}€, Durchschnitt: ${m.preis_durchschnitt}€`
    ).join("\n") || "";

    const { data: gewerke } = await supabase.from("gewerke").select("*");
    const gewerkeList = gewerke?.map(g => g.name).join(", ") || "";
    
    const isKfz = serviceDomain === 'werkstatt' || serviceDomain === 'kfz';
    const kategorie = isKfz ? 'kfz' : 'handwerk';

    let extractedPositions: ExtractedPosition[];
    
    // PHASE 1: Position extraction
    if (documentData && docType) {
      // Vision mode: Extract positions from image/PDF
      console.log("Using TWO-PHASE analysis for document");
      extractedPositions = await extractPositionsFromDocument(
        documentData,
        docType,
        extractedText,
        plz,
        isKfz,
        LOVABLE_API_KEY
      );
    } else if (positions && Array.isArray(positions) && positions.length > 0) {
      // Positions already provided
      console.log(`Using provided ${positions.length} positions`);
      extractedPositions = positions;
    } else if (extractedText) {
      // Text mode: Need to parse
      console.log("Text mode - creating single position");
      extractedPositions = [{
        beschreibung: extractedText.substring(0, 200),
      }];
    } else {
      throw new Error("Keine Positionsdaten oder Dokument zum Analysieren vorhanden");
    }
    
    if (extractedPositions.length === 0) {
      throw new Error("Keine Positionen im Dokument gefunden");
    }

    // PHASE 2: Fetch market data for all positions
    const marketData = await fetchMarketDataForPositions(
      extractedPositions,
      kategorie,
      supabaseUrl,
      supabaseKey,
      marktpreise || []
    );

    // PHASE 3: Evaluate positions with market data
    let analysisResult = await evaluatePositionsWithMarketData(
      extractedPositions,
      marketData,
      plz,
      isKfz,
      LOVABLE_API_KEY,
      marktpreisInfo
    );

    // Post-processing: Validation and special services
    analysisResult.positionen = analysisResult.positionen.map(pos => {
      // Map status to evaluation level if missing
      if (!pos.einordnung_stufe) {
        pos.einordnung_stufe = mapStatusToEvaluationLevel(pos.status, pos.abweichung_prozent);
      }
      
      if (!pos.einordnung_begruendung && pos.hinweis) {
        pos.einordnung_begruendung = pos.hinweis;
      }
      
      if (!pos.datengrundlage) {
        if (pos.marktpreis_durchschnitt) {
          pos.datengrundlage = "Die Position wurde auf Basis aktuell verfügbarer Vergleichsdaten eingeordnet.";
        } else {
          pos.datengrundlage = "Einordnung auf Basis allgemeiner Marktdaten";
        }
      }
      
      // Check for special services
      if (isSpecialService(pos.beschreibung)) {
        pos.ist_sonderleistung = true;
        pos.einordnung_stufe = "nicht_einordenbar";
        pos.einordnung_begruendung = "Sonderleistung (z.B. Notdienst, Eilauftrag) - keine Vergleichsbasis vorhanden.";
      }
      
      // Validation
      const validationWarnings = validatePosition(pos);
      if (validationWarnings.length > 0) {
        pos.validierungshinweise = validationWarnings;
        
        if (validationWarnings.length >= 2 && pos.einordnung_stufe !== "nicht_einordenbar") {
          pos.einordnung_stufe = "nicht_einordenbar";
          pos.einordnung_begruendung = `Position aufgrund fehlender Angaben nicht vollständig bewertbar: ${validationWarnings.join(', ')}`;
        }
      }
      
      return pos;
    });

    // Save to database if angebotId provided
    if (angebotId && !guestMode) {
      try {
        await supabase.from("angebote").update({
          plausibility_score: analysisResult.plausibility_score,
          analysis_summary: analysisResult.analysis_summary,
          gesamtpreis: analysisResult.gesamtpreis,
          handwerker_firma: analysisResult.handwerker_firma,
          title: analysisResult.titel || "Angebot",
          status: "analyzed",
          updated_at: new Date().toISOString(),
        }).eq("id", angebotId);

        // Delete old positions and insert new ones
        await supabase.from("positionen").delete().eq("angebot_id", angebotId);
        
        const positionenToInsert = analysisResult.positionen.map((pos, index) => ({
          angebot_id: angebotId,
          position_nummer: index + 1,
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
          einordnung_stufe: pos.einordnung_stufe,
          einordnung_begruendung: pos.einordnung_begruendung,
          datengrundlage: pos.datengrundlage,
        }));

        await supabase.from("positionen").insert(positionenToInsert);
        
        console.log(`Saved analysis for angebot ${angebotId}`);
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }
    }

    console.log("Analysis complete:", {
      positionCount: analysisResult.positionen.length,
      gesamtpreis: analysisResult.gesamtpreis,
      plausibilityScore: analysisResult.plausibility_score,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis: analysisResult,
        marketDataSources: {
          internal: [...marketData.values()].filter(d => d.source === 'internal').length,
          external: [...marketData.values()].filter(d => d.source === 'external').length,
          none: extractedPositions.length - marketData.size,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-angebot error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unbekannter Fehler" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
