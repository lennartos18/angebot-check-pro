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

// Constants
const CONFIDENCE_THRESHOLD = 70;

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

// NEW: Kfz-Ersatzteil-Klassifikation
function classifyKfzPartType(text: string): 'oem' | 'aftermarket' | 'no_name' | null {
  const lowerText = text.toLowerCase();
  
  // Check OEM first (highest priority)
  if (OEM_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'oem';
  }
  
  // Check known aftermarket brands
  if (AFTERMARKET_KEYWORDS.some(kw => lowerText.includes(kw))) {
    return 'aftermarket';
  }
  
  // Check no-name indicators
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
  
  // Check if unit is AW
  if (lowerUnit === 'aw' || lowerUnit === 'arbeitswert' || lowerUnit === 'arbeitswerte') {
    // Try to extract number from unit context
    const awMatch = lowerText.match(/(\d+(?:[.,]\d+)?)\s*(?:aw|arbeitswert)/i);
    if (awMatch) {
      return parseFloat(awMatch[1].replace(',', '.'));
    }
  }
  
  // Look for AW pattern in text
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
  
  // Check for missing quantity
  if (quantity === undefined || quantity === null || quantity <= 0) {
    warnings.push('Keine Mengenangabe vorhanden');
  }
  
  // Check for missing unit
  if (!unit || unit.trim() === '') {
    warnings.push('Keine Einheit angegeben');
  }
  
  // Check for very short description
  if (rawText.length < 5) {
    warnings.push('Beschreibung sehr kurz - möglicherweise unvollständig');
  }
  
  // Check for missing price
  if (totalPrice === undefined || totalPrice === null) {
    warnings.push('Kein Preis angegeben');
  }
  
  // Check for suspiciously high values
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
  // Lowercase
  let text = rawText.toLowerCase();
  
  // Replace German umlauts for consistent matching
  const umlautMap: Record<string, string> = {
    'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss',
    'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue'
  };
  for (const [umlaut, replacement] of Object.entries(umlautMap)) {
    text = text.replace(new RegExp(umlaut, 'g'), replacement);
  }
  
  // Remove special characters, keep alphanumeric and spaces
  text = text.replace(/[^\w\s]/g, ' ');
  
  // Remove multiple spaces
  text = text.replace(/\s+/g, ' ').trim();
  
  // Split into words
  const words = text.split(' ');
  
  // Filter stopwords
  const filteredWords = words.filter(w => w.length > 1 && !stopwords.has(w));
  
  // Apply synonyms (replace with canonical term)
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
  
  // Flat rate indicators (check first)
  const flatRateIndicators = ['pauschale', 'pauschal', 'anfahrt', 'kleinteile', 'entsorgung', 'psch'];
  if (flatRateIndicators.some(i => lowerText.includes(i) || lowerUnit.includes(i))) {
    return 'pauschale';
  }
  
  // Spare part indicators (automotive specific) - enhanced
  const partIndicators = [
    'ersatzteil', 'teil', 'oem', 'original', 'zubehoer', 'aftermarket',
    'bremsbelag', 'bremsscheibe', 'filter', 'riemen', 'kupplung', 'stossdaempfer',
    'batterie', 'zuendkerze', 'lampe', 'scheibenwischer', 'dichtung'
  ];
  if (partIndicators.some(i => lowerText.includes(i))) {
    return 'ersatzteil';
  }
  
  // Labor indicators
  const laborIndicators = ['arbeit', 'stunde', 'std', 'montage', 'demontage', 'aw', 'arbeitswert', 'installation', 'einbau', 'ausbau'];
  if (laborIndicators.some(i => lowerText.includes(i) || lowerUnit.includes(i))) {
    return 'arbeitszeit';
  }
  
  // Material indicators
  const materialIndicators = ['material', 'lieferung', 'stueck', 'stk', 'kg', 'liter', 'm2', 'qm', 'farbe', 'kleber', 'silikon', 'oel', 'filter'];
  if (materialIndicators.some(i => lowerText.includes(i) || lowerUnit.includes(i))) {
    return 'material';
  }
  
  return 'sonstig';
}

// Step 3: Calculate match score
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
    
    // Check for exact match
    if (textWords.includes(normalizedKeyword)) {
      matchedWeight += weight;
      matchedKeywords.push(keyword);
      continue;
    }
    
    // Check for partial match (substring)
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

