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
    // Bewertungs-Engine Felder
    einordnung_stufe?: string;
    einordnung_begruendung?: string;
    datengrundlage?: string;
    // Phase 4: Validierungs-Flags
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
    
    // Support both naming conventions
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

    // Fetch internal market price data for comparison
    const { data: marktpreise } = await supabase
      .from("marktpreise")
      .select("*, gewerke(name)");

    const marktpreisInfo = marktpreise?.map(m => 
      `${m.gewerke?.name}: ${m.position_kategorie} - ${m.material} (${m.einheit}): ${m.preis_min}-${m.preis_max}€, Durchschnitt: ${m.preis_durchschnitt}€`
    ).join("\n") || "";

    // Get gewerke for categorization
    const { data: gewerke } = await supabase.from("gewerke").select("*");
    const gewerkeList = gewerke?.map(g => g.name).join(", ") || "";
    
    // Prepare positions for external market price lookup
    const positionsForLookup = positions && Array.isArray(positions) ? positions.map((p: Position) => ({
      beschreibung: p.beschreibung || '',
      material: p.material,
      einheit: p.einheit,
      menge: p.menge,
    })) : [];
    
    // Fetch external market prices if we have positions and Firecrawl is configured
    let externalPriceInfo = "";
    const kategorie = serviceDomain === 'kfz' || serviceDomain === 'werkstatt' ? 'kfz' : 'handwerk';
    
    if (positionsForLookup.length > 0) {
      try {
        console.log(`Fetching external market prices for ${positionsForLookup.length} positions...`);
        
        const externalPricesResponse = await fetch(`${supabaseUrl}/functions/v1/fetch-market-prices`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            positionen: positionsForLookup,
            kategorie: kategorie,
          }),
        });
        
        if (externalPricesResponse.ok) {
          const externalData = await externalPricesResponse.json();
          
          if (externalData.success && externalData.results) {
            const externalPrices: string[] = [];
            
            for (const [index, result] of Object.entries(externalData.results) as [string, any][]) {
              const pos = positionsForLookup[parseInt(index)];
              if (result.gefunden && result.preis_min && result.preis_max) {
                externalPrices.push(
                  `${pos.beschreibung}: ${result.preis_min.toFixed(2)}-${result.preis_max.toFixed(2)}€ (Ø ${result.preis_durchschnitt?.toFixed(2) || 'N/A'}€) - Quellen: ${result.quellen?.join(', ') || 'Web-Recherche'}`
                );
              }
            }
            
            if (externalPrices.length > 0) {
              externalPriceInfo = `\n\nEXTERNE WEB-RECHERCHE MARKTDATEN:\n${externalPrices.join('\n')}`;
              console.log(`Found external prices for ${externalPrices.length} positions`);
            }
          }
        } else {
          console.log('External price fetch failed, continuing with internal data only');
        }
      } catch (error) {
        console.error('Error fetching external prices:', error);
        // Continue without external prices
      }
    }

    // Determine if this is automotive/Kfz
    const isKfz = serviceDomain === 'werkstatt' || serviceDomain === 'kfz';
    
    // Enhanced system prompt with Kfz support
    const systemPrompt = `Du bist ein Experte für die Analyse von ${isKfz ? 'Kfz-Werkstatt-Rechnungen und -Angeboten' : 'Handwerker-Angeboten'} in Deutschland.

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

${isKfz ? `
KFZ-SPEZIFISCHE REGELN:
- Ersatzteile klassifizieren als: OEM (Original), Marken-Aftermarket, oder No-Name
- Arbeitswerte (AW) relativ vergleichen, nicht absolute Stundensätze
- Fahrzeugklasse berücksichtigen (Kleinwagen, Mittelklasse, Oberklasse, Premium)
- Bei Ersatzteilen: Teile-Qualität in Bewertung einbeziehen
` : ''}

SONDERLEISTUNGEN (nicht normal bewertbar):
- Notdienst / Eilauftrag / Wochenende / Feiertag → "nicht_einordenbar" + Hinweis
- Sonderanfertigung / Einzelstück / Maßanfertigung → "nicht_einordenbar" + Hinweis

GRUNDPRINZIPIEN:
- Keine Kauf- oder Auftragsempfehlungen
- Keine rechtlichen Bewertungen
- Keine Aussagen über Seriosität von Betrieben
- Alle Aussagen sind indikativ, nicht absolut
- Bewertungen erfolgen positionsbezogen

WICHTIG: Nutze IMMER die verfügbaren Vergleichsdaten für die Bewertung!
Wenn externe Web-Recherche-Daten vorhanden sind, verwende diese bevorzugt.

INTERNE MARKTPREIS-REFERENZDATEN (letzte 12 Monate):
${marktpreisInfo || 'Keine internen Daten verfügbar'}
${externalPriceInfo}

VERFÜGBARE GEWERKE: ${gewerkeList}

Für jede Position gib auch die alte "status" Ampelfarbe an für Rückwärtskompatibilität:
- "green" = im_regionalen_rahmen
- "yellow" = leicht_ueber_vergleich / nicht_einordenbar
- "red" = auffaellig_hoch / auffaellig_niedrig`;

    // Build user message content
    let userMessageContent: any;
    
    if (documentData && docType) {
      console.log("Using Vision mode for document analysis");
      const textInstruction = `Analysiere dieses ${isKfz ? 'Kfz-Werkstatt-Dokument' : 'Handwerker-Angebot'} im Detail. 
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
        { type: "image_url", image_url: { url: documentData } }
      ];
    } else if (positions && Array.isArray(positions) && positions.length > 0) {
      console.log(`Using structured positions mode with ${positions.length} positions`);
      
      // Format positions for better AI understanding
      const positionsText = positions.map((p: any, i: number) => 
        `Position ${i + 1}:
  - Beschreibung: ${p.beschreibung || 'Nicht angegeben'}
  - Menge: ${p.menge || 'N/A'} ${p.einheit || ''}
  - Einzelpreis: ${p.einzelpreis ? `${p.einzelpreis.toFixed(2)}€` : 'N/A'}
  - Gesamtpreis: ${p.gesamtpreis ? `${p.gesamtpreis.toFixed(2)}€` : 'N/A'}`
      ).join('\n\n');
      
      userMessageContent = `AUFGABE: Bewerte die folgenden ${positions.length} Angebotspositionen einzeln.

POSITIONEN ZUR BEWERTUNG:

${positionsText}

REGION: ${plz ? `PLZ ${plz} (NRW)` : 'Deutschland (bundesweit)'}

ANWEISUNG: Übernimm die Positionsdaten exakt und füge für jede Position eine Bewertung hinzu. Gib ALLE ${positions.length} Positionen in deiner Antwort zurück.`;
    } else if (extractedText) {
      console.log("Using extracted text mode");
      userMessageContent = `Analysiere diesen ${isKfz ? 'Werkstatt-Beleg' : 'Angebotstext'} und extrahiere alle Positionen:\n${extractedText}`;
    } else {
      console.error("No valid input data provided");
      throw new Error("Keine Positionsdaten oder Dokument zum Analysieren vorhanden");
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
              description: "Analysiert ein Handwerker-Angebot oder Kfz-Werkstatt-Dokument und gibt strukturierte Bewertung zurück",
              parameters: {
                type: "object",
                properties: {
                  titel: { type: "string", description: "Titel/Bezeichnung des Angebots" },
                  handwerker_firma: { type: "string", description: "Name der Handwerkerfirma/Werkstatt falls erkennbar" },
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
                        // Bewertungs-Engine Felder
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

    // Phase 4: Nachbearbeitung - Validierung und Sonderleistungen
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
          pos.datengrundlage = "Die Position wurde auf Basis aktuell verfügbarer Vergleichsdaten eingeordnet.";
        } else {
          pos.datengrundlage = "Einordnung auf Basis allgemeiner Marktdaten";
        }
      }
      
      // Phase 4: Sonderleistung erkennen
      if (isSpecialService(pos.beschreibung)) {
        pos.ist_sonderleistung = true;
        pos.einordnung_stufe = "nicht_einordenbar";
        pos.einordnung_begruendung = "Sonderleistung (z.B. Notdienst, Eilauftrag) - keine Vergleichsbasis vorhanden.";
      }
      
      // Phase 4: Validierung
      const validationWarnings = validatePosition(pos);
      if (validationWarnings.length > 0) {
        pos.validierungshinweise = validationWarnings;
        
        // Bei unvollständigen Positionen ggf. Bewertung anpassen
        if (validationWarnings.includes('Keine Mengenangabe') || validationWarnings.includes('Kein Einzelpreis')) {
          if (!pos.ist_sonderleistung) {
            pos.einordnung_stufe = "nicht_einordenbar";
            pos.einordnung_begruendung = "Position aufgrund fehlender Angaben nicht bewertbar.";
          }
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

      // Insert positions mit neuen Bewertungsfeldern (ohne deprecated fields)
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
