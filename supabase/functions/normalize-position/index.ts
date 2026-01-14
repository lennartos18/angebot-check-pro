import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface NormalizationInput {
  raw_text: string;
  service_domain: 'handwerk' | 'werkstatt';
  quantity?: number;
  unit?: string;
  total_price?: number;
  position_id?: string;
}

interface NormalizationResult {
  cleaned_text: string;
  position_type: 'arbeitszeit' | 'material' | 'ersatzteil' | 'pauschale' | 'sonstig';
  normalized_service_id: string | null;
  normalized_service_name: string | null;
  normalized_material_id: string | null;
  normalized_material_name: string | null;
  confidence_score: number;
  normalization_status: 'normalized' | 'unmatched';
  matching_keywords: string[];
  // Matching method
  match_method: 'embedding' | 'keyword' | 'learned' | 'none';
  embedding_similarity?: number;
  // Kfz-spezifische Felder
  kfz_part_type?: 'oem' | 'aftermarket' | 'no_name' | null;
  labor_units_aw?: number | null;
  vehicle_class?: string | null;
  // Validierung
  validation_warnings: string[];
  is_special_service: boolean;
}

interface NormalizedService {
  id: string;
  name: string;
  keywords: string[] | null;
  standard_unit: string | null;
}

interface NormalizedMaterial {
  id: string;
  name: string;
  keywords: string[] | null;
  standard_unit: string | null;
  material_category: string | null;
}

interface Synonym {
  canonical_term: string;
  synonym: string;
  weight: number;
}

interface TextNormalization {
  normalized_service_id: string | null;
  normalized_material_id: string | null;
  confidence_score: number;
  position_type: string;
  match_count: number;
}

interface ExistingNormalization {
  id: string;
  match_count: number;
}

interface EmbeddingMatch {
  id: string;
  name: string;
  service_domain: string;
  keywords: string[] | null;
  standard_unit: string | null;
  similarity: number;
}

// Constants
const CONFIDENCE_THRESHOLD = 70;
const EMBEDDING_SIMILARITY_THRESHOLD = 0.75;

// Kfz-spezifische Keywords für Ersatzteil-Klassifikation
const OEM_KEYWORDS = [
  'original', 'oem', 'erstausruester', 'erstausrüster', 'hersteller', 
  'genuine', 'oe', 'werksersatzteil', 'original-', 'bmw', 'mercedes', 
  'vw', 'audi', 'porsche', 'toyota', 'honda', 'ford'
];

const AFTERMARKET_KEYWORDS = [
  'bosch', 'brembo', 'bilstein', 'sachs', 'lemfoerder', 'lemförder',
  'mann', 'mahle', 'valeo', 'luk', 'ate', 'trw', 'febi', 'swag',
  'meyle', 'zimmermann', 'textar', 'hella', 'continental', 'ngk'
];

const NO_NAME_KEYWORDS = [
  'no-name', 'noname', 'nachbau', 'unbekannt', 'universal', 'generisch',
  'guenstig', 'günstig', 'preiswert', 'budget', 'economy'
];

// Sonderleistungen Keywords
const SPECIAL_SERVICE_KEYWORDS = [
  'notdienst', 'notfall', 'sofort', 'express', 'eilauftrag', 'wochenende',
  'feiertag', 'nacht', 'sonderanfertigung', 'einzelstueck', 'einzelstück',
  'spezialanfertigung', 'massanfertigung', 'maßanfertigung', 'unikat'
];

// Fahrzeugklassen-Keywords
const VEHICLE_CLASS_KEYWORDS: Record<string, string[]> = {
  'kleinwagen': ['polo', 'golf', 'fiesta', 'corsa', 'clio', 'yaris', '206', '208', 'up', 'adam'],
  'mittelklasse': ['passat', '3er', 'c-klasse', 'a4', 'mondeo', 'octavia', 'mazda3', 'camry'],
  'oberklasse': ['5er', 'e-klasse', 'a6', '7er', 's-klasse', 'a8', 'xf', 'ct6'],
  'premium': ['porsche', 'maserati', 'bentley', 'rolls', 'ferrari', 'lamborghini', 'amg'],
  'suv': ['tiguan', 'x3', 'x5', 'glc', 'q5', 'rav4', 'cr-v', 'tucson', 'sportage'],
  'transporter': ['transporter', 'sprinter', 'crafter', 'vito', 'transit', 'ducato', 'master']
};