// Step 4: Find best match among services or materials
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
    // Check if entry exists
    const { data } = await supabase
      .from('text_normalizations')
      .select('id, match_count')
      .eq('cleaned_text', cleanedText)
      .eq('service_domain', serviceDomain)
      .limit(1);
    
    const existing = data && data.length > 0 ? data[0] as ExistingNormalization : null;
    
    if (existing) {
      // Increment match count
      await supabase
        .from('text_normalizations')
        .update({ 
          match_count: existing.match_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new entry
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

// Main normalization function
async function normalizePosition(
  supabase: SupabaseClient,
  input: NormalizationInput
): Promise<NormalizationResult> {
  console.log(`Normalizing: "${input.raw_text}" (${input.service_domain})`);
  
  // Phase 4: Validate input
  const validationWarnings = validatePosition(
    input.raw_text,
    input.quantity,
    input.unit,
    input.total_price
  );
  
  if (validationWarnings.length > 0) {
    console.log(`Validation warnings: ${validationWarnings.join(', ')}`);
  }
  
  // Check for special services
  const isSpecial = isSpecialService(input.raw_text);
  if (isSpecial) {
    console.log('Detected special service (Notdienst/Sonderanfertigung)');
  }
  
  // Load reference data
  const [stopwords, synonyms, services, materials] = await Promise.all([
    loadStopwords(supabase),
    loadSynonyms(supabase, input.service_domain),
    loadNormalizedServices(supabase, input.service_domain),
    loadNormalizedMaterials(supabase, input.service_domain)
  ]);
  
  // Step 1: Preprocess text
  const cleanedText = preprocessText(input.raw_text, stopwords, synonyms);
  console.log(`Cleaned text: "${cleanedText}"`);
  
  // Step 2: Classify position type
  const positionType = classifyPositionType(cleanedText, input.unit);
  console.log(`Position type: ${positionType}`);
  
  // Phase 3: Kfz-specific classification
  let kfzPartType: 'oem' | 'aftermarket' | 'no_name' | null = null;
  let laborUnitsAw: number | null = null;
  let vehicleClass: string | null = null;
  
  if (input.service_domain === 'werkstatt') {
    // Classify part type for materials/parts
    if (positionType === 'ersatzteil' || positionType === 'material') {
      kfzPartType = classifyKfzPartType(input.raw_text);
      console.log(`Kfz part type: ${kfzPartType || 'unknown'}`);
    }
    
    // Extract labor units for labor positions
    if (positionType === 'arbeitszeit') {
      laborUnitsAw = extractLaborUnits(input.raw_text, input.unit);
      if (laborUnitsAw) {
        console.log(`Labor units (AW): ${laborUnitsAw}`);
      }
    }
    
    // Detect vehicle class
    vehicleClass = detectVehicleClass(input.raw_text);
    if (vehicleClass) {
      console.log(`Vehicle class: ${vehicleClass}`);
    }
  }
  
  // Check for learned normalization first
  const learned = await findLearnedNormalization(supabase, cleanedText, input.service_domain);
  if (learned && learned.confidence_score >= CONFIDENCE_THRESHOLD) {
    console.log(`Using learned normalization with confidence ${learned.confidence_score}`);
    
    // Get names for response
    let serviceName: string | null = null;
    let materialName: string | null = null;
    
    if (learned.normalized_service_id) {
      const service = services.find(s => s.id === learned.normalized_service_id);
      serviceName = service?.name || null;
    }
    if (learned.normalized_material_id) {
      const material = materials.find(m => m.id === learned.normalized_material_id);
      materialName = material?.name || null;
    }
    
    return {
      cleaned_text: cleanedText,
      position_type: learned.position_type as NormalizationResult['position_type'],
      normalized_service_id: learned.normalized_service_id,
      normalized_service_name: serviceName,
      normalized_material_id: learned.normalized_material_id,
      normalized_material_name: materialName,
      confidence_score: learned.confidence_score,
      normalization_status: 'normalized',
      matching_keywords: [],
      kfz_part_type: kfzPartType,
      labor_units_aw: laborUnitsAw,
      vehicle_class: vehicleClass,
      validation_warnings: validationWarnings,
      is_special_service: isSpecial
    };
  }
  
  // Step 3 & 4: Find best matches
  let bestServiceMatch = { item: null as NormalizedService | null, score: 0, matchedKeywords: [] as string[] };
  let bestMaterialMatch = { item: null as NormalizedMaterial | null, score: 0, matchedKeywords: [] as string[] };
  
  // Match based on position type
  if (positionType === 'arbeitszeit' || positionType === 'pauschale') {
    bestServiceMatch = findBestMatch(cleanedText, services, synonyms);
  } else if (positionType === 'material' || positionType === 'ersatzteil') {
    bestMaterialMatch = findBestMatch(cleanedText, materials, synonyms);
  } else {
    // For 'sonstig', try both
    bestServiceMatch = findBestMatch(cleanedText, services, synonyms);
    bestMaterialMatch = findBestMatch(cleanedText, materials, synonyms);
  }
  
  // Determine best overall match
  const useService = bestServiceMatch.score >= bestMaterialMatch.score;
  const bestScore = useService ? bestServiceMatch.score : bestMaterialMatch.score;
  const matchedKeywords = useService ? bestServiceMatch.matchedKeywords : bestMaterialMatch.matchedKeywords;
  
  console.log(`Best service match: ${bestServiceMatch.item?.name || 'none'} (${bestServiceMatch.score}%)`);
  console.log(`Best material match: ${bestMaterialMatch.item?.name || 'none'} (${bestMaterialMatch.score}%)`);
  
  // Apply threshold
  const normalized = bestScore >= CONFIDENCE_THRESHOLD;
  
  const result: NormalizationResult = {
    cleaned_text: cleanedText,
    position_type: positionType,
    normalized_service_id: normalized && useService ? bestServiceMatch.item?.id || null : null,
    normalized_service_name: normalized && useService ? bestServiceMatch.item?.name || null : null,
    normalized_material_id: normalized && !useService ? bestMaterialMatch.item?.id || null : null,
    normalized_material_name: normalized && !useService ? bestMaterialMatch.item?.name || null : null,
    confidence_score: bestScore,
    normalization_status: normalized ? 'normalized' : 'unmatched',
    matching_keywords: matchedKeywords,
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
  
  return result;
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS
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
