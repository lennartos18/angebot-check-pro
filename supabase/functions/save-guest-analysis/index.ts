import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Position {
  beschreibung: string;
  material?: string;
  menge?: number;
  einheit?: string;
  einzelpreis?: number;
  gesamtpreis?: number;
  status?: string;
  einordnung_stufe?: string;
  einordnung_begruendung?: string;
  datengrundlage?: string;
  datenquelle?: string;
  marktpreis_min?: number;
  marktpreis_max?: number;
  marktpreis_durchschnitt?: number;
  abweichung_prozent?: number;
  unsicherheitshinweis?: string;
}

interface DocumentAnalysis {
  title: string;
  gesamtpreis?: number;
  plausibility_score?: number;
  analysis_summary?: string;
  service_domain?: string;
  document_type?: string;
  positionen: Position[];
  // Neue Felder für Anonymisierung
  handwerker_name?: string;
  handwerker_firma?: string;
  anbieter_adresse?: string;
}

interface AnalysisData {
  documents: DocumentAnalysis[];
  plz?: string;
  stadt?: string;
}

interface RequestBody {
  session_id: string;
  analysis_data: AnalysisData;
}

// SHA-256 Hash für bessere Anonymisierung (konsistent)
async function createAnonymizedHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `anon_${hashHex.substring(0, 16)}`;
}

