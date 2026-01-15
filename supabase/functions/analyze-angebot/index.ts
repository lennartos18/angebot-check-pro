import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== TIMEOUT KONFIGURATION ====================
const TIMEOUTS = {
  OVERALL: 45000,         // 45 Sekunden Gesamt-Timeout
  AI_EXTRACTION: 15000,   // 15 Sek für KI-Extraktion
  DB_LOOKUP: 2000,        // 2 Sek für DB-Abfragen
  CACHE_LOOKUP: 2000,     // 2 Sek für Cache
  INTERNET_SEARCH: 10000, // 10 Sek für Internet-Suche
};

// ==================== INTERFACES ====================
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
  datenquelle?: string;
  hinweis?: string;
  // KI-Fallback-Schätzung (wird von Extraktion mitgeliefert)
  ki_schaetzung_min?: number;
  ki_schaetzung_max?: number;
  ki_schaetzung_durchschnitt?: number;
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
  processing_time_ms?: number;
}

interface MarketPriceData {
  preis_min: number;
  preis_max: number;
  preis_durchschnitt: number;
  source: 'internal_db' | 'cache' | 'internet' | 'ki_estimation';
  datengrundlage: string;
  quellen?: string[];
}

// ==================== HILFSFUNKTIONEN ====================

// Timeout-Wrapper für Promises
async function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  fallback: T,
  label: string = 'operation'
): Promise<T> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      console.warn(`⏱️ TIMEOUT: ${label} nach ${timeoutMs}ms abgebrochen`);
      reject(new Error(`TIMEOUT: ${label}`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error instanceof Error && error.message.startsWith('TIMEOUT')) {
      return fallback;
    }
    throw error;
  }
}

// SHA-256 Hash erstellen
async function createDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const decoder = new TextDecoder();
  return decoder.decode(encodeHex(hashArray));
}

// Service Domain erkennen
function detectServiceDomain(text: string): 'handwerk' | 'kfz_werkstatt' {
  const kfzKeywords = [
    'inspektion', 'ölwechsel', 'motoröl', 'bremsen', 'bremsbeläge', 
    'reifen', 'tüv', 'hauptuntersuchung', 'abgasuntersuchung',
    'fahrzeug', 'fahrgestellnummer', 'kilometerstand', 'kfz',
    'autowerkstatt', 'autohaus', 'werkstatt', 'arbeitswert', 'aw',
    '5w30', '5w40', '10w40', '0w20', 'longlife',
    'bremsscheiben', 'zündkerzen', 'luftfilter', 'ölfilter',
    'pkw', 'lkw', 'motorrad', 'fahrzeugschein'
  ];
  
  const lowerText = text.toLowerCase();
  const kfzMatches = kfzKeywords.filter(kw => lowerText.includes(kw)).length;
  
  return kfzMatches >= 2 ? 'kfz_werkstatt' : 'handwerk';
}

// ==================== DATENQUELLEN-WASSERFALL ====================

// Stufe 1: Interne Datenbank prüfen
async function searchInternalDatabase(
  supabase: any,
  position: Position,
  serviceDomain: string,
  plz?: string
): Promise<MarketPriceData | null> {
  try {
    const searchTerms = position.beschreibung.toLowerCase();
    
    // Suche in marktpreise-Tabelle
    let query = supabase
      .from('marktpreise')
      .select('position_kategorie, preis_min, preis_max, preis_durchschnitt, region')
      .limit(5);
    
    // Fuzzy-Matching über mehrere Suchbegriffe
    const keywords = searchTerms.split(' ').filter(w => w.length > 3).slice(0, 3);
    if (keywords.length > 0) {
      const searchPattern = keywords.map(k => `position_kategorie.ilike.%${k}%`).join(',');
      query = query.or(searchPattern);
    }

    const { data: marktpreise, error } = await query;
    
    if (!error && marktpreise && marktpreise.length > 0) {
      // Beste Übereinstimmung finden
      const best = marktpreise[0];
      console.log(`✅ DB-Match gefunden: "${position.beschreibung.substring(0, 30)}..." → ${best.position_kategorie}`);
      
      return {
        preis_min: best.preis_min || 0,
        preis_max: best.preis_max || 0,
        preis_durchschnitt: best.preis_durchschnitt || 0,
        source: 'internal_db',
        datengrundlage: 'Regionale Vergleichsdaten',
      };
    }
    
    // Auch in external_reference_data suchen
    const { data: extRef } = await supabase
      .from('external_reference_data')
      .select('price_min, price_max, price_median, source_name')
      .eq('service_domain', serviceDomain === 'kfz_werkstatt' ? 'werkstatt' : 'handwerk')
      .eq('is_active', true)
      .limit(1);
    
    if (extRef && extRef.length > 0) {
      const ref = extRef[0];
      return {
        preis_min: ref.price_min || 0,
        preis_max: ref.price_max || 0,
        preis_durchschnitt: ref.price_median || 0,
        source: 'internal_db',
        datengrundlage: 'Regionale Vergleichsdaten',
        quellen: [ref.source_name],
      };
    }
    
    return null;
  } catch (error) {
    console.error('DB-Suche Fehler:', error);
    return null;
  }
}

