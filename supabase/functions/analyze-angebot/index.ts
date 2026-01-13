import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Position {
  position_nummer: number;
  beschreibung: string;
  material?: string;
  menge?: number;
  einheit?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
  einordnung_stufe: string;
  einordnung_begruendung: string;
  marktpreis_min?: number;
  marktpreis_max?: number;
  marktpreis_durchschnitt?: number;
  abweichung_prozent?: number;
  datengrundlage?: string;
  hinweis?: string;
}

interface AnalysisResult {
  success: boolean;
  document_type?: string;
  handwerker_name?: string;
  handwerker_firma?: string;
  plz?: string;
  stadt?: string;
  region?: string;
  service_domain?: string;
  gesamtpreis?: number;
  plausibility_score?: number;
  analysis_summary?: string;
  positionen?: Position[];
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== ANALYSE GESTARTET ===');

  try {
    const body = await req.json();
    console.log('Received body keys:', Object.keys(body));
    
    // Support both field naming conventions
    const documentContent = body.documentContent || body.extractedText || null;
    let imageBase64 = body.imageBase64 || body.fileBase64 || null;
    const documentType = body.documentType || 'Angebot';
    const plz = body.plz || '';
    const stadt = body.stadt || '';
    
    // Detect mimeType from Data-URL or use provided value
    let detectedMimeType = body.mimeType || body.fileType || 'image/jpeg';
    const originalBase64 = body.imageBase64 || body.fileBase64 || '';
    
    // Extract mimeType from Data-URL if present (e.g., "data:image/webp;base64,...")
    if (originalBase64.startsWith('data:')) {
      const match = originalBase64.match(/data:([^;]+);/);
      if (match) {
        detectedMimeType = match[1];
      }
    }
    
    // WICHTIG: Data-URL Prefix entfernen falls vorhanden
    // "data:image/webp;base64,XXXXX" -> "XXXXX"
    if (imageBase64 && imageBase64.includes(',')) {
      imageBase64 = imageBase64.split(',')[1];
    }
    
    console.log('Original base64 starts with:', originalBase64.substring(0, 50));
    console.log('Clean imageBase64 present:', !!imageBase64, 'length:', imageBase64?.length || 0);
    console.log('Detected mimeType:', detectedMimeType);
    console.log('documentContent present:', !!documentContent);

    if (!documentContent && !imageBase64) {
      throw new Error('Kein Dokumentinhalt oder Bild übermittelt');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY nicht konfiguriert');
    }

    // Fetch internal market prices for context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: marktpreise } = await supabase
      .from('marktpreise')
      .select('position_kategorie, preis_min, preis_max, preis_durchschnitt, einheit, region')
      .limit(100);

    const marktpreisContext = marktpreise && marktpreise.length > 0
      ? `\n\nVERFÜGBARE INTERNE MARKTDATEN (nutze diese als Referenz):\n${marktpreise.map(m => 
          `- ${m.position_kategorie}: ${m.preis_min}-${m.preis_max}€ (Ø ${m.preis_durchschnitt}€) pro ${m.einheit || 'Einheit'}${m.region ? ` in ${m.region}` : ''}`
        ).join('\n')}`
      : '';

    const regionContext = plz ? `\nREGION: PLZ ${plz}${stadt ? `, ${stadt}` : ''} - Berücksichtige regionale Preisunterschiede für diese Region.` : '';

    const systemPrompt = `Du bist ein Experte für die Bewertung von Handwerker-Angeboten, Kostenvoranschlägen und Rechnungen in Deutschland.

DEINE AUFGABE:
1. Extrahiere alle Positionen aus dem Dokument
2. Bewerte jede Position anhand von Marktdaten
3. Gib eine Gesamtbewertung ab

${marktpreisContext}
${regionContext}

BEWERTUNGSSTUFEN (EXAKT diese Werte verwenden):
- "im_regionalen_rahmen": Preis liegt im normalen Bereich (±15% vom Durchschnitt)
- "leicht_ueber_vergleich": Preis liegt 15-30% über dem Durchschnitt
- "leicht_unter_vergleich": Preis liegt 15-30% unter dem Durchschnitt
- "auffaellig_hoch": Preis liegt mehr als 30% über dem Durchschnitt
- "auffaellig_niedrig": Preis liegt mehr als 25% unter dem Durchschnitt
- "nicht_einordenbar": NUR wenn echte Sonderleistung (Notdienst, Spezialanfertigung) ODER wenn wirklich keine Vergleichsdaten existieren

WICHTIGE REGELN:
1. Verwende die internen Marktdaten wenn verfügbar
2. Wenn keine internen Daten: Nutze dein Marktwissen für Deutschland 2025/2026
3. IMMER konkrete Preisschätzungen angeben (marktpreis_min, marktpreis_max, marktpreis_durchschnitt)
4. IMMER Datengrundlage nennen: "Interne Marktdaten", "Branchendurchschnitt Deutschland" oder "Allgemeine Markteinschätzung"
5. Gib IMMER einen kurzen, verständlichen Hinweis pro Position
6. "nicht_einordenbar" ist die LETZTE Option - versuche immer eine Einordnung

HINWEIS-BEISPIELE:
- "Im regionalen Rahmen für Hamburg, typisch für Sanitärarbeiten"
- "Leicht über dem Marktdurchschnitt, aber vertretbar bei Qualitätsarbeit"
- "Auffällig hoch - Nachverhandlung empfohlen"
- "Günstiger als üblich - Qualität prüfen"

Antworte IMMER als valides JSON mit dieser Struktur:
{
  "success": true,
  "document_type": "Angebot" | "Kostenvoranschlag" | "Rechnung",
  "handwerker_name": "Name oder null",
  "handwerker_firma": "Firma oder null",
  "plz": "PLZ oder null",
  "stadt": "Stadt oder null",
  "region": "Region oder null",
  "service_domain": "Sanitär" | "Elektro" | "Maler" | "Trockenbau" | "Heizung" | "Dachdecker" | "Kfz" | "Allgemein",
  "gesamtpreis": Zahl,
  "plausibility_score": 0-100,
  "analysis_summary": "Kurze Zusammenfassung der Bewertung (2-3 Sätze)",
  "positionen": [
    {
      "position_nummer": 1,
      "beschreibung": "Positionsbeschreibung",
      "material": "Material oder null",
      "menge": Zahl oder null,
      "einheit": "Stück/m²/Stunde/etc oder null",
      "einzelpreis": Zahl oder null,
      "gesamtpreis": Zahl,
      "einordnung_stufe": "im_regionalen_rahmen|leicht_ueber_vergleich|leicht_unter_vergleich|auffaellig_hoch|auffaellig_niedrig|nicht_einordenbar",
      "einordnung_begruendung": "Kurze Begründung",
      "marktpreis_min": Zahl,
      "marktpreis_max": Zahl,
      "marktpreis_durchschnitt": Zahl,
      "abweichung_prozent": Zahl (positiv = teurer, negativ = günstiger),
      "datengrundlage": "Interne Marktdaten" | "Branchendurchschnitt Deutschland" | "Allgemeine Markteinschätzung",
      "hinweis": "Kurzer, verständlicher Hinweis für den Nutzer"
    }
  ]
}`;

    // Build messages based on input type
    let messages: any[];
    
    if (imageBase64) {
      // Vision mode - image analysis
      console.log('Vision-Mode: Analysiere Bild...');
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${detectedMimeType};base64,${imageBase64}`
              }
            },
            {
              type: 'text',
              text: `Analysiere dieses Handwerker-Dokument (${documentType || 'Angebot/Rechnung'}). Extrahiere alle Positionen und bewerte jeden Preis.`
            }
          ]
        }
      ];
    } else {
      // Text mode - extracted PDF content
      console.log('Text-Mode: Analysiere Dokumentinhalt...');
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analysiere dieses Handwerker-Dokument (${documentType || 'Angebot/Rechnung'}):\n\n${documentContent}`
        }
      ];
    }

    // Single AI call for extraction AND evaluation
    console.log('AI-Analyse startet...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway Fehler:', response.status, errorText);
      throw new Error(`AI Gateway Fehler: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Keine Antwort von der KI erhalten');
    }

    console.log('AI-Antwort erhalten, parse JSON...');

    // Parse the JSON response
    let analysisResult: AnalysisResult;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      analysisResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON Parse Fehler:', parseError);
      console.error('Rohe Antwort:', content.substring(0, 500));
      throw new Error('Konnte KI-Antwort nicht parsen');
    }

    // Ensure all positions have required fields with defaults
    if (analysisResult.positionen) {
      analysisResult.positionen = analysisResult.positionen.map((pos, index) => ({
        position_nummer: pos.position_nummer || index + 1,
        beschreibung: pos.beschreibung || 'Unbekannte Position',
        material: pos.material || undefined,
        menge: pos.menge || undefined,
        einheit: pos.einheit || undefined,
        einzelpreis: pos.einzelpreis || undefined,
        gesamtpreis: pos.gesamtpreis || 0,
        einordnung_stufe: pos.einordnung_stufe || 'nicht_einordenbar',
        einordnung_begruendung: pos.einordnung_begruendung || 'Keine Begründung verfügbar',
        marktpreis_min: pos.marktpreis_min || undefined,
        marktpreis_max: pos.marktpreis_max || undefined,
        marktpreis_durchschnitt: pos.marktpreis_durchschnitt || undefined,
        abweichung_prozent: pos.abweichung_prozent || undefined,
        datengrundlage: pos.datengrundlage || 'Allgemeine Markteinschätzung',
        hinweis: pos.hinweis || 'Keine weiteren Hinweise'
      }));
    }

    const duration = Date.now() - startTime;
    console.log(`=== ANALYSE ABGESCHLOSSEN in ${duration}ms ===`);
    console.log(`Positionen: ${analysisResult.positionen?.length || 0}, Score: ${analysisResult.plausibility_score}`);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`=== ANALYSE FEHLGESCHLAGEN nach ${duration}ms ===`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler bei der Analyse'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