// Helper: Load stopwords
async function loadStopwords(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('normalization_stopwords')
    .select('word');
  
  if (error) {
    console.error('Error loading stopwords:', error);
    return new Set();
  }
  
  return new Set((data || []).map((d: { word: string }) => d.word.toLowerCase()));
}

// Helper: Load synonyms
async function loadSynonyms(
  supabase: SupabaseClient, 
  serviceDomain: string
): Promise<Map<string, { canonical: string; weight: number }>> {
  const { data, error } = await supabase
    .from('normalization_synonyms')
    .select('canonical_term, synonym, weight')
    .in('service_domain', [serviceDomain, 'allgemein']);
  
  if (error) {
    console.error('Error loading synonyms:', error);
    return new Map();
  }
  
  const synonymMap = new Map<string, { canonical: string; weight: number }>();
  for (const row of (data || []) as Synonym[]) {
    synonymMap.set(row.synonym.toLowerCase(), {
      canonical: row.canonical_term.toLowerCase(),
      weight: row.weight
    });
  }
  
  return synonymMap;
}

// Helper: Load normalized services
async function loadNormalizedServices(
  supabase: SupabaseClient,
  serviceDomain: string
): Promise<NormalizedService[]> {
  const { data, error } = await supabase
    .from('normalized_services')
    .select('id, name, keywords, standard_unit')
    .eq('service_domain', serviceDomain);
  
  if (error) {
    console.error('Error loading services:', error);
    return [];
  }
  
  return (data || []) as NormalizedService[];
}

// Helper: Load normalized materials
async function loadNormalizedMaterials(
  supabase: SupabaseClient,
  serviceDomain: string
): Promise<NormalizedMaterial[]> {
  const { data, error } = await supabase
    .from('normalized_materials')
    .select('id, name, keywords, standard_unit, material_category')
    .eq('service_domain', serviceDomain);
  
  if (error) {
    console.error('Error loading materials:', error);
    return [];
  }
  
  return (data || []) as NormalizedMaterial[];
}

// Helper: Check for existing learned normalization
async function findLearnedNormalization(
  supabase: SupabaseClient,
  cleanedText: string,
  serviceDomain: string
): Promise<{
  normalized_service_id: string | null;
  normalized_material_id: string | null;
  confidence_score: number;
  position_type: string;
} | null> {
  const { data, error } = await supabase
    .from('text_normalizations')
    .select('normalized_service_id, normalized_material_id, confidence_score, position_type, match_count')
    .eq('cleaned_text', cleanedText)
    .eq('service_domain', serviceDomain)
    .gte('confidence_score', CONFIDENCE_THRESHOLD)
    .order('match_count', { ascending: false })
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  const row = data[0] as TextNormalization;
  
  // Only use if match_count is high enough (learned pattern)
  if (row.match_count >= 3) {
    return {
      normalized_service_id: row.normalized_service_id,
      normalized_material_id: row.normalized_material_id,
      confidence_score: row.confidence_score,
      position_type: row.position_type
    };
  }
  
  return null;
}

