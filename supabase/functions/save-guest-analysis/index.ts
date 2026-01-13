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

// Anonymize text by hashing
function anonymizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  // Simple hash for anonymization
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `anon_${Math.abs(hash).toString(16)}`;
}

// Generate time bucket (e.g., "2025-Q1")
function generateTimeBucket(date: Date): string {
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `${year}-Q${quarter}`;
}

// Determine position type based on content
function determinePositionType(position: Position): string {
  if (position.material && position.material.trim() !== '') {
    return 'material';
  }
  return 'arbeitszeit';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { session_id, analysis_data }: RequestBody = await req.json();
    
    console.log(`[save-guest-analysis] Saving analysis for session: ${session_id}`);
    console.log(`[save-guest-analysis] Documents to save: ${analysis_data.documents?.length || 0}`);
    
    if (!session_id || !analysis_data) {
      return new Response(
        JSON.stringify({ error: 'session_id und analysis_data erforderlich' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get region cluster from PLZ
    let regionClusterId: string | null = null;
    if (analysis_data.plz) {
      const { data: regionData } = await supabase
        .rpc('get_region_cluster_id', { plz: analysis_data.plz });
      regionClusterId = regionData;
      console.log(`[save-guest-analysis] Region cluster for PLZ ${analysis_data.plz}: ${regionClusterId}`);
    }
    
    const timeBucket = generateTimeBucket(new Date());
    const savedDocuments: string[] = [];
    const savedPositions: string[] = [];
    
    // Process each document
    for (const doc of analysis_data.documents || []) {
      console.log(`[save-guest-analysis] Processing document: ${doc.title}`);
      
      // Create anonymized document entry
      const { data: documentData, error: documentError } = await supabase
        .from('documents')
        .insert({
          document_type: doc.document_type || 'angebot',
          service_domain: doc.service_domain || 'handwerk',
          submission_date: new Date().toISOString().split('T')[0],
          time_bucket: timeBucket,
          region_cluster_id: regionClusterId,
          total_gross_amount: doc.gesamtpreis,
          anonymized_provider_id: anonymizeText(doc.title),
          position_count: doc.positionen?.length || 0,
          currency: 'EUR'
        })
        .select('id')
        .single();
      
      if (documentError) {
        console.error(`[save-guest-analysis] Error saving document: ${documentError.message}`);
        continue;
      }
      
      const documentId = documentData.id;
      savedDocuments.push(documentId);
      console.log(`[save-guest-analysis] Saved document with ID: ${documentId}`);
      
      // Save each position anonymized
      for (const position of doc.positionen || []) {
        const positionType = determinePositionType(position);
        
        const { data: positionData, error: positionError } = await supabase
          .from('document_positions')
          .insert({
            document_id: documentId,
            position_type: positionType,
            raw_text: position.beschreibung,
            quantity: position.menge,
            unit: position.einheit,
            unit_price: position.einzelpreis,
            total_price: position.gesamtpreis,
            region_cluster_id: regionClusterId,
            time_bucket: timeBucket,
            service_domain: doc.service_domain || 'handwerk',
            comparison_eligible: true,
            normalization_status: 'pending'
          })
          .select('id')
          .single();
        
        if (positionError) {
          console.error(`[save-guest-analysis] Error saving position: ${positionError.message}`);
          continue;
        }
        
        savedPositions.push(positionData.id);
      }
    }
    
    console.log(`[save-guest-analysis] Successfully saved ${savedDocuments.length} documents and ${savedPositions.length} positions`);
    
    // Update guest session with reference to saved documents
    const { error: updateError } = await supabase
      .from('guest_sessions')
      .update({
        documents_json: {
          saved_document_ids: savedDocuments,
          saved_position_ids: savedPositions,
          saved_at: new Date().toISOString()
        }
      })
      .eq('id', session_id);
    
    if (updateError) {
      console.error(`[save-guest-analysis] Error updating session: ${updateError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        saved_documents: savedDocuments.length,
        saved_positions: savedPositions.length,
        message: `${savedDocuments.length} Dokumente und ${savedPositions.length} Positionen anonymisiert gespeichert`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('[save-guest-analysis] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
