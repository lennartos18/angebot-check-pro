import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Präziser System-Prompt für Handwerker-Angebote v3.0
const SYSTEM_PROMPT = `Du analysierst ein deutsches Handwerker-Angebot oder eine Rechnung.

SCHRITT 1 - DOKUMENT VERSTEHEN:
- Lies das GESAMTE Dokument sorgfältig
- Identifiziere die Handwerker-Firma
- Erkenne das Gewerk (Zimmerei, Elektro, Sanitär, Maler, etc.)
- Finde den Gesamtbetrag (Brutto mit MwSt)

SCHRITT 2 - POSITIONEN EXTRAHIEREN:
Eine ECHTE Rechnungsposition hat IMMER diese Merkmale:
- Eine Positionsnummer (1, 2, 3 oder 1.1, 1.2 oder Pos. 1, etc.)
- Eine Leistungsbeschreibung
- Eine Mengenangabe (z.B. "100 m²", "5 Stück", "1 pauschal", "8 Std")
- Einen Preis (Einzelpreis ODER Gesamtpreis)

Das sind KEINE Positionen (IGNORIEREN!):
- Überschriften wie "Angebot", "Rechnung", "Leistungsverzeichnis"
- Einleitungstexte und Begrüßungen
- "Zwischensumme", "Übertrag", "Netto", "Brutto", "MwSt", "Summe"
- Bankverbindungen und Kontodaten
- AGB und rechtliche Hinweise
- Hinweisblöcke und Erklärungen ohne Preis
- Fußzeilen und Kopfzeilen

SCHRITT 3 - PREISBEWERTUNG MIT MARKTDATEN 2024/2025:

Zimmerei/Holzbau (Referenzpreise pro Einheit):
- Schalung/Verkleidung demontieren: 30-45 €/m²
- OSB-Platten 22mm verlegen: 18-28 €/m²
- Holzfaserplatten verlegen: 20-35 €/m²
- Balken aufdoppeln (KVH 8x12): 80-140 €/Stück
- Balken aufdoppeln (KVH 12x12): 120-200 €/Stück
- Deckendurchbruch herstellen: 200-400 € pauschal
- Container 7m³ stellen: 250-400 € pauschal
- Container 10m³ stellen: 350-500 € pauschal
- Entsorgung Bauschutt: 80-150 €/t
- Entsorgung Mischmüll: 150-280 €/t
- Heraklith/Dämmplatten ausbauen: 20-35 €/m²
- Dachstuhl Reparatur: 60-90 €/Std

Elektro (Referenzpreise):
- Steckdose setzen: 35-60 €/Stück
- Lichtschalter setzen: 30-50 €/Stück
- Leitung verlegen: 8-15 €/m
- Unterverteiler installieren: 300-600 € pauschal
- Stundensatz Elektriker: 55-75 €/Std

Sanitär (Referenzpreise):
- Waschtisch montieren: 80-150 €/Stück
- WC montieren: 100-200 €/Stück
- Heizkörper montieren: 120-250 €/Stück
- Rohrleitung verlegen: 40-80 €/m
- Stundensatz Sanitär: 55-75 €/Std

Maler (Referenzpreise):
- Wand streichen: 8-15 €/m²
- Decke streichen: 10-18 €/m²
- Tapezieren: 12-25 €/m²
- Lackieren Türrahmen: 40-80 €/Stück
- Stundensatz Maler: 45-60 €/Std

BEWERTUNGSSTUFEN:
- "im_regionalen_rahmen": Preis liegt im Bereich ±20% vom Marktpreis
- "leicht_ueber_vergleich": Preis liegt 20-40% über Marktpreis
- "auffaellig_hoch": Preis liegt über 40% über Marktpreis
- "auffaellig_niedrig": Preis liegt über 30% unter Marktpreis (verdächtig günstig)

WICHTIGE REGELN:
1. Handwerker-Marge von 15-25% auf Material ist NORMAL
2. Anfahrtspauschalen und Kleinmengen-Aufschläge sind üblich
3. Bei Spezialarbeiten ohne Vergleichsdaten: "im_regionalen_rahmen" mit Hinweis
4. NIEMALS Positionen erfinden - nur was im Dokument steht!
5. Wenn du dir bei einem Preis unsicher bist: "im_regionalen_rahmen"

AUSGABEFORMAT (JSON):
{
  "handwerker_firma": "Name der Firma",
  "service_domain": "zimmerei|elektro|sanitaer|maler|allgemein",
  "gesamtpreis": 12345.67,
  "positionen": [
    {
      "position_nummer": "1",
      "beschreibung": "Genaue Beschreibung aus dem Dokument",
      "menge": 100,
      "einheit": "m²",
      "einzelpreis": 35.80,
      "gesamtpreis": 3580.00,
      "einordnung_stufe": "im_regionalen_rahmen",
      "einordnung_begruendung": "Marktpreis für Schalung demontieren: 30-45€/m², angeboten: 35,80€/m²",
      "marktpreis_min": 30.00,
      "marktpreis_max": 45.00,
      "abweichung_prozent": 0
    }
  ],
  "analysis_summary": "Kurze Zusammenfassung in 2-3 Sätzen"
}`;

