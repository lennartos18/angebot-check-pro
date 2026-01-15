import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY nicht konfiguriert');
    }

    const body = await req.json();
    
    // Support multiple input formats
    const document = body.document || body.fileBase64 || body.imageBase64 || '';
    const plz = body.plz || '';
    const stadt = body.stadt || '';
    
    if (!document) {
      throw new Error('Kein Dokument übermittelt');
    }

    console.log('📄 Starte Handwerker-Rechnungsanalyse');
    console.log(`📍 Region: PLZ ${plz || 'nicht angegeben'}, Stadt: ${stadt || 'nicht angegeben'}`);

    // Prepare base64 for AI - handle data URL prefix
    let base64Content = document;
    let mimeType = body.mimeType || body.fileType || 'application/pdf';
    
    if (document.startsWith('data:')) {
      const match = document.match(/data:([^;]+);base64,(.+)/);
      if (match) {
        mimeType = match[1];
        base64Content = match[2];
      }
    }

    // Build region context
    const regionInfo = plz || stadt 
      ? `Die Rechnung stammt aus der Region: ${stadt ? stadt + ', ' : ''}${plz ? 'PLZ ' + plz : ''} (Deutschland).`
      : 'Die Region ist nicht bekannt, verwende bundesweite Durchschnittswerte.';

    // Single AI call for complete analysis - directly process the document
    const systemPrompt = `Du bist ein erfahrener Experte für Handwerker-Rechnungen in Deutschland. Du analysierst Rechnungen und bewertest, ob die Preise fair und marktüblich sind.

DEINE AUFGABE:
1. Extrahiere ALLE Positionen aus der Rechnung mit ihren Preisen
2. Bewerte JEDE Position basierend auf deinem Wissen über marktübliche Handwerkerpreise 2024/2025

BEWERTUNGSSTUFEN (du MUSST eine davon wählen):
- "im_regionalen_rahmen": Preis ist marktüblich (innerhalb ±15% des Üblichen)
- "leicht_ueber_vergleich": Preis ist 15-30% über dem Marktüblichen  
- "auffaellig_hoch": Preis ist mehr als 30% über dem Marktüblichen
- "auffaellig_niedrig": Preis ist mehr als 30% unter dem Marktüblichen

WICHTIGE REGELN:
1. Handwerker haben legitime Kosten (Material, Arbeitszeit, Anfahrt, Gewährleistung) - eine Marge von 15-25% ist NORMAL und OK
2. Berücksichtige ob Materialkosten enthalten sind oder nur Arbeitszeit
3. Qualitätsunterschiede (z.B. Premium-Material) rechtfertigen höhere Preise
4. Im ZWEIFEL bewerte als "im_regionalen_rahmen" - sei nicht zu streng!
5. Du MUSST IMMER eine Bewertung abgeben - NIEMALS "nicht einordenbar" oder ähnliches!

MARKTÜBLICHE RICHTWERTE (pro Stunde, 2024):
- Elektriker: 55-85€
- Sanitär/Heizung: 55-80€
- Maler: 40-60€
- Fliesenleger: 45-70€
- Tischler: 50-75€
- Dachdecker: 55-80€
- Maurer: 45-70€
- Allgemeine Handwerker: 45-65€

REGIONALE FAKTOREN:
- München, Frankfurt, Hamburg: +15-25%
- Ländliche Gebiete: -10-15%
- Standardregionen: Basispreis

${regionInfo}`;

    const userPrompt = `Analysiere diese Handwerker-Rechnung und gib das Ergebnis als JSON zurück.

WICHTIG: Antworte NUR mit validem JSON in exakt diesem Format:
{
  "handwerker_firma": "Name der Firma falls erkennbar",
  "gewerk": "Art des Handwerks (Elektro, Sanitär, Maler, etc.)",
  "rechnungsdatum": "Datum falls erkennbar",
  "gesamtbetrag": 1234.56,
  "positionen": [
    {
      "beschreibung": "Exakte Beschreibung aus der Rechnung",
      "menge": 1,
      "einheit": "Stück/Stunde/m²/pauschal",
      "einzelpreis": 50.00,
      "gesamtpreis": 50.00,
      "einordnung_stufe": "im_regionalen_rahmen",
      "abweichung_prozent": 0,
      "einordnung_begruendung": "Kurze Begründung warum dieser Preis so bewertet wird",
      "marktpreis_min": 40.00,
      "marktpreis_max": 60.00,
      "marktpreis_durchschnitt": 50.00
    }
  ],
  "zusammenfassung": "Kurze Gesamtbewertung der Rechnung",
  "empfehlung": "Konkrete Handlungsempfehlung für den Kunden"
}

REGELN:
- Extrahiere ALLE Positionen, auch kleine
- JEDE Position MUSS eine einordnung_stufe haben (NIEMALS leer oder "nicht einordenbar")
- abweichung_prozent: 0 = genau im Rahmen, positiv = über Markt, negativ = unter Markt
- Sei fair und berücksichtige dass Handwerker von ihrer Arbeit leben müssen`;

    console.log('🤖 Sende Dokument direkt an KI zur Analyse...');

    // Send document directly to AI with vision capability
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:${mimeType};base64,${base64Content}` 
                } 
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ KI-Fehler:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate-Limit erreicht. Bitte später erneut versuchen.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`KI-Analyse fehlgeschlagen: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Keine Antwort von der KI erhalten');
    }

    console.log('✅ KI-Antwort erhalten, parse JSON...');

    // Parse JSON from response
    let analysis;
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('❌ JSON-Parse-Fehler:', parseError);
      console.log('Raw content:', content.substring(0, 500));
      throw new Error('KI-Antwort konnte nicht als JSON geparst werden');
    }

    // Validate and clean up the analysis
    if (!analysis.positionen || !Array.isArray(analysis.positionen)) {
      analysis.positionen = [];
    }

    // Ensure every position has required fields
    analysis.positionen = analysis.positionen.map((pos: any, index: number) => {
      // Default evaluation if missing
      if (!pos.einordnung_stufe || pos.einordnung_stufe === 'nicht_einordenbar') {
        pos.einordnung_stufe = 'im_regionalen_rahmen';
        pos.einordnung_begruendung = pos.einordnung_begruendung || 'Preis erscheint marktüblich';
      }

      return {
        position_nummer: index + 1,
        beschreibung: pos.beschreibung || 'Unbekannte Position',
        menge: pos.menge || 1,
        einheit: pos.einheit || 'Stück',
        einzelpreis: pos.einzelpreis || pos.gesamtpreis || 0,
        gesamtpreis: pos.gesamtpreis || pos.einzelpreis || 0,
        einordnung_stufe: pos.einordnung_stufe,
        abweichung_prozent: pos.abweichung_prozent || 0,
        einordnung_begruendung: pos.einordnung_begruendung || '',
        marktpreis_min: pos.marktpreis_min || null,
        marktpreis_max: pos.marktpreis_max || null,
        marktpreis_durchschnitt: pos.marktpreis_durchschnitt || null,
        datenquelle: 'KI-Markteinschätzung',
        datengrundlage: 'Basierend auf aktuellen Marktdaten 2024/2025',
      };
    });

    // Calculate summary statistics
    const statusCounts: Record<string, number> = {
      im_regionalen_rahmen: 0,
      leicht_ueber_vergleich: 0,
      auffaellig_hoch: 0,
      auffaellig_niedrig: 0,
    };

    analysis.positionen.forEach((pos: any) => {
      const status = pos.einordnung_stufe;
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });

    console.log('📊 Bewertungs-Verteilung:', statusCounts);

    // Build final result
    const result = {
      success: true,
      handwerker_firma: analysis.handwerker_firma || null,
      gewerk: analysis.gewerk || 'Handwerk',
      rechnungsdatum: analysis.rechnungsdatum || null,
      gesamtbetrag: analysis.gesamtbetrag || null,
      positionen: analysis.positionen,
      zusammenfassung: analysis.zusammenfassung || 'Analyse abgeschlossen.',
      empfehlung: analysis.empfehlung || null,
      statistik: statusCounts,
      analysiert_am: new Date().toISOString(),
      datenquelle: 'KI-Markteinschätzung',
      region: { plz, stadt },
    };

    console.log('✅ Analyse abgeschlossen');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Fehler:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        positionen: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