// Stufe 2: Cache prüfen
async function searchCache(
  supabase: any,
  position: Position,
  serviceDomain: string
): Promise<MarketPriceData | null> {
  try {
    const searchKey = `${position.beschreibung} ${position.material || ''}`.trim().toLowerCase();
    
    const { data: cached } = await supabase
      .from('external_marktpreise_cache')
      .select('preis_min, preis_max, preis_durchschnitt, quellen')
      .ilike('suchbegriff', `%${searchKey.substring(0, 30)}%`)
      .eq('kategorie', serviceDomain === 'kfz_werkstatt' ? 'kfz' : 'handwerk')
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    
    if (cached && cached.preis_durchschnitt) {
      console.log(`✅ Cache-Hit: "${position.beschreibung.substring(0, 30)}..."`);
      return {
        preis_min: cached.preis_min || 0,
        preis_max: cached.preis_max || 0,
        preis_durchschnitt: cached.preis_durchschnitt,
        source: 'cache',
        datengrundlage: 'Internet-Recherche (gecacht)',
        quellen: cached.quellen || [],
      };
    }
    
    return null;
  } catch (error) {
    console.error('Cache-Suche Fehler:', error);
    return null;
  }
}

// Stufe 3: Live Internet-Suche via fetch-market-prices
async function searchInternet(
  supabaseUrl: string,
  supabaseKey: string,
  position: Position,
  serviceDomain: string
): Promise<MarketPriceData | null> {
  try {
    console.log(`🌐 Internet-Suche für: "${position.beschreibung.substring(0, 40)}..."`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/fetch-market-prices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        positionen: [{
          beschreibung: position.beschreibung,
          material: position.material,
          kategorie: serviceDomain === 'kfz_werkstatt' ? 'kfz' : 'handwerk',
          einheit: position.einheit,
          menge: position.menge,
        }],
        kategorie: serviceDomain === 'kfz_werkstatt' ? 'kfz' : 'handwerk',
      }),
    });
    
    if (!response.ok) {
      console.warn(`Internet-Suche fehlgeschlagen: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    
    if (result.success && result.results && result.results[0]?.gefunden) {
      const data = result.results[0];
      console.log(`✅ Internet-Preise gefunden: ${data.preis_min}-${data.preis_max}€`);
      
      return {
        preis_min: data.preis_min || 0,
        preis_max: data.preis_max || 0,
        preis_durchschnitt: data.preis_durchschnitt || 0,
        source: 'internet',
        datengrundlage: 'Internet-Recherche',
        quellen: data.quellen || [],
      };
    }
    
    return null;
  } catch (error) {
    console.error('Internet-Suche Fehler:', error);
    return null;
  }
}

// Stufe 4: KI-Schätzung als Fallback (bereits aus Extraktion vorhanden)
function useKIEstimation(position: Position): MarketPriceData | null {
  if (position.ki_schaetzung_durchschnitt && position.ki_schaetzung_durchschnitt > 0) {
    console.log(`🤖 KI-Schätzung verwendet: ${position.ki_schaetzung_min}-${position.ki_schaetzung_max}€`);
    return {
      preis_min: position.ki_schaetzung_min || 0,
      preis_max: position.ki_schaetzung_max || 0,
      preis_durchschnitt: position.ki_schaetzung_durchschnitt,
      source: 'ki_estimation',
      datengrundlage: 'Begrenzte Datenbasis',
    };
  }
  return null;
}

// Hauptfunktion: 4-Stufen-Wasserfall für eine Position
async function enrichPositionWithMarketData(
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string,
  position: Position,
  serviceDomain: string,
  plz?: string,
  remainingTime?: number
): Promise<MarketPriceData | null> {
  
  // Berechne verfügbare Zeit pro Stufe
  const timePerStage = remainingTime ? Math.min(remainingTime / 3, TIMEOUTS.INTERNET_SEARCH) : TIMEOUTS.INTERNET_SEARCH;
  
  // Stufe 1: Interne DB (schnell)
  const dbResult = await withTimeout(
    searchInternalDatabase(supabase, position, serviceDomain, plz),
    Math.min(TIMEOUTS.DB_LOOKUP, timePerStage),
    null,
    'DB-Suche'
  );
  if (dbResult) return dbResult;
  
  // Stufe 2: Cache (schnell)
  const cacheResult = await withTimeout(
    searchCache(supabase, position, serviceDomain),
    Math.min(TIMEOUTS.CACHE_LOOKUP, timePerStage),
    null,
    'Cache-Suche'
  );
  if (cacheResult) return cacheResult;
  
  // Stufe 3: Internet-Suche (langsamer, mit Timeout)
  if (remainingTime && remainingTime > 5000) {
    const internetResult = await withTimeout(
      searchInternet(supabaseUrl, supabaseKey, position, serviceDomain),
      Math.min(TIMEOUTS.INTERNET_SEARCH, remainingTime - 3000),
      null,
      'Internet-Suche'
    );
    if (internetResult) return internetResult;
  }
  
  // Stufe 4: KI-Schätzung (sofort verfügbar)
  const kiResult = useKIEstimation(position);
  if (kiResult) return kiResult;
  
  return null;
}

// ==================== BEWERTUNGSLOGIK ====================

function calculateEvaluation(
  position: Position,
  marketData: MarketPriceData | null,
  serviceDomain: string
): Position {
  
  // Fallback wenn keine Marktdaten gefunden
  if (!marketData) {
    position.einordnung_stufe = 'nicht_einordenbar';
    position.einordnung_begruendung = 'Keine ausreichenden Vergleichsdaten verfügbar';
    position.datengrundlage = 'Keine ausreichende Vergleichsbasis';
    position.hinweis = 'Aufgrund eingeschränkter Vergleichsdaten nicht eindeutig einordenbar';
    return position;
  }
  
  // Marktdaten übernehmen
  position.marktpreis_min = marketData.preis_min;
  position.marktpreis_max = marketData.preis_max;
  position.marktpreis_durchschnitt = marketData.preis_durchschnitt;
  position.datengrundlage = marketData.datengrundlage;
  position.datenquelle = marketData.source;
  
  // Abweichung berechnen
  const preis = position.gesamtpreis || position.einzelpreis || 0;
  const durchschnitt = marketData.preis_durchschnitt;
  
  if (durchschnitt > 0 && preis > 0) {
    const abweichung = ((preis - durchschnitt) / durchschnitt) * 100;
    position.abweichung_prozent = Math.round(abweichung * 10) / 10;
    
    // Einordnung basierend auf Abweichung (CHARTA-konform)
    if (abweichung > 30) {
      position.einordnung_stufe = 'auffaellig_hoch';
      position.hinweis = `Auffällig über den Vergleichswerten (+${position.abweichung_prozent.toFixed(0)}%) – nähere Prüfung der Leistungsbeschreibung empfohlen`;
      position.einordnung_begruendung = 'Der Preis liegt deutlich über dem regionalen Vergleichswert';
    } else if (abweichung >= 15) {
      position.einordnung_stufe = 'leicht_ueber_vergleich';
      position.hinweis = `Konnte als leicht über den verfügbaren Vergleichswerten eingeordnet werden (+${position.abweichung_prozent.toFixed(0)}%)`;
      position.einordnung_begruendung = 'Der Preis liegt leicht über dem regionalen Vergleichswert';
    } else if (abweichung >= -15) {
      position.einordnung_stufe = 'im_regionalen_rahmen';
      position.hinweis = 'Im regionalen Vergleich innerhalb der beobachteten Spannbreite vergleichbarer Positionen';
      position.einordnung_begruendung = 'Der Preis entspricht dem regionalen Vergleichswert';
    } else if (abweichung >= -30) {
      position.einordnung_stufe = 'leicht_unter_vergleich';
      position.hinweis = `Leicht unter den regionalen Vergleichswerten (${position.abweichung_prozent.toFixed(0)}%)`;
      position.einordnung_begruendung = 'Der Preis liegt leicht unter dem regionalen Vergleichswert';
    } else {
      position.einordnung_stufe = 'auffaellig_niedrig';
      position.hinweis = `Deutlich unter den regionalen Vergleichswerten (${position.abweichung_prozent.toFixed(0)}%) – Leistungsumfang und Qualität prüfen`;
      position.einordnung_begruendung = 'Der Preis liegt deutlich unter dem regionalen Vergleichswert';
    }
    
    // Spezielle Hinweise bei begrenzter Datenbasis
    if (marketData.source === 'ki_estimation') {
      position.hinweis += ' – bei begrenzter Datenbasis';
    }
    
  } else {
    position.einordnung_stufe = 'nicht_einordenbar';
    position.einordnung_begruendung = 'Preis oder Vergleichswert nicht verfügbar';
    position.hinweis = 'Preisliche Einordnung nicht möglich';
  }
  
  // Kfz-spezifische Sonderregeln
  if (serviceDomain === 'kfz_werkstatt') {
    const beschreibung = position.beschreibung?.toLowerCase() || '';
    
    // Pauschalinspektionen ohne AW-Aufschlüsselung
    if ((beschreibung.includes('inspektion') || beschreibung.includes('service') || beschreibung.includes('wartung')) 
        && !beschreibung.includes('aw') && !beschreibung.includes('arbeitswert')) {
      
      // Bei KI-Schätzung als einzige Datenquelle: defensiv bewerten
      if (marketData.source === 'ki_estimation') {
        position.einordnung_stufe = 'nicht_einordenbar';
        position.hinweis = 'Pauschale Abrechnung ohne fahrzeugspezifische Arbeitswerte – preislich nicht eindeutig einordenbar';
        position.einordnung_begruendung = 'Ohne Angabe von Arbeitswerten (AW) und Fahrzeugklasse ist eine preisliche Einordnung eingeschränkt möglich';
      }
    }
    
    // Motoröl ohne Spezifikation
    if ((beschreibung.includes('öl') || beschreibung.includes('5w') || beschreibung.includes('10w') || beschreibung.includes('0w'))
        && marketData.source === 'ki_estimation') {
      position.einordnung_stufe = 'nicht_einordenbar';
      position.hinweis = 'Ölqualität und Herstellerfreigabe nicht spezifiziert – keine verlässliche Preiseinordnung möglich';
      position.einordnung_begruendung = 'Ölpreise variieren stark je nach Qualität, OEM-Freigabe und Marke';
    }
  }
  
  return position;
}

// ==================== HAUPTLOGIK ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const overallStartTime = Date.now();
  console.log('=== ANALYSE GESTARTET (v2.0 mit Wasserfall) ===');

  try {
    const body = await req.json();
    console.log('Received body keys:', Object.keys(body));
    
    // Input verarbeiten
    let documentContent = body.documentContent || body.extractedText || null;
    let imageBase64 = body.imageBase64 || body.fileBase64 || null;
    const documentType = body.documentType || 'Angebot';
    const plz = body.plz || '';
    const stadt = body.stadt || '';
    
    // MimeType erkennen
    let detectedMimeType = body.mimeType || body.fileType || 'image/jpeg';
    const originalBase64 = body.imageBase64 || body.fileBase64 || '';
    
    if (originalBase64.startsWith('data:')) {
      const match = originalBase64.match(/data:([^;]+);/);
      if (match) detectedMimeType = match[1];
    }
    
    // Data-URL Prefix entfernen
    if (imageBase64 && imageBase64.includes(',')) {
      imageBase64 = imageBase64.split(',')[1];
    }
    
    console.log('MimeType:', detectedMimeType);
    console.log('ImageBase64 vorhanden:', !!imageBase64);
    console.log('DocumentContent vorhanden:', !!documentContent);

    // PDF-Extraktion falls nötig
    const isPdf = detectedMimeType.includes('pdf') || detectedMimeType === 'application/pdf';
    
    if (isPdf && imageBase64 && !documentContent) {
      console.log('📄 PDF erkannt - rufe extract-pdf auf...');
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const extractResponse = await withTimeout(
        fetch(`${supabaseUrl}/functions/v1/extract-pdf`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileBase64: `data:application/pdf;base64,${imageBase64}`,
            fileType: 'application/pdf'
          }),
        }),
        10000,
        null as any,
        'PDF-Extraktion'
      );
      
      if (!extractResponse || !extractResponse.ok) {
        throw new Error('PDF-Extraktion fehlgeschlagen');
      }
      
      const extractJson = await extractResponse.json();
      if (!extractJson.success) {
        throw new Error(`PDF-Extraktion fehlgeschlagen: ${extractJson.error || 'Unbekannter Fehler'}`);
      }
      
      const extractResult = extractJson.data || extractJson;
      
      if (extractResult.positionen && extractResult.positionen.length > 0) {
        const positionsText = extractResult.positionen.map((p: any, i: number) => 
          `Position ${i + 1}: ${p.beschreibung || 'Unbekannt'}` +
          (p.menge ? ` | Menge: ${p.menge} ${p.einheit || ''}` : '') +
          (p.einzelpreis ? ` | Einzelpreis: ${p.einzelpreis}€` : '') +
          (p.gesamtpreis ? ` | Gesamt: ${p.gesamtpreis}€` : '')
        ).join('\n');
        
        documentContent = `EXTRAHIERTE DOKUMENTDATEN:
Firma: ${extractResult.handwerker_firma || extractResult.firma || 'Unbekannt'}
Datum: ${extractResult.datum || 'Unbekannt'}

POSITIONEN:
${positionsText}

SUMMEN:
Brutto: ${extractResult.gesamtsumme_brutto || extractResult.summe_brutto || 'Unbekannt'}€`;
        
        imageBase64 = null;
      } else {
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

    // Supabase initialisieren
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Cache prüfen
    const hashContent = imageBase64 || documentContent || '';
    const documentHash = await createDocumentHash(hashContent);
    
    const { data: cachedResult } = await supabase
      .from('document_analysis_cache')
      .select('id, analysis_result, access_count')
      .eq('document_hash', documentHash)
      .maybeSingle();

    if (cachedResult) {
      console.log('=== CACHE HIT ===');
      await supabase
        .from('document_analysis_cache')
        .update({ 
          last_accessed_at: new Date().toISOString(),
          access_count: ((cachedResult as any).access_count || 0) + 1
        })
        .eq('id', cachedResult.id);

      const result = cachedResult.analysis_result as AnalysisResult;
      result.cached = true;
      result.processing_time_ms = Date.now() - overallStartTime;

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Cache miss - starte 2-Phasen-Analyse...');

    // ==================== PHASE 1: KI-EXTRAKTION ====================
    // Neuer Prompt: NUR Extraktion + KI-Schätzungen als Fallback
    
    const extractionPrompt = `Du bist ein Dokumenten-Parser für Handwerker- und Kfz-Werkstatt-Angebote in Deutschland.

DEINE AUFGABE:
1. Extrahiere ALLE bepreisten Positionen aus dem Dokument
2. Bestimme die SERVICE_DOMAIN (handwerk oder kfz_werkstatt)
3. Für JEDE Position: Gib eine KI-Schätzung für den marktüblichen Preis ab

⚠️ WICHTIG: Deine Preisschätzungen dienen als FALLBACK falls keine echten Marktdaten gefunden werden.
Schätze realistisch basierend auf deinem Wissen über deutsche Preise 2024/2025.

SERVICE_DOMAIN ERKENNUNG:
- Kfz-Begriffe: Inspektion, Ölwechsel, Bremsen, TÜV, Arbeitswerte (AW), Fahrzeug → "kfz_werkstatt"
- Handwerk-Begriffe: Malerarbeiten, Sanitär, Elektro, Trockenbau, Renovierung → "handwerk"

Antworte AUSSCHLIESSLICH als valides JSON:
{
  "success": true,
  "document_type": "Angebot" | "Kostenvoranschlag" | "Rechnung",
  "handwerker_name": "Name oder null",
  "handwerker_firma": "Firma",
  "plz": "PLZ oder null",
  "stadt": "Stadt oder null",
  "region": "Region oder null",
  "service_domain": "handwerk" | "kfz_werkstatt",
  "gesamtpreis": Zahl,
  "positionen": [
    {
      "position_nummer": 1,
      "beschreibung": "Genaue Positionsbeschreibung aus Dokument",
      "material": "Material oder null",
      "menge": Zahl oder null,
      "einheit": "m²/Stück/Stunde/AW/etc",
      "einzelpreis": Zahl oder null,
      "gesamtpreis": Zahl (der Preis aus dem Dokument!),
      "ki_schaetzung_min": Zahl (deine Min-Schätzung für marktüblichen Preis),
      "ki_schaetzung_max": Zahl (deine Max-Schätzung für marktüblichen Preis),
      "ki_schaetzung_durchschnitt": Zahl (dein Durchschnitt)
    }
  ]
}

SCHÄTZUNGS-RICHTLINIEN:
- Handwerk: Berücksichtige Material + Arbeit + regionale Unterschiede
- Kfz: Unterscheide OEM/Aftermarket Teile, Stundensätze 80-150€
- Gib IMMER eine Schätzung ab, auch wenn unsicher (Spanne größer machen)
- Formatiere Preise als Zahlen ohne €-Zeichen`;

    // KI-Nachricht vorbereiten
    let messages: any[];
    
    if (imageBase64) {
      messages = [
        { role: 'system', content: extractionPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${detectedMimeType};base64,${imageBase64}` } },
            { type: 'text', text: 'Extrahiere alle Positionen mit Preisen und gib KI-Schätzungen ab.' }
          ]
        }
      ];
    } else {
      messages = [
        { role: 'system', content: extractionPrompt },
        { role: 'user', content: `Extrahiere alle Positionen:\n\n${documentContent}` }
      ];
    }

    console.log('🤖 Phase 1: KI-Extraktion startet...');
    
    const aiResponse = await withTimeout(
      fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          temperature: 0,
          max_tokens: 6000,
        }),
      }),
      TIMEOUTS.AI_EXTRACTION,
      null as any,
      'KI-Extraktion'
    );

    if (!aiResponse || !aiResponse.ok) {
      const status = aiResponse?.status || 'TIMEOUT';
      console.error('AI Gateway Fehler:', status);
      if (status === 429) throw new Error('Rate-Limit erreicht. Bitte versuche es später erneut.');
      if (status === 402) throw new Error('AI-Credits aufgebraucht.');
      throw new Error(`KI-Extraktion fehlgeschlagen: ${status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) throw new Error('Keine Antwort von der KI erhalten');

    // JSON parsen
    let analysisResult: AnalysisResult;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      else if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();
      
      analysisResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON Parse Fehler:', parseError);
      throw new Error('Konnte KI-Antwort nicht parsen');
    }

    console.log(`📊 Extraktion abgeschlossen: ${analysisResult.positionen?.length || 0} Positionen`);

    // Service Domain validieren/korrigieren
    const textForDomainCheck = documentContent || analysisResult.positionen?.map(p => p.beschreibung).join(' ') || '';
    const detectedDomain = detectServiceDomain(textForDomainCheck);
    if (analysisResult.service_domain !== detectedDomain) {
      console.log(`Service Domain korrigiert: ${analysisResult.service_domain} → ${detectedDomain}`);
      analysisResult.service_domain = detectedDomain;
    }

    // ==================== PHASE 2: MARKTDATEN-ANREICHERUNG (PARALLEL) ====================
    
    console.log('📈 Phase 2: Marktdaten-Anreicherung startet (parallel)...');
    
    const remainingTime = TIMEOUTS.OVERALL - (Date.now() - overallStartTime);
    console.log(`Verbleibende Zeit: ${Math.round(remainingTime / 1000)}s`);
    
    if (analysisResult.positionen && analysisResult.positionen.length > 0 && remainingTime > 5000) {
      // Alle Positionen PARALLEL verarbeiten
      const enrichmentPromises = analysisResult.positionen.map(async (position, index) => {
        const marketData = await enrichPositionWithMarketData(
          supabase,
          supabaseUrl,
          supabaseKey,
          position,
          analysisResult.service_domain || 'handwerk',
          plz,
          remainingTime - 2000 // Puffer für Finalisierung
        );
        
        return calculateEvaluation(position, marketData, analysisResult.service_domain || 'handwerk');
      });
      
      // Mit Gesamt-Timeout
      const enrichedPositions = await withTimeout(
        Promise.all(enrichmentPromises),
        remainingTime - 2000,
        analysisResult.positionen.map(p => calculateEvaluation(p, useKIEstimation(p), analysisResult.service_domain || 'handwerk')),
        'Marktdaten-Anreicherung'
      );
      
      analysisResult.positionen = enrichedPositions;
    }

    // ==================== PHASE 3: FINALISIERUNG ====================
    
    // Plausibility Score berechnen
    if (analysisResult.positionen && analysisResult.positionen.length > 0) {
      const bewertetePositionen = analysisResult.positionen.filter(p => p.einordnung_stufe !== 'nicht_einordenbar');
      const imRahmen = analysisResult.positionen.filter(p => 
        p.einordnung_stufe === 'im_regionalen_rahmen' || p.einordnung_stufe === 'leicht_unter_vergleich'
      ).length;
      
      if (bewertetePositionen.length > 0) {
        analysisResult.plausibility_score = Math.round((imRahmen / bewertetePositionen.length) * 100);
      } else {
        analysisResult.plausibility_score = 50; // Neutral bei fehlenden Daten
      }
    }

    // Analysis Summary generieren (CHARTA-konform)
    const serviceDomain = analysisResult.service_domain || 'handwerk';
    if (serviceDomain === 'kfz_werkstatt') {
      analysisResult.analysis_summary = 'Die positionsbezogene Einordnung dieses Kfz-Werkstatt-Angebots erfolgte auf Basis verfügbarer Vergleichsinformationen. Für einzelne Positionen ist die Vergleichbarkeit eingeschränkt, da regionale Referenzdaten und fahrzeugspezifische Details nur begrenzt vorliegen. Die Bewertung erfolgt indikativ.';
    } else {
      analysisResult.analysis_summary = 'Die positionsbezogene Einordnung dieses Handwerker-Angebots erfolgte auf Basis verfügbarer regionaler Vergleichsdaten. Die Bewertung erfolgt indikativ und dient der sachlichen Einordnung.';
    }

    // Statistiken loggen
    const processingTime = Date.now() - overallStartTime;
    analysisResult.processing_time_ms = processingTime;
    
    if (analysisResult.positionen && analysisResult.positionen.length > 0) {
      const stufeStats: Record<string, number> = {};
      const quellenStats: Record<string, number> = {};
      
      analysisResult.positionen.forEach(pos => {
        stufeStats[pos.einordnung_stufe || 'undefined'] = (stufeStats[pos.einordnung_stufe || 'undefined'] || 0) + 1;
        quellenStats[pos.datenquelle || 'unknown'] = (quellenStats[pos.datenquelle || 'unknown'] || 0) + 1;
      });
      
      console.log('📊 Einordnungs-Verteilung:', JSON.stringify(stufeStats));
      console.log('📊 Datenquellen-Verteilung:', JSON.stringify(quellenStats));
    }

    console.log(`=== ANALYSE ABGESCHLOSSEN in ${processingTime}ms ===`);

    // In Cache speichern
    try {
      await supabase.from('document_analysis_cache').insert({
        document_hash: documentHash,
        analysis_result: analysisResult,
        file_type: detectedMimeType,
        file_size_bytes: hashContent.length
      });
    } catch (cacheError) {
      console.error('Cache-Speicherung fehlgeschlagen:', cacheError);
    }

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const duration = Date.now() - overallStartTime;
    console.error(`=== ANALYSE FEHLGESCHLAGEN nach ${duration}ms ===`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler bei der Analyse',
      processing_time_ms: duration
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