// NEW: Generate embedding via Lovable AI Gateway
async function generateEmbedding(text: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.warn('[normalize-position] LOVABLE_API_KEY not configured, skipping embedding');
    return null;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: [text],
      }),
    });

    if (!response.ok) {
      console.error(`[normalize-position] Embedding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('[normalize-position] Error generating embedding:', error);
    return null;
  }
}

// NEW: Find match using embedding similarity
async function findEmbeddingMatch(
  supabase: SupabaseClient,
  embedding: number[],
  serviceDomain: string,
  matchType: 'service' | 'material'
): Promise<EmbeddingMatch | null> {
  const rpcName = matchType === 'service' ? 'match_services' : 'match_materials';
  
  const { data, error } = await supabase.rpc(rpcName, {
    query_embedding: JSON.stringify(embedding),
    match_threshold: EMBEDDING_SIMILARITY_THRESHOLD,
    match_count: 1,
    target_service_domain: serviceDomain
  });

  if (error) {
    console.error(`[normalize-position] Error in ${rpcName}:`, error);
    return null;
  }

  if (data && data.length > 0) {
    return data[0] as EmbeddingMatch;
  }

  return null;
}

// NEW: Save position embedding for future clustering
async function savePositionEmbedding(
  supabase: SupabaseClient,
  positionId: string,
  embedding: number[]
): Promise<void> {
  if (!positionId) return;
  
  try {
    await supabase
      .from('document_positions')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', positionId);
  } catch (error) {
    console.error('[normalize-position] Error saving position embedding:', error);
  }
}

// NEW: Kfz-Ersatzteil-Klassifikation
function classifyKfzPartType(text: string): 'oem' | 'aftermarket' | 'no_name' | null {
  const lowerText = text.toLowerCase();
  
  if (OEM_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'oem';
  }
  
  if (AFTERMARKET_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'aftermarket';
  }
  
  if (NO_NAME_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'no_name';
  }
  
  return null;
}

// NEW: Fahrzeugklasse erkennen
function detectVehicleClass(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [vehicleClass, keywords] of Object.entries(VEHICLE_CLASS_KEYWORDS)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      return vehicleClass;
    }
  }
  
  return null;
}

// NEW: Arbeitswerte (AW) extrahieren
function extractLaborUnits(text: string, unit?: string): number | null {
  const lowerText = text.toLowerCase();
  const lowerUnit = (unit || '').toLowerCase();
  
  if (lowerUnit === 'aw' || lowerUnit === 'arbeitswert' || lowerUnit === 'arbeitswerte') {
    const awMatch = lowerText.match(/(\d+(?:[.,]\d+)?)\s*(?:aw|arbeitswert)/i);
    if (awMatch) {
      return parseFloat(awMatch[1].replace(',', '.'));
    }
  }
  
  const awPattern = /(\d+(?:[.,]\d+)?)\s*(?:aw|arbeitswert|arbeitswerte)/i;
  const match = lowerText.match(awPattern);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  
  return null;
}

// NEW: Sonderleistung erkennen
function isSpecialService(text: string): boolean {
  const lowerText = text.toLowerCase();
  return SPECIAL_SERVICE_KEYWORDS.some(kw => lowerText.includes(kw));
}

// NEW: Position validieren
function validatePosition(
  rawText: string,
  quantity?: number,
  unit?: string,
  totalPrice?: number
): string[] {
  const warnings: string[] = [];
  
  if (quantity === undefined || quantity === null || quantity <= 0) {
    warnings.push('Keine Mengenangabe vorhanden');
  }
  
  if (!unit || unit.trim() === '') {
    warnings.push('Keine Einheit angegeben');
  }
  
  if (rawText.length < 5) {
    warnings.push('Beschreibung sehr kurz - möglicherweise unvollständig');
  }
  
  if (totalPrice === undefined || totalPrice === null) {
    warnings.push('Kein Preis angegeben');
  }
  
  if (totalPrice && totalPrice > 50000) {
    warnings.push('Auffällig hoher Positionswert - bitte prüfen');
  }
  
  return warnings;
}

// Step 1: Text preprocessing
function preprocessText(
  rawText: string,
  stopwords: Set<string>,
  synonyms: Map<string, { canonical: string; weight: number }>
): string {
  let text = rawText.toLowerCase();
  
  const umlautMap: Record<string, string> = {
    'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
    'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'
  };
  for (const [umlaut, replacement] of Object.entries(umlautMap)) {
    text = text.replace(new RegExp(umlaut, 'g'), replacement);
  }
  
  text = text.replace(/[^\w\s]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  
  const words = text.split(' ');
  const filteredWords = words.filter(w => w.length > 1 && !stopwords.has(w));
  
  const normalizedWords = filteredWords.map(w => {
    const synonym = synonyms.get(w);
    return synonym ? synonym.canonical : w;
  });
  
  return normalizedWords.join(' ');
}

// Step 2: Classification
function classifyPositionType(
  text: string,
  unit?: string
): 'arbeitszeit' | 'material' | 'ersatzteil' | 'pauschale' | 'sonstig' {
  const lowerText = text.toLowerCase();
  const lowerUnit = (unit || '').toLowerCase();
  
  const flatRateIndicators = ['pauschale', 'pauschal', 'anfahrt', 'kleinteile', 'entsorgung', 'psch'];
  if (flatRateIndicators.some(i => lowerText.includes(i) || lowerUnit.includes(i))) {
    return 'pauschale';
  }
  
  const partIndicators = [
    'ersatzteil', 'teil', 'oem', 'original', 'zubehoer', 'aftermarket',
    'bremsbelag', 'bremsscheibe', 'filter', 'riemen', 'kupplung', 'stossdaempfer',
    'batterie', 'zuendkerze', 'lampe', 'scheibenwischer', 'dichtung'
  ];
  if (partIndicators.some(i => lowerText.includes(i))) {
    return 'ersatzteil';
  }
  
  const laborIndicators = ['arbeit', 'stunde', 'std', 'montage', 'demontage', 'aw', 'arbeitswert', 'installation', 'einbau', 'ausbau'];
  if (laborIndicators.some(i => lowerText.includes(i) || lowerUnit.includes(i))) {
    return 'arbeitszeit';
  }
  
  const materialIndicators = ['material', 'lieferung', 'stueck', 'stk', 'kg', 'liter', 'm2', 'qm', 'farbe', 'kleber', 'silikon', 'oel', 'filter'];
  if (materialIndicators.some(i => lowerText.includes(i) || lowerUnit.includes(i))) {
    return 'material';
  }
  
  return 'sonstig';
}

// Step 3: Calculate match score (keyword-based fallback)
function calculateMatchScore(
  cleanedText: string,
  keywords: string[] | null,
  synonyms: Map<string, { canonical: string; weight: number }>
): { score: number; matchedKeywords: string[] } {
  if (!keywords || keywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }
  
  const textWords = cleanedText.split(' ');
  const matchedKeywords: string[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;
  
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase();
    const synonymInfo = synonyms.get(normalizedKeyword);
    const weight = synonymInfo?.weight || 1.0;
    totalWeight += weight;
    
    if (textWords.includes(normalizedKeyword)) {
      matchedWeight += weight;
      matchedKeywords.push(keyword);
      continue;
    }
    
    const partialMatch = textWords.find(w => 
      (w.length > 3 && w.includes(normalizedKeyword)) || 
      (normalizedKeyword.length > 3 && normalizedKeyword.includes(w))
    );
    
    if (partialMatch) {
      matchedWeight += weight * 0.7;
      matchedKeywords.push(keyword);
    }
  }
  
  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return { score, matchedKeywords };
}

// Step 4: Find best match among services or materials (keyword-based fallback)
function findBestMatch<T extends { id: string; name: string; keywords: string[] | null }>(
  cleanedText: string,
  items: T[],
  synonyms: Map<string, { canonical: string; weight: number }>
): { item: T | null; score: number; matchedKeywords: string[] } {
  let bestItem: T | null = null;
  let bestScore = 0;
  let bestKeywords: string[] = [];
  
  for (const item of items) {
    const { score, matchedKeywords } = calculateMatchScore(cleanedText, item.keywords, synonyms);
    
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
      bestKeywords = matchedKeywords;
    }
  }
  
  return { item: bestItem, score: bestScore, matchedKeywords: bestKeywords };
}

// Step 5: Learn from normalization
async function learnFromNormalization(
  supabase: SupabaseClient,
  rawText: string,
  cleanedText: string,
  serviceDomain: string,
  positionType: string,
  normalizedServiceId: string | null,
  normalizedMaterialId: string | null,
  confidenceScore: number
): Promise<void> {
  try {
    const { data } = await supabase
      .from('text_normalizations')
      .select('id, match_count')
      .eq('cleaned_text', cleanedText)
      .eq('service_domain', serviceDomain)
      .limit(1);
    
    const existing = data && data.length > 0 ? data[0] as ExistingNormalization : null;
    
    if (existing) {
      await supabase
        .from('text_normalizations')
        .update({ 
          match_count: existing.match_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('text_normalizations')
        .insert({
          raw_text: rawText,
          cleaned_text: cleanedText,
          service_domain: serviceDomain,
          position_type: positionType,
          normalized_service_id: normalizedServiceId,
          normalized_material_id: normalizedMaterialId,
          confidence_score: confidenceScore
        });
    }
  } catch (error) {
    console.error('Error learning from normalization:', error);
  }
}

// Main normalization function with HYBRID MATCHING
async function normalizePosition(
  supabase: SupabaseClient,
  input: NormalizationInput
): Promise<NormalizationResult> {
  console.log(`[normalize-position] Processing: "${input.raw_text}" (${input.service_domain})`);
  
  // Phase 4: Validate input
  const validationWarnings = validatePosition(
    input.raw_text,
    input.quantity,
    input.unit,
    input.total_price
  );
  
  // Check for special services
  const isSpecial = isSpecialService(input.raw_text);
  
  // Load reference data
  const [stopwords, synonyms, services, materials] = await Promise.all([
    loadStopwords(supabase),
    loadSynonyms(supabase, input.service_domain),
    loadNormalizedServices(supabase, input.service_domain),
    loadNormalizedMaterials(supabase, input.service_domain)
  ]);
  
  // Step 1: Preprocess text
  const cleanedText = preprocessText(input.raw_text, stopwords, synonyms);
  console.log(`[normalize-position] Cleaned: "${cleanedText}"`);
  
  // Step 2: Classify position type
  const positionType = classifyPositionType(cleanedText, input.unit);
  
  // Phase 3: Kfz-specific classification
  let kfzPartType: 'oem' | 'aftermarket' | 'no_name' | null = null;
  let laborUnitsAw: number | null = null;
  let vehicleClass: string | null = null;
  
  if (input.service_domain === 'werkstatt') {
    if (positionType === 'ersatzteil' || positionType === 'material') {
      kfzPartType = classifyKfzPartType(input.raw_text);
    }
    if (positionType === 'arbeitszeit') {
      laborUnitsAw = extractLaborUnits(input.raw_text, input.unit);
    }
    vehicleClass = detectVehicleClass(input.raw_text);
  }
  
  // ========================================
  // HYBRID MATCHING: 1. Learned → 2. Embedding → 3. Keyword
  // ========================================
  
  let normalizedServiceId: string | null = null;
  let normalizedServiceName: string | null = null;
  let normalizedMaterialId: string | null = null;
  let normalizedMaterialName: string | null = null;
  let confidenceScore = 0;
  let matchMethod: 'embedding' | 'keyword' | 'learned' | 'none' = 'none';
  let matchedKeywords: string[] = [];
  let embeddingSimilarity: number | undefined;
  
  // === STRATEGY 1: Check learned normalizations first ===
  const learned = await findLearnedNormalization(supabase, cleanedText, input.service_domain);
  if (learned && learned.confidence_score >= CONFIDENCE_THRESHOLD) {
    console.log(`[normalize-position] ✓ Using LEARNED match (confidence: ${learned.confidence_score})`);
    
    if (learned.normalized_service_id) {
      const service = services.find(s => s.id === learned.normalized_service_id);
      normalizedServiceId = learned.normalized_service_id;
      normalizedServiceName = service?.name || null;
    }
    if (learned.normalized_material_id) {
      const material = materials.find(m => m.id === learned.normalized_material_id);
      normalizedMaterialId = learned.normalized_material_id;
      normalizedMaterialName = material?.name || null;
    }
    confidenceScore = learned.confidence_score;
    matchMethod = 'learned';
  }
  
  // === STRATEGY 2: Try embedding-based matching ===
  if (matchMethod === 'none') {
    console.log(`[normalize-position] 🔍 Trying EMBEDDING match...`);
    
    const embedding = await generateEmbedding(cleanedText);
    
    if (embedding) {
      // Save embedding for position clustering
      if (input.position_id) {
        await savePositionEmbedding(supabase, input.position_id, embedding);
      }
      
      // Determine what to search based on position type
      let embeddingMatch: EmbeddingMatch | null = null;
      
      if (positionType === 'arbeitszeit' || positionType === 'pauschale') {
        embeddingMatch = await findEmbeddingMatch(supabase, embedding, input.service_domain, 'service');
      } else if (positionType === 'material' || positionType === 'ersatzteil') {
        embeddingMatch = await findEmbeddingMatch(supabase, embedding, input.service_domain, 'material');
      } else {
        // Try both for 'sonstig'
        const serviceMatch = await findEmbeddingMatch(supabase, embedding, input.service_domain, 'service');
        const materialMatch = await findEmbeddingMatch(supabase, embedding, input.service_domain, 'material');
        
        if (serviceMatch && materialMatch) {
          embeddingMatch = serviceMatch.similarity >= materialMatch.similarity ? serviceMatch : materialMatch;
        } else {
          embeddingMatch = serviceMatch || materialMatch;
        }
      }
      
      if (embeddingMatch && embeddingMatch.similarity >= EMBEDDING_SIMILARITY_THRESHOLD) {
        console.log(`[normalize-position] ✓ EMBEDDING match: ${embeddingMatch.name} (similarity: ${embeddingMatch.similarity.toFixed(3)})`);
        
        // Determine if it's a service or material match
        if (positionType === 'arbeitszeit' || positionType === 'pauschale' || positionType === 'sonstig') {
          // Check if this is a service
          const isService = services.some(s => s.id === embeddingMatch!.id);
          if (isService) {
            normalizedServiceId = embeddingMatch.id;
            normalizedServiceName = embeddingMatch.name;
          } else {
            normalizedMaterialId = embeddingMatch.id;
            normalizedMaterialName = embeddingMatch.name;
          }
        } else {
          normalizedMaterialId = embeddingMatch.id;
          normalizedMaterialName = embeddingMatch.name;
        }
        
        confidenceScore = Math.round(embeddingMatch.similarity * 100);
        matchMethod = 'embedding';
        embeddingSimilarity = embeddingMatch.similarity;
        matchedKeywords = embeddingMatch.keywords || [];
      }
    }
  }
  
  // === STRATEGY 3: Fallback to keyword matching ===
  if (matchMethod === 'none') {
    console.log(`[normalize-position] 📝 Fallback to KEYWORD match...`);
    
    let bestServiceMatch = { item: null as NormalizedService | null, score: 0, matchedKeywords: [] as string[] };
    let bestMaterialMatch = { item: null as NormalizedMaterial | null, score: 0, matchedKeywords: [] as string[] };
    
    if (positionType === 'arbeitszeit' || positionType === 'pauschale') {
      bestServiceMatch = findBestMatch(cleanedText, services, synonyms);
    } else if (positionType === 'material' || positionType === 'ersatzteil') {
      bestMaterialMatch = findBestMatch(cleanedText, materials, synonyms);
    } else {
      bestServiceMatch = findBestMatch(cleanedText, services, synonyms);
      bestMaterialMatch = findBestMatch(cleanedText, materials, synonyms);
    }
    
    const useService = bestServiceMatch.score >= bestMaterialMatch.score;
    const bestScore = useService ? bestServiceMatch.score : bestMaterialMatch.score;
    
    if (bestScore >= CONFIDENCE_THRESHOLD) {
      if (useService && bestServiceMatch.item) {
        normalizedServiceId = bestServiceMatch.item.id;
        normalizedServiceName = bestServiceMatch.item.name;
        matchedKeywords = bestServiceMatch.matchedKeywords;
      } else if (bestMaterialMatch.item) {
        normalizedMaterialId = bestMaterialMatch.item.id;
        normalizedMaterialName = bestMaterialMatch.item.name;
        matchedKeywords = bestMaterialMatch.matchedKeywords;
      }
      confidenceScore = bestScore;
      matchMethod = 'keyword';
      console.log(`[normalize-position] ✓ KEYWORD match: ${normalizedServiceName || normalizedMaterialName} (score: ${bestScore})`);
    } else {
      // No match found
      confidenceScore = bestScore;
      console.log(`[normalize-position] ✗ No match found (best score: ${bestScore})`);
    }
  }
  
  const normalized = confidenceScore >= CONFIDENCE_THRESHOLD;
  
  const result: NormalizationResult = {
    cleaned_text: cleanedText,
    position_type: positionType,
    normalized_service_id: normalizedServiceId,
    normalized_service_name: normalizedServiceName,
    normalized_material_id: normalizedMaterialId,
    normalized_material_name: normalizedMaterialName,
    confidence_score: confidenceScore,
    normalization_status: normalized ? 'normalized' : 'unmatched',
    matching_keywords: matchedKeywords,
    match_method: matchMethod,
    embedding_similarity: embeddingSimilarity,
    kfz_part_type: kfzPartType,
    labor_units_aw: laborUnitsAw,
    vehicle_class: vehicleClass,
    validation_warnings: validationWarnings,
    is_special_service: isSpecial
  };
  
  // Step 5: Learn from this normalization
  await learnFromNormalization(
    supabase,
    input.raw_text,
    cleanedText,
    input.service_domain,
    positionType,
    result.normalized_service_id,
    result.normalized_material_id,
    result.confidence_score
  );
  
  console.log(`[normalize-position] Result: ${result.normalization_status} via ${result.match_method} (${result.confidence_score}%)`);
  
  return result;
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    
    // Handle batch normalization
    if (Array.isArray(body.positions)) {
      const results: NormalizationResult[] = [];
      
      for (const position of body.positions) {
        const result = await normalizePosition(supabase, {
          raw_text: position.raw_text || position.beschreibung,
          service_domain: body.service_domain || 'handwerk',
          quantity: position.quantity || position.menge,
          unit: position.unit || position.einheit,
          total_price: position.total_price || position.gesamtpreis,
          position_id: position.id
        });
        results.push(result);
      }
      
      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle single normalization
    const input: NormalizationInput = {
      raw_text: body.raw_text || body.beschreibung,
      service_domain: body.service_domain || 'handwerk',
      quantity: body.quantity || body.menge,
      unit: body.unit || body.einheit,
      total_price: body.total_price || body.gesamtpreis,
      position_id: body.position_id
    };
    
    if (!input.raw_text) {
      return new Response(
        JSON.stringify({ error: 'raw_text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const result = await normalizePosition(supabase, input);
    
    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in normalize-position:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