serve(async (req) => {
  console.log('[analyze-angebot] v3.0 - Kompletter Reset');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const { fileBase64, plz } = body;

    console.log('[analyze-angebot] Request received, PLZ:', plz);

    if (!fileBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Keine Datei übermittelt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // API Key prüfen
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('[analyze-angebot] LOVABLE_API_KEY nicht konfiguriert');
      return new Response(
        JSON.stringify({ success: false, error: 'API-Konfigurationsfehler' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Base64 aus Data-URL extrahieren
    let base64Content = fileBase64;
    let mimeType = 'application/pdf';
    
    if (fileBase64.startsWith('data:')) {
      const matches = fileBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Content = matches[2];
        console.log('[analyze-angebot] Data-URL parsed, MIME:', mimeType, 'Base64 length:', base64Content.length);
      }
    }

    // Bestimme media_type für die API
    let mediaType = 'application/pdf';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      mediaType = 'image/jpeg';
    } else if (mimeType.includes('png')) {
      mediaType = 'image/png';
    } else if (mimeType.includes('webp')) {
      mediaType = 'image/webp';
    }

    console.log('[analyze-angebot] Sending to Lovable AI, media_type:', mediaType);

    // Lovable AI aufrufen
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analysiere dieses Handwerker-Dokument.${plz ? ` Region: PLZ ${plz}` : ''}\n\nExtrahiere NUR die echten Positionen mit Preisen und bewerte sie anhand der Marktdaten. Antworte NUR mit dem JSON-Objekt, kein zusätzlicher Text.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64Content}`
                }
              }
            ]
          }
        ],
        max_tokens: 8000,
        temperature: 0.1
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[analyze-angebot] AI API Error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Zu viele Anfragen. Bitte warten Sie einen Moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'KI-Analyse fehlgeschlagen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '';
    
    console.log('[analyze-angebot] AI response length:', rawContent.length);
    console.log('[analyze-angebot] AI response preview:', rawContent.substring(0, 500));

    // JSON extrahieren
    let analysis;
    try {
      // Versuche direktes Parsing
      let jsonStr = rawContent;
      
      // Entferne Markdown-Code-Block falls vorhanden
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        // Versuche JSON-Objekt zu finden
        const objMatch = rawContent.match(/\{[\s\S]*\}/);
        if (objMatch) {
          jsonStr = objMatch[0];
        }
      }
      
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[analyze-angebot] JSON Parse Error:', parseError);
      console.error('[analyze-angebot] Raw content:', rawContent.substring(0, 1000));
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Antwort konnte nicht verarbeitet werden',
          raw_response: rawContent.substring(0, 1000)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Positionen validieren und bereinigen
    let positionen = analysis.positionen || [];
    
    // Filter: Nur echte Positionen behalten
    const ignoreTerms = ['übertrag', 'zwischensumme', 'nettobetrag', 'bruttobetrag', 'gesamtsumme', 'mwst', 'mehrwertsteuer', 'umsatzsteuer', 'summe netto', 'summe brutto'];
    
    positionen = positionen.filter((pos: any) => {
      // Muss einen Preis haben
      if (!pos.gesamtpreis && pos.gesamtpreis !== 0) {
        console.log('[analyze-angebot] Position ohne Preis entfernt:', pos.beschreibung?.substring(0, 50));
        return false;
      }
      
      // Keine Summen-Zeilen
      const desc = (pos.beschreibung || '').toLowerCase();
      if (ignoreTerms.some(term => desc.includes(term) && desc.length < 40)) {
        console.log('[analyze-angebot] Summen-Position entfernt:', pos.beschreibung?.substring(0, 50));
        return false;
      }
      
      return true;
    });

    // Positionen mit korrekter Struktur versehen
    positionen = positionen.map((pos: any, idx: number) => ({
      position_nummer: pos.position_nummer || String(idx + 1),
      beschreibung: pos.beschreibung || 'Position',
      menge: pos.menge || 1,
      einheit: pos.einheit || 'Stück',
      einzelpreis: pos.einzelpreis || pos.gesamtpreis || 0,
      gesamtpreis: pos.gesamtpreis || pos.einzelpreis || 0,
      einordnung_stufe: pos.einordnung_stufe || 'im_regionalen_rahmen',
      einordnung_begruendung: pos.einordnung_begruendung || 'Marktüblicher Preis',
      marktpreis_min: pos.marktpreis_min || null,
      marktpreis_max: pos.marktpreis_max || null,
      marktpreis_durchschnitt: pos.marktpreis_durchschnitt || null,
      abweichung_prozent: pos.abweichung_prozent || 0,
      datenquelle: 'KI-Markteinschätzung',
      datengrundlage: 'Marktdaten 2024/2025',
    }));

    console.log('[analyze-angebot] Gefilterte Positionen:', positionen.length);

    // Statistiken berechnen
    const stufen: Record<string, number> = {
      im_regionalen_rahmen: 0,
      leicht_ueber_vergleich: 0,
      auffaellig_hoch: 0,
      auffaellig_niedrig: 0
    };
    
    positionen.forEach((pos: any) => {
      const stufe = pos.einordnung_stufe?.toLowerCase().replace(/\s+/g, '_') || 'im_regionalen_rahmen';
      if (stufe in stufen) {
        stufen[stufe]++;
      }
    });

    const processingTime = Date.now() - startTime;
    console.log(`[analyze-angebot] ✓ Erfolgreich abgeschlossen in ${processingTime}ms`);
    console.log(`[analyze-angebot] Positionen: ${positionen.length}, Stufen:`, stufen);

    return new Response(
      JSON.stringify({
        success: true,
        analysis: {
          handwerker_firma: analysis.handwerker_firma || 'Unbekannt',
          service_domain: analysis.service_domain || 'allgemein',
          gesamtpreis: analysis.gesamtpreis,
          positionen: positionen,
          analysis_summary: analysis.analysis_summary || `${positionen.length} Positionen analysiert.`,
          statistik: stufen
        },
        processing_time_ms: processingTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-angebot] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        processing_time_ms: Date.now() - startTime
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