// Content Hash für Duplikat-Erkennung
async function createContentHash(doc: DocumentAnalysis): Promise<string> {
  const content = JSON.stringify({
    positionen: doc.positionen?.map(p => ({
      beschreibung: p.beschreibung?.toLowerCase().trim(),
      menge: p.menge,
      gesamtpreis: p.gesamtpreis
    })),
    gesamtpreis: doc.gesamtpreis
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Legacy anonymize function (replaced by createAnonymizedHash)
function anonymizeTextSync(text: string | null | undefined): string | null {
  if (!text) return null;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `anon_${Math.abs(hash).toString(16)}`;
}

// Call normalize-position edge function
async function normalizePosition(
  supabaseUrl: string,
  supabaseKey: string,
  positionId: string,
  rawText: string,
  serviceDomain: string,
  quantity?: number,
  unit?: string,
  totalPrice?: number
): Promise<{
  normalized_service_id: string | null;
  normalized_material_id: string | null;
  normalization_confidence: number;
  normalization_status: string;
} | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/normalize-position`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        raw_text: rawText,
        service_domain: serviceDomain,
        quantity,
        unit,
        total_price: totalPrice,
        position_id: positionId
      })
    });
    
    if (!response.ok) {
      console.error(`[normalize-position] Failed: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    return {
      normalized_service_id: result.normalized_service_id || null,
      normalized_material_id: result.normalized_material_id || null,
      normalization_confidence: result.confidence_score || 0,
      normalization_status: result.normalization_status || 'pending'
    };
  } catch (error) {
    console.error('[normalize-position] Error:', error);
    return null;
  }
}

// Generate time bucket (e.g., "2025-Q1")
function generateTimeBucket(date: Date): string {
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `${year}-Q${quarter}`;
}

// Determine position type based on content
function determinePositionType(position: Position): 'arbeitszeit' | 'material' | 'ersatzteil' | 'pauschale' | 'sonstig' {
  const desc = (position.beschreibung || '').toLowerCase();
  const material = (position.material || '').toLowerCase();
  const unit = (position.einheit || '').toLowerCase();
  
  // Pauschale indicators
  const pauschaleKeywords = ['pauschale', 'psch', 'pauschal', 'komplett', 'gesamt'];
  
  // Ersatzteil indicators (Kfz-spezifisch)
  const ersatzteilKeywords = ['filter', 'öl', 'oel', 'beläge', 'belaege', 'scheiben', 'dämpfer', 'daempfer', 'teile', 'original', 'oem'];
  
  // Material indicators
  const materialKeywords = ['liefern', 'material', 'stück', 'stk', 'meter', 'kg', 'liter', 'packung', 'satz', 'set'];
  
  // Labor indicators  
  const laborKeywords = ['arbeit', 'stunde', 'std', 'montage', 'installation', 'demontage', 'reparatur', 'wartung', 'prüfung', 'wechseln', 'austauschen', 'erneuern'];
  
  // Check for pauschale first
  for (const keyword of pauschaleKeywords) {
    if (desc.includes(keyword) || unit.includes(keyword)) return 'pauschale';
  }
  
  // Check for ersatzteil
  if (material && material.trim() !== '') {
    for (const keyword of ersatzteilKeywords) {
      if (material.includes(keyword)) return 'ersatzteil';
    }
    return 'material';
  }
  
  // Check for ersatzteil in description
  for (const keyword of ersatzteilKeywords) {
    if (desc.includes(keyword) && !desc.includes('wechsel') && !desc.includes('austausch')) {
      return 'ersatzteil';
    }
  }
  
  // Check for material
  for (const keyword of materialKeywords) {
    if (desc.includes(keyword)) return 'material';
  }
  
  // Check for arbeitszeit
  for (const keyword of laborKeywords) {
    if (desc.includes(keyword)) return 'arbeitszeit';
  }
  
  return 'sonstig';
}

// Map service domain to gewerk
function mapServiceDomainToGewerk(serviceDomain: string): string {
  const mapping: Record<string, string> = {
    'sanitär': 'Sanitär/Heizung',
    'heizung': 'Sanitär/Heizung',
    'elektro': 'Elektro',
    'elektriker': 'Elektro',
    'maler': 'Maler/Lackierer',
    'lackierer': 'Maler/Lackierer',
    'dachdecker': 'Dachdecker',
    'zimmerer': 'Zimmerer',
    'tischler': 'Tischler/Schreiner',
    'schreiner': 'Tischler/Schreiner',
    'fliesenleger': 'Fliesenleger',
    'maurer': 'Maurer',
    'kfz': 'KFZ-Werkstatt',
    'auto': 'KFZ-Werkstatt',
    'werkstatt': 'KFZ-Werkstatt',
    'handwerk': 'Allgemeines Handwerk'
  };
  
  const lower = (serviceDomain || 'handwerk').toLowerCase();
  for (const [key, value] of Object.entries(mapping)) {
    if (lower.includes(key)) return value;
  }
  return 'Allgemeines Handwerk';
}

Deno.serve(async (req) => {
  console.log('[save-guest-analysis] ========== REQUEST START ==========');
  console.log('[save-guest-analysis] Method:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[save-guest-analysis] Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[save-guest-analysis] Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    console.log('[save-guest-analysis] Request body keys:', Object.keys(body));
    
    const { session_id, analysis_data }: RequestBody = body;
    
    console.log('[save-guest-analysis] Session ID:', session_id);
    console.log('[save-guest-analysis] Has analysis_data:', !!analysis_data);
    console.log('[save-guest-analysis] Documents count:', analysis_data?.documents?.length || 0);
    console.log('[save-guest-analysis] PLZ:', analysis_data?.plz);
    console.log('[save-guest-analysis] Stadt:', analysis_data?.stadt);
    
    if (!session_id) {
      console.error('[save-guest-analysis] Missing session_id');
      return new Response(
        JSON.stringify({ error: 'session_id ist erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!analysis_data || !analysis_data.documents || analysis_data.documents.length === 0) {
      console.error('[save-guest-analysis] Missing or empty analysis_data');
      return new Response(
        JSON.stringify({ error: 'analysis_data mit mindestens einem Dokument erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify session exists
    const { data: sessionData, error: sessionError } = await supabase
      .from('guest_sessions')
      .select('id')
      .eq('id', session_id)
      .maybeSingle();
    
    if (sessionError) {
      console.error('[save-guest-analysis] Session lookup error:', sessionError);
    }
    
    if (!sessionData) {
      console.warn('[save-guest-analysis] Session not found, but continuing with save');
    } else {
      console.log('[save-guest-analysis] Session verified:', sessionData.id);
    }
    
    // Get region cluster from PLZ with fallback
    let regionClusterId: string | null = null;
    if (analysis_data.plz && analysis_data.plz.length >= 2) {
      // Try to get region cluster
      const { data: regionData, error: regionError } = await supabase
        .rpc('get_region_cluster_id', { plz: analysis_data.plz });
      
      if (regionError) {
        console.warn('[save-guest-analysis] Region lookup error:', regionError.message);
      } else {
        regionClusterId = regionData;
      }
      
      // If no cluster found, try to create one or find by prefix
      if (!regionClusterId) {
        const plzPrefix = analysis_data.plz.substring(0, 2);
        console.log('[save-guest-analysis] No region cluster found, trying prefix:', plzPrefix);
        
        const { data: clusterByPrefix } = await supabase
          .from('region_clusters')
          .select('id')
          .eq('plz_prefix', plzPrefix)
          .maybeSingle();
        
        if (clusterByPrefix) {
          regionClusterId = clusterByPrefix.id;
        }
      }
      
      console.log('[save-guest-analysis] Region cluster for PLZ', analysis_data.plz, ':', regionClusterId || 'NOT_FOUND');
    }
    
    const timeBucket = generateTimeBucket(new Date());
    const savedDocuments: string[] = [];
    const savedPositions: string[] = [];
    const errors: string[] = [];
    
    // Process each document
    for (let docIndex = 0; docIndex < analysis_data.documents.length; docIndex++) {
      const doc = analysis_data.documents[docIndex];
      console.log(`[save-guest-analysis] Processing document ${docIndex + 1}/${analysis_data.documents.length}: ${doc.title}`);
      console.log(`[save-guest-analysis] - Gesamtpreis: ${doc.gesamtpreis}`);
      console.log(`[save-guest-analysis] - Positionen count: ${doc.positionen?.length || 0}`);
      console.log(`[save-guest-analysis] - Service domain: ${doc.service_domain}`);
      
      const serviceDomain = doc.service_domain || 'handwerk';
      const gewerk = mapServiceDomainToGewerk(serviceDomain);
      
      // Create proper anonymized provider ID from firma/name
      const providerIdentifier = doc.handwerker_firma || doc.handwerker_name || doc.title || '';
      const anonymizedProviderId = await createAnonymizedHash(providerIdentifier);
      
      // Create content hash for duplicate detection
      const contentHash = await createContentHash(doc);
      
      // Check for duplicate document
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('content_hash', contentHash)
        .maybeSingle();
      
      if (existingDoc) {
        console.log(`[save-guest-analysis] ⚠️ Duplicate document detected, skipping: ${existingDoc.id}`);
        savedDocuments.push(existingDoc.id);
        continue;
      }
      
      // Create anonymized document entry
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          document_type: doc.document_type || 'angebot',
          service_domain: serviceDomain,
          submission_date: new Date().toISOString().split('T')[0],
          time_bucket: timeBucket,
          region_cluster_id: regionClusterId,
          total_gross_amount: doc.gesamtpreis || null,
          anonymized_provider_id: anonymizedProviderId,
          content_hash: contentHash,
          position_count: doc.positionen?.length || 0,
          currency: 'EUR'
        })
        .select('id')
        .single();
      
      if (documentError) {
        console.error(`[save-guest-analysis] Error saving document ${docIndex + 1}:`, documentError.message);
        errors.push(`Document ${docIndex + 1}: ${documentError.message}`);
        continue;
      }
      
      const documentId = documentData.id;
      savedDocuments.push(documentId);
      console.log(`[save-guest-analysis] ✓ Saved document with ID: ${documentId}, provider hash: ${anonymizedProviderId.substring(0, 20)}...`);
      
      // Get environment variables for normalize-position call
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      // Save each position anonymized and normalize
      const positions = doc.positionen || [];
      for (let posIndex = 0; posIndex < positions.length; posIndex++) {
        const position = positions[posIndex];
        const positionType = determinePositionType(position);
        
        console.log(`[save-guest-analysis]   Position ${posIndex + 1}: ${position.beschreibung?.substring(0, 50)}... (${positionType})`);
        
        const { data: positionData, error: positionError } = await supabase
          .from('document_positions')
          .insert({
            document_id: documentId,
            position_type: positionType,
            raw_text: position.beschreibung || 'Unbekannte Position',
            quantity: position.menge || null,
            unit: position.einheit || null,
            unit_price: position.einzelpreis || null,
            total_price: position.gesamtpreis || null,
            region_cluster_id: regionClusterId,
            time_bucket: timeBucket,
            service_domain: serviceDomain,
            comparison_eligible: true,
            normalization_status: 'pending'
          })
          .select('id')
          .single();
        
        if (positionError) {
          console.error(`[save-guest-analysis]   ✗ Error saving position ${posIndex + 1}:`, positionError.message);
          errors.push(`Position ${docIndex + 1}.${posIndex + 1}: ${positionError.message}`);
          continue;
        }
        
        savedPositions.push(positionData.id);
        console.log(`[save-guest-analysis]   ✓ Saved position with ID: ${positionData.id}`);
        
        // Call normalize-position to normalize and learn
        const normResult = await normalizePosition(
          supabaseUrl,
          supabaseServiceKey,
          positionData.id,
          position.beschreibung || '',
          serviceDomain,
          position.menge,
          position.einheit,
          position.gesamtpreis
        );
        
        if (normResult) {
          // Update position with normalization result
          const { error: updateError } = await supabase
            .from('document_positions')
            .update({
              normalized_service_id: normResult.normalized_service_id,
              normalized_material_id: normResult.normalized_material_id,
              normalization_confidence: normResult.normalization_confidence,
              normalization_status: normResult.normalization_status
            })
            .eq('id', positionData.id);
          
          if (updateError) {
            console.error(`[save-guest-analysis]   ⚠️ Normalization update failed:`, updateError.message);
          } else {
            console.log(`[save-guest-analysis]   ✓ Normalized: confidence=${normResult.normalization_confidence}%, status=${normResult.normalization_status}`);
          }
        }
      }
    }
    
    console.log('[save-guest-analysis] ========== SAVE SUMMARY ==========');
    console.log(`[save-guest-analysis] Saved documents: ${savedDocuments.length}`);
    console.log(`[save-guest-analysis] Saved positions: ${savedPositions.length}`);
    console.log(`[save-guest-analysis] Errors: ${errors.length}`);
    
    // Update guest session with reference to saved documents
    if (sessionData && savedDocuments.length > 0) {
      const { error: updateError } = await supabase
        .from('guest_sessions')
        .update({
          documents_json: {
            saved_document_ids: savedDocuments,
            saved_position_ids: savedPositions,
            saved_at: new Date().toISOString(),
            save_errors: errors.length > 0 ? errors : undefined
          }
        })
        .eq('id', session_id);
      
      if (updateError) {
        console.error('[save-guest-analysis] Error updating session:', updateError.message);
      } else {
        console.log('[save-guest-analysis] ✓ Session updated with saved document references');
      }
    }
    
    const response = {
      success: true,
      saved_documents: savedDocuments.length,
      saved_positions: savedPositions.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `${savedDocuments.length} Dokumente und ${savedPositions.length} Positionen anonymisiert gespeichert`,
      region_cluster_id: regionClusterId,
      time_bucket: timeBucket
    };
    
    console.log('[save-guest-analysis] ========== REQUEST END ==========');
    console.log('[save-guest-analysis] Response:', JSON.stringify(response));
    
    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('[save-guest-analysis] ========== UNEXPECTED ERROR ==========');
    console.error('[save-guest-analysis] Error type:', error?.constructor?.name);
    console.error('[save-guest-analysis] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[save-guest-analysis] Error stack:', error instanceof Error ? error.stack : 'N/A');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        saved_documents: 0,
        saved_positions: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
