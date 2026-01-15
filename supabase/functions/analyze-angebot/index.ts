import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

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
  cached?: boolean;
}

// Helper function to create SHA-256 hash
async function createDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const decoder = new TextDecoder();
  return decoder.decode(encodeHex(hashArray));
}

// Kfz-spezifische defensive Regeln anwenden
function applyKfzDefensiveRules(pos: Position, serviceDomain: string): Position {
  if (serviceDomain !== 'kfz_werkstatt') return pos;
  
  const beschreibung = pos.beschreibung?.toLowerCase() || '';
  
  // Kfz-typische Positionen die IMMER defensiv bewertet werden müssen
  const needsDefensiveEvaluation = 
    beschreibung.includes('inspektion') ||
    beschreibung.includes('ölwechsel') ||
    beschreibung.includes('motoröl') ||
    beschreibung.includes('5w') || // Ölviskosität
    beschreibung.includes('10w') ||
    beschreibung.includes('0w') ||
    beschreibung.includes('service') ||
    beschreibung.includes('wartung');
  
  // Wenn typische Kfz-Position UND keine ausreichenden Daten
  const hasInsufficientData = !pos.datengrundlage || 
    pos.datengrundlage.includes('Keine') || 
    pos.datengrundlage.includes('Allgemeine') ||
    pos.datengrundlage.includes('indikativ');
  
  if (needsDefensiveEvaluation && hasInsufficientData) {
    console.warn(`🚗 KFZ-DEFENSIVE: "${pos.beschreibung?.substring(0, 40)}..." → nicht_einordenbar`);
    
    pos.einordnung_stufe = 'nicht_einordenbar';
    
    if (beschreibung.includes('inspektion') || beschreibung.includes('service') || beschreibung.includes('wartung')) {
      pos.hinweis = 'Pauschale Abrechnung ohne fahrzeugspezifische Arbeitswerte – preislich nicht eindeutig einordenbar';
      pos.einordnung_begruendung = 'Ohne Angabe von Arbeitswerten (AW) und Fahrzeugklasse ist eine preisliche Einordnung nicht möglich';
    } else if (beschreibung.includes('öl') || beschreibung.includes('5w') || beschreibung.includes('10w') || beschreibung.includes('0w')) {
      pos.hinweis = 'Ölqualität und Herstellerfreigabe nicht spezifiziert – keine verlässliche Preiseinordnung möglich';
      pos.einordnung_begruendung = 'Ölpreise variieren stark je nach Qualität, OEM-Freigabe und Marke';
    } else {
      pos.hinweis = 'Aufgrund eingeschränkter fahrzeugspezifischer Vergleichsdaten nicht eindeutig einordenbar';
      pos.einordnung_begruendung = 'Keine ausreichenden regionalen Vergleichsdaten für diese Kfz-Leistung verfügbar';
    }
    
    pos.datengrundlage = 'Keine ausreichende Vergleichsbasis';
  }
  
  return pos;
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
    let documentContent = body.documentContent || body.extractedText || null;
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

    // PDF-Dateien können nicht direkt an Vision-Modelle gesendet werden
    // Sie müssen erst extrahiert werden
    const isPdf = detectedMimeType.includes('pdf') || detectedMimeType === 'application/pdf';
    
    if (isPdf && imageBase64 && !documentContent) {
      console.log('PDF erkannt - rufe extract-pdf auf...');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      // Call extract-pdf to get text content
      const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64: `data:application/pdf;base64,${imageBase64}`,
          fileType: 'application/pdf'
        }),
      });
      
      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error('extract-pdf Fehler:', extractResponse.status, errorText);
        throw new Error(`PDF-Extraktion fehlgeschlagen: ${errorText}`);
      }
      
      const extractJson = await extractResponse.json();
      console.log('extract-pdf Response:', JSON.stringify(extractJson).substring(0, 500));
      
      // Handle response structure: { success: true, data: { ... } } or direct data
      if (!extractJson.success) {
        throw new Error(`PDF-Extraktion fehlgeschlagen: ${extractJson.error || 'Unbekannter Fehler'}`);
      }
      
      const extractResult = extractJson.data || extractJson;
      console.log('PDF-Extraktion erfolgreich, Positionen:', extractResult.positionen?.length || 0);
      
      // Use extracted text for analysis
      if (extractResult.positionen && extractResult.positionen.length > 0) {
        // Format extracted positions as text for analysis
        const positionsText = extractResult.positionen.map((p: any, i: number) => 
          `Position ${i + 1}: ${p.beschreibung || 'Unbekannt'}` +
          (p.menge ? ` | Menge: ${p.menge} ${p.einheit || ''}` : '') +
          (p.einzelpreis ? ` | Einzelpreis: ${p.einzelpreis}€` : '') +
          (p.gesamtpreis ? ` | Gesamt: ${p.gesamtpreis}€` : '')
        ).join('\n');
        
        // Use correct field names from extract-pdf response
        documentContent = `EXTRAHIERTE DOKUMENTDATEN:
Firma: ${extractResult.handwerker_firma || extractResult.firma || 'Unbekannt'}
Datum: ${extractResult.datum || 'Unbekannt'}
Dokumentnummer: ${extractResult.angebots_nummer || extractResult.dokumentnummer || 'Unbekannt'}

POSITIONEN:
${positionsText}

SUMMEN:
Netto: ${extractResult.gesamtsumme_netto || extractResult.summe_netto || 'Unbekannt'}€
MwSt: ${extractResult.mwst || extractResult.mwst_betrag || 'Unbekannt'}€
Brutto: ${extractResult.gesamtsumme_brutto || extractResult.summe_brutto || 'Unbekannt'}€`;
        
        // Clear imageBase64 since we now have text content
        imageBase64 = null;
        console.log('PDF in Text konvertiert, Länge:', documentContent.length);
      } else {
        console.error('Keine Positionen in extractResult:', JSON.stringify(extractResult).substring(0, 500));
        throw new Error('PDF enthält keine extrahierbaren Positionen');
      }
    }

    if (!documentContent && !imageBase64) {
      throw new Error('Kein Dokumentinhalt oder Bild übermittelt');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY nicht konfiguriert');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create document hash for cache lookup
    const hashContent = imageBase64 || documentContent || '';
    const documentHash = await createDocumentHash(hashContent);
    console.log('Document hash:', documentHash.substring(0, 16) + '...');

    // Check cache first
    const { data: cachedResult } = await supabase
      .from('document_analysis_cache')
      .select('id, analysis_result')
      .eq('document_hash', documentHash)
      .maybeSingle();

    if (cachedResult) {
      console.log('=== CACHE HIT ===');
      // Update access stats
      await supabase
        .from('document_analysis_cache')
        .update({ 
          last_accessed_at: new Date().toISOString(),
          access_count: (cachedResult as any).access_count + 1 || 1
        })
        .eq('id', cachedResult.id);

      const duration = Date.now() - startTime;
      console.log(`Cache-Ergebnis zurückgegeben in ${duration}ms`);

      const result = cachedResult.analysis_result as AnalysisResult;
      result.cached = true;

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Cache miss - starte neue Analyse...');

    // Fetch internal market prices for context
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

    const systemPrompt = `Du bist ein Experte für die Bewertung von Handwerker-Angeboten, Kostenvoranschlägen, Rechnungen UND Kfz-Werkstatt-Dokumenten in Deutschland.

DEINE AUFGABE:
1. Bestimme zuerst die SERVICE_DOMAIN (handwerk ODER kfz_werkstatt)
2. Extrahiere ALLE Positionen die im Original-Dokument mit einem EIGENEN Preis versehen sind
3. Bewerte jede bepreiste Position anhand von Marktdaten
4. Gib eine Gesamtbewertung ab

${marktpreisContext}
${regionContext}

⚠️⚠️⚠️ SCHRITT 0: SERVICE_DOMAIN BESTIMMEN ⚠️⚠️⚠️

Analysiere das Dokument auf Kfz-typische Begriffe:
- Inspektion, Ölwechsel, Bremsen, Reifen, TÜV, HU, AU
- Fahrzeugdaten, Fahrgestellnummer, Kilometerstand
- Arbeitswerte (AW), Stundensatz Werkstatt
- Kfz-Werkstatt, Autowerkstatt, Autohaus
- Motoröl, 5W30, 10W40, Bremsflüssigkeit
- Ersatzteile wie Bremsbeläge, Filter, Zündkerzen

→ Wenn Kfz-Kontext erkannt: service_domain = "kfz_werkstatt"
→ Sonst: service_domain = "handwerk"

⚠️⚠️⚠️ MATHEMATISCH VERBINDLICHE BEWERTUNGSREGELN ⚠️⚠️⚠️

SCHRITT 1: Berechne abweichung_prozent:
abweichung_prozent = ((gesamtpreis - marktpreis_durchschnitt) / marktpreis_durchschnitt) * 100

SCHRITT 2: Bestimme einordnung_stufe STRIKT nach dieser Tabelle:
┌─────────────────────────┬──────────────────────────┐
│ abweichung_prozent      │ einordnung_stufe         │
├─────────────────────────┼──────────────────────────┤
│ > +30                   │ auffaellig_hoch          │
│ +15 bis +30             │ leicht_ueber_vergleich   │
│ -15 bis +15             │ im_regionalen_rahmen     │
│ -30 bis -15             │ leicht_unter_vergleich   │
│ < -30                   │ auffaellig_niedrig       │
└─────────────────────────┴──────────────────────────┘

BEISPIELE zur Verdeutlichung:
- abweichung_prozent = +45 → einordnung_stufe = "auffaellig_hoch"
- abweichung_prozent = +22 → einordnung_stufe = "leicht_ueber_vergleich"
- abweichung_prozent = +5  → einordnung_stufe = "im_regionalen_rahmen"
- abweichung_prozent = -10 → einordnung_stufe = "im_regionalen_rahmen"
- abweichung_prozent = -25 → einordnung_stufe = "leicht_unter_vergleich"
- abweichung_prozent = -61 → einordnung_stufe = "auffaellig_niedrig"

⚠️⚠️⚠️ SPEZIALREGELN FÜR KFZ-WERKSTÄTTEN ⚠️⚠️⚠️

Wenn service_domain = "kfz_werkstatt":

1. PAUSCHALINSPEKTIONEN ohne Arbeitswert-Aufschlüsselung:
   → einordnung_stufe = "nicht_einordenbar"
   → hinweis = "Pauschale Abrechnung ohne fahrzeugspezifische Arbeitswerte – preislich nicht eindeutig einordenbar"

2. MOTORÖL ohne Qualitäts-/Freigabe-Angabe:
   → einordnung_stufe = "nicht_einordenbar"
   → hinweis = "Ölqualität und Herstellerfreigabe nicht spezifiziert – keine verlässliche Preiseinordnung möglich"

3. ERSATZTEILE müssen klassifiziert werden:
   - OEM (Original Equipment Manufacturer)
   - Marken-Aftermarket (z.B. Bosch, TRW)
   - No-Name/Unbekannt

4. ARBEITSWERTE (AW):
   → Nur relativ vergleichen, nicht absolut bewerten
   → Wenn keine AW angegeben: "nicht_einordenbar"

5. GRUNDSATZ für Kfz:
   Kfz-Bewertungen sind IMMER defensiver als Handwerk!
   Lieber "nicht_einordenbar" als eine unsichere positive Einordnung.

⚠️ KRITISCH - EINORDNUNGS-REGELN:
- "nicht_einordenbar" → Bei Notdiensten, fehlenden Arbeitswerten, unspezifizierten Materialien, ODER wenn KEINE belastbaren Vergleichsdaten vorhanden
- Wenn datengrundlage = "Keine ausreichende Vergleichsbasis" → MUSS einordnung_stufe = "nicht_einordenbar" sein!

⚠️ POSITIONS-EXTRAKTION:
1. Extrahiere GENAU die Positionen die im Dokument einen EIGENEN Gesamtpreis (€) haben
2. PAUSCHALANGEBOTE (z.B. Treppe komplett 3.550€ mit vielen Unterpunkten): Das ist EINE Position
3. DETAILLIERTE ANGEBOTE (mehrere Positionen mit je eigenem Preis): Extrahiere JEDE einzeln
4. ZÄHLE NUR Positionen mit eigenem €-Betrag

⚠️⚠️⚠️ SPRACHLICHE REGELN (CHARTA-KONFORM) ⚠️⚠️⚠️

🚫 VERBOTEN - NIEMALS verwenden:
- "Marktpreis für Deutschland" oder "durchschnittlicher Marktpreis"
- "Branchendurchschnitt" oder "typisch für..."
- "Allgemeine Markteinschätzung" oder "basierend auf Markteinschätzung"
- "über dem Durchschnitt" oder "unter dem Durchschnitt"
- Absolute Aussagen wie "der Preis ist...", "kostet normalerweise..."
- Städtenamen oder PLZ in Hinweisen (nur "in der Region" oder "regional")

✅ PFLICHT - IMMER verwenden:
- "Im regionalen Vergleich..." oder "Innerhalb der beobachteten Spannbreite..."
- "...konnte eingeordnet werden als..." statt "...ist..."
- "...basierend auf verfügbaren Vergleichsdaten..." bei jeder Bewertung
- Unsicherheitshinweise bei eingeschränkter Datenbasis

HINWEIS-FORMULIERUNGEN (verwende NUR diese Muster):
- "Im regionalen Vergleich innerhalb der beobachteten Spannbreite vergleichbarer Positionen"
- "Konnte als leicht über den verfügbaren Vergleichswerten eingeordnet werden – bei begrenzter regionaler Datenbasis"
- "Auffällig über den Vergleichswerten – nähere Prüfung der Leistungsbeschreibung empfohlen"
- "Deutlich unter den regionalen Vergleichswerten – Leistungsumfang und Qualität prüfen"
- "Aufgrund eingeschränkter Vergleichsdaten nicht eindeutig einordenbar"

DATENGRUNDLAGE-WERTE (nur diese drei verwenden):
- "Regionale Vergleichsdaten" (wenn belastbare interne Marktdaten vorhanden)
- "Begrenzte regionale Datenbasis" (wenn wenige Vergleichspunkte)
- "Keine ausreichende Vergleichsbasis" (wenn keine Daten → dann MUSS einordnung_stufe = "nicht_einordenbar")

⚠️ NIEMALS "Allgemeine Markteinschätzung" als Datengrundlage verwenden!

ANALYSIS_SUMMARY FORMULIERUNG:

Für service_domain = "kfz_werkstatt":
"Die positionsbezogene Einordnung dieses Kfz-Werkstatt-Angebots erfolgte auf Basis verfügbarer Vergleichsinformationen. Für einzelne Positionen ist die Vergleichbarkeit eingeschränkt, da regionale Referenzdaten und fahrzeugspezifische Details nur begrenzt vorliegen. Die Bewertung erfolgt indikativ."

Für service_domain = "handwerk":
"Die positionsbezogene Einordnung dieses Handwerker-Angebots erfolgte auf Basis verfügbarer regionaler Vergleichsdaten. Die Bewertung erfolgt indikativ und dient der sachlichen Einordnung."

Antworte IMMER als valides JSON mit dieser Struktur:
{
  "success": true,
  "document_type": "Angebot" | "Kostenvoranschlag" | "Rechnung",
  "handwerker_name": "Name oder null",
  "handwerker_firma": "Firma oder null",
  "plz": "PLZ oder null",
  "stadt": "Stadt oder null",
  "region": "Region oder null",
  "service_domain": "handwerk" | "kfz_werkstatt",
  "gesamtpreis": Zahl,
  "plausibility_score": 0-100,
  "analysis_summary": "Zusammenfassung mit Hinweis auf Regionalität und Datenbasis (2-3 Sätze, defensiv formuliert)",
  "positionen": [
    {
      "position_nummer": 1,
      "beschreibung": "Positionsbeschreibung",
      "material": "Material oder null",
      "menge": Zahl oder null,
      "einheit": "Stück/m²/Stunde/AW/etc oder null",
      "einzelpreis": Zahl oder null,
      "gesamtpreis": Zahl,
      "einordnung_stufe": "im_regionalen_rahmen|leicht_ueber_vergleich|leicht_unter_vergleich|auffaellig_hoch|auffaellig_niedrig|nicht_einordenbar",
      "einordnung_begruendung": "Defensive Begründung mit Hinweis auf Vergleichsbasis",
      "marktpreis_min": Zahl oder null,
      "marktpreis_max": Zahl oder null,
      "marktpreis_durchschnitt": Zahl oder null,
      "abweichung_prozent": Zahl oder null (positiv = teurer, negativ = günstiger),
      "datengrundlage": "Regionale Vergleichsdaten" | "Begrenzte regionale Datenbasis" | "Keine ausreichende Vergleichsbasis",
      "hinweis": "Charta-konformer Hinweis mit Regionalitäts- und Datenbasis-Hinweis"
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
              text: `Analysiere dieses Dokument. Bestimme zuerst ob es ein Handwerker- oder Kfz-Werkstatt-Dokument ist. Extrahiere alle Positionen und bewerte jeden Preis nach den Charta-Regeln.`
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
          content: `Analysiere dieses Dokument. Bestimme zuerst ob es ein Handwerker- oder Kfz-Werkstatt-Dokument ist:\n\n${documentContent}`
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
        temperature: 0, // Deterministisch für konsistente Ergebnisse
        max_tokens: 8000, // Erhöht von 4000 für längere Dokumente
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway Fehler:', response.status, errorText);
      if (response.status === 429) {
        throw new Error('Rate-Limit erreicht. Bitte versuche es in einer Minute erneut.');
      }
      if (response.status === 402) {
        throw new Error('AI-Credits aufgebraucht. Bitte lade dein Konto auf.');
      }
      throw new Error(`AI Gateway Fehler: ${response.status}`);
    }

    // Parse response body safely
    const responseText = await response.text();
    console.log('AI Response length:', responseText.length);
    
    if (!responseText || responseText.length === 0) {
      console.error('AI Gateway returned empty response');
      throw new Error('KI-Antwort war leer. Bitte erneut versuchen.');
    }

    let aiResult;
    try {
      aiResult = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      throw new Error('KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.');
    }

    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      console.error('AI response structure invalid:', JSON.stringify(aiResult).substring(0, 500));
      throw new Error('Keine Antwort von der KI erhalten');
    }

    console.log('AI-Antwort erhalten, Länge:', content.length);

    // Parse the JSON response with robust error recovery
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

      // Try to fix truncated JSON by finding the last complete position
      try {
        analysisResult = JSON.parse(cleanContent);
      } catch (initialParseError) {
        console.log('Initial parse failed, attempting JSON repair...');
        
        // Find the last complete position object (ends with })
        const positionenMatch = cleanContent.match(/"positionen"\s*:\s*\[/);
        if (positionenMatch) {
          const positionenStart = cleanContent.indexOf(positionenMatch[0]) + positionenMatch[0].length;
          const beforePositionen = cleanContent.substring(0, positionenStart);
          const positionenContent = cleanContent.substring(positionenStart);
          
          // Find the last complete position object
          let lastCompletePos = -1;
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < positionenContent.length; i++) {
            const char = positionenContent[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  lastCompletePos = i;
                }
              }
            }
          }
          
          if (lastCompletePos > 0) {
            // Reconstruct valid JSON with complete positions
            const validPositionen = positionenContent.substring(0, lastCompletePos + 1);
            const repairedJson = beforePositionen + validPositionen + ']}';
            console.log('Repaired JSON length:', repairedJson.length);
            
            try {
              analysisResult = JSON.parse(repairedJson);
              console.log('JSON repair successful, positions:', analysisResult.positionen?.length);
            } catch (repairError) {
              // If repair fails, try to extract what we can
              throw initialParseError;
            }
          } else {
            throw initialParseError;
          }
        } else {
          throw initialParseError;
        }
      }
    } catch (parseError) {
      console.error('JSON Parse Fehler:', parseError);
      console.error('Rohe Antwort (erste 1000 Zeichen):', content.substring(0, 1000));
      console.error('Rohe Antwort (letzte 500 Zeichen):', content.substring(content.length - 500));
      throw new Error('Konnte KI-Antwort nicht parsen - Dokument möglicherweise zu komplex');
    }

    // Funktion zur mathematischen Validierung und Korrektur der einordnung_stufe
    function validateAndCorrectEinordnung(pos: Position): Position {
      const abweichung = pos.abweichung_prozent;
      
      // Wenn keine Abweichung berechnet wurde, nichts korrigieren
      if (abweichung === undefined || abweichung === null) {
        return pos;
      }
      
      // Mathematisch korrekte einordnung_stufe bestimmen
      let korrekteEinordnung: string;
      if (abweichung > 30) {
        korrekteEinordnung = 'auffaellig_hoch';
      } else if (abweichung >= 15) {
        korrekteEinordnung = 'leicht_ueber_vergleich';
      } else if (abweichung >= -15) {
        korrekteEinordnung = 'im_regionalen_rahmen';
      } else if (abweichung >= -30) {
        korrekteEinordnung = 'leicht_unter_vergleich';
      } else {
        korrekteEinordnung = 'auffaellig_niedrig';
      }
      
      // Prüfen ob Korrektur notwendig
      if (pos.einordnung_stufe !== korrekteEinordnung) {
        console.warn(`⚠️ EINORDNUNG KORRIGIERT: Position "${pos.beschreibung?.substring(0, 50)}..." - ${pos.einordnung_stufe} → ${korrekteEinordnung} (abweichung: ${abweichung.toFixed(1)}%)`);
        pos.einordnung_stufe = korrekteEinordnung;
        
        // Hinweis anpassen - CHARTA-KONFORM (keine "Durchschnitt" Formulierungen!)
        if (korrekteEinordnung === 'auffaellig_niedrig') {
          pos.hinweis = `Deutlich unter den regionalen Vergleichswerten (${Math.abs(abweichung).toFixed(0)}% Abweichung) – Leistungsumfang und Qualität prüfen`;
        } else if (korrekteEinordnung === 'auffaellig_hoch') {
          pos.hinweis = `Auffällig über den Vergleichswerten (${abweichung.toFixed(0)}% Abweichung) – nähere Prüfung der Leistungsbeschreibung empfohlen`;
        }
      }
      
      return pos;
    }

    // Determine service_domain from analysis result
    const serviceDomain = analysisResult.service_domain || 'handwerk';
    console.log(`Service Domain erkannt: ${serviceDomain}`);

    // Ensure all positions have required fields with defaults AND validate einordnung
    if (analysisResult.positionen) {
      analysisResult.positionen = analysisResult.positionen.map((pos, index) => {
        // Korrigiere verbotene Datengrundlage-Werte
        let datengrundlage = pos.datengrundlage || 'Keine ausreichende Vergleichsbasis';
        if (datengrundlage.includes('Allgemeine') || datengrundlage.includes('indikativ')) {
          datengrundlage = 'Keine ausreichende Vergleichsbasis';
        }
        
        const normalizedPos: Position = {
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
          datengrundlage: datengrundlage,
          hinweis: pos.hinweis || 'Keine weiteren Hinweise'
        };
        
        // Wenn Datengrundlage "Keine ausreichende Vergleichsbasis" ist, MUSS einordnung_stufe = "nicht_einordenbar" sein
        if (normalizedPos.datengrundlage === 'Keine ausreichende Vergleichsbasis') {
          normalizedPos.einordnung_stufe = 'nicht_einordenbar';
          if (!normalizedPos.hinweis || normalizedPos.hinweis === 'Keine weiteren Hinweise') {
            normalizedPos.hinweis = 'Aufgrund eingeschränkter Vergleichsdaten nicht eindeutig einordenbar';
          }
        }
        
        // Validiere und korrigiere die einordnung_stufe basierend auf abweichung_prozent
        let correctedPos = validateAndCorrectEinordnung(normalizedPos);
        
        // Wende Kfz-spezifische defensive Regeln an
        correctedPos = applyKfzDefensiveRules(correctedPos, serviceDomain);
        
        return correctedPos;
      });
    }

    const duration = Date.now() - startTime;
    console.log(`=== ANALYSE ABGESCHLOSSEN in ${duration}ms ===`);
    console.log(`Service Domain: ${serviceDomain}, Positionen: ${analysisResult.positionen?.length || 0}, Score: ${analysisResult.plausibility_score}`);
    
    // Log evaluation level distribution for debugging
    if (analysisResult.positionen && analysisResult.positionen.length > 0) {
      const stufeStats: Record<string, number> = {};
      analysisResult.positionen.forEach(pos => {
        const stufe = pos.einordnung_stufe || 'undefined';
        stufeStats[stufe] = (stufeStats[stufe] || 0) + 1;
      });
      console.log('Einordnungs-Verteilung:', JSON.stringify(stufeStats));
      
      // Für Kfz-Dokumente ist ein höherer Anteil "nicht_einordenbar" erwünscht!
      const nichtEinordenbar = stufeStats['nicht_einordenbar'] || 0;
      const totalPositionen = analysisResult.positionen.length;
      if (serviceDomain === 'kfz_werkstatt') {
        console.log(`🚗 KFZ-Modus: ${nichtEinordenbar}/${totalPositionen} Positionen sind 'nicht_einordenbar' (defensiv korrekt)`);
      } else if (nichtEinordenbar > totalPositionen * 0.5) {
        console.warn(`⚠️ WARNUNG: ${nichtEinordenbar}/${totalPositionen} Positionen sind 'nicht_einordenbar' - Prompt-Optimierung prüfen!`);
      }
    }

    // Save to cache for future requests
    try {
      await supabase
        .from('document_analysis_cache')
        .insert({
          document_hash: documentHash,
          analysis_result: analysisResult,
          file_type: detectedMimeType,
          file_size_bytes: hashContent.length
        });
      console.log('Ergebnis in Cache gespeichert');
    } catch (cacheError) {
      // Don't fail the request if caching fails
      console.error('Cache-Speicherung fehlgeschlagen:', cacheError);
    }

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
