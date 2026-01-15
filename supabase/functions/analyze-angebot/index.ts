import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY nicht konfiguriert');
    }

    const body = await req.json();
    console.log('📄 Neue Analyse-Anfrage erhalten');
    
    // Get document data - support multiple formats
    let documentData = body.fileBase64 || body.document || body.imageBase64 || '';
    const plz = body.plz || '';
    const stadt = body.stadt || '';
    
    if (!documentData) {
      throw new Error('Kein Dokument übermittelt');
    }

    // Extract base64 and mime type from data URL
    let base64Content = documentData;
    let mimeType = body.fileType || 'application/pdf';
    
    if (documentData.startsWith('data:')) {
      const match = documentData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Content = match[2];
        console.log(`📎 Dokument-Typ: ${mimeType}`);
      }
    }

    // Log document info
    const docSizeKB = Math.round(base64Content.length * 0.75 / 1024);
    console.log(`📊 Dokument-Größe: ~${docSizeKB} KB`);
    console.log(`📍 Region: ${plz || 'nicht angegeben'}`);

    // Build the data URL for the AI
    const dataUrl = `data:${mimeType};base64,${base64Content}`;

    // System prompt for analysis
    const systemPrompt = `Du bist ein Experte für Handwerker-Rechnungen in Deutschland.

AUFGABE:
1. Lies die Rechnung sorgfältig
2. Extrahiere ALLE Positionen mit Preisen
3. Bewerte jeden Preis basierend auf Marktdaten 2024/2025

BEWERTUNGSSTUFEN (wähle IMMER eine):
- "im_regionalen_rahmen": Preis ist fair (±15% vom Markt)
- "leicht_ueber_vergleich": Preis 15-30% über Markt
- "auffaellig_hoch": Preis >30% über Markt  
- "auffaellig_niedrig": Preis >30% unter Markt

MARKTPREISE (Stundensätze 2024):
- Elektriker: 55-85€
- Sanitär: 55-80€
- Maler: 40-60€
- Fliesenleger: 45-70€
- Tischler: 50-75€
- Dachdecker: 55-80€
- Allgemein: 45-65€

REGELN:
1. Handwerker brauchen Marge - 15-25% Aufschlag ist NORMAL
2. Material + Arbeit berücksichtigen
3. Im Zweifel: "im_regionalen_rahmen"
4. NIEMALS "nicht einordenbar" - immer eine Stufe wählen!
5. Analysiere die TATSÄCHLICHEN Positionen aus dem Dokument

${plz ? `Region: PLZ ${plz} (berücksichtige regionale Faktoren)` : ''}`;

    const userPrompt = `Analysiere diese Handwerker-Rechnung und antworte NUR mit JSON:

{
  "handwerker_firma": "Firmenname",
  "gewerk": "Art (Elektro/Sanitär/Maler/etc.)",
  "gesamtbetrag": 1234.56,
  "positionen": [
    {
      "beschreibung": "Text aus Rechnung",
      "menge": 1,
      "einheit": "Stück/Stunde/m²",
      "einzelpreis": 50.00,
      "gesamtpreis": 50.00,
      "einordnung_stufe": "im_regionalen_rahmen",
      "abweichung_prozent": 0,
      "einordnung_begruendung": "Warum so bewertet",
      "marktpreis_min": 40,
      "marktpreis_max": 60,
      "marktpreis_durchschnitt": 50
    }
  ],
  "zusammenfassung": "Gesamtbewertung in 1-2 Sätzen",
  "empfehlung": "Handlungsempfehlung"
}

WICHTIG:
- Extrahiere NUR Positionen die WIRKLICH im Dokument stehen
- Erfinde KEINE Positionen
- JEDE Position braucht eine einordnung_stufe
- Antworte NUR mit JSON, kein anderer Text`;

    console.log('🤖 Sende an KI zur Analyse...');

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
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ KI-Fehler:', aiResponse.status, errorText);
      throw new Error(`KI-Analyse fehlgeschlagen: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Keine Antwort von KI');
    }

    console.log('✅ KI-Antwort erhalten');

    // Parse JSON
    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('❌ JSON-Parse-Fehler');
      console.log('Raw:', content.substring(0, 300));
      throw new Error('JSON-Parsing fehlgeschlagen');
    }

    // Validate positions
    if (!analysis.positionen || !Array.isArray(analysis.positionen)) {
      analysis.positionen = [];
    }

    // Count evaluations
    const counts: Record<string, number> = {
      im_regionalen_rahmen: 0,
      leicht_ueber_vergleich: 0,
      auffaellig_hoch: 0,
      auffaellig_niedrig: 0,
    };

    // Clean up positions
    analysis.positionen = analysis.positionen.map((pos: any, idx: number) => {
      const stufe = pos.einordnung_stufe || 'im_regionalen_rahmen';
      if (counts[stufe] !== undefined) counts[stufe]++;

      return {
        position_nummer: idx + 1,
        beschreibung: pos.beschreibung || 'Position',
        menge: pos.menge || 1,
        einheit: pos.einheit || 'Stück',
        einzelpreis: pos.einzelpreis || pos.gesamtpreis || 0,
        gesamtpreis: pos.gesamtpreis || pos.einzelpreis || 0,
        einordnung_stufe: stufe,
        abweichung_prozent: pos.abweichung_prozent || 0,
        einordnung_begruendung: pos.einordnung_begruendung || 'Marktüblicher Preis',
        marktpreis_min: pos.marktpreis_min || null,
        marktpreis_max: pos.marktpreis_max || null,
        marktpreis_durchschnitt: pos.marktpreis_durchschnitt || null,
        datenquelle: 'KI-Markteinschätzung',
        datengrundlage: 'Marktdaten 2024/2025',
      };
    });

    console.log('📊 Bewertungen:', JSON.stringify(counts));

    const processingTime = Date.now() - startTime;
    console.log(`✅ Fertig in ${processingTime}ms`);

    const result = {
      success: true,
      handwerker_firma: analysis.handwerker_firma || null,
      gewerk: analysis.gewerk || 'Handwerk',
      gesamtbetrag: analysis.gesamtbetrag || null,
      positionen: analysis.positionen,
      zusammenfassung: analysis.zusammenfassung || 'Analyse abgeschlossen.',
      empfehlung: analysis.empfehlung || null,
      statistik: counts,
      analysiert_am: new Date().toISOString(),
      processing_time_ms: processingTime,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Fehler:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        positionen: [],
        processing_time_ms: processingTime,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
