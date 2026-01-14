import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SeedResult {
  success: boolean;
  services_updated: number;
  materials_updated: number;
  errors: string[];
}

// Generate embedding via our own function
async function generateEmbedding(text: string): Promise<number[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY not configured');
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
      console.error(`Embedding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Create rich text for embedding from service/material
function createEmbeddingText(name: string, keywords: string[] | null, domain: string): string {
  const keywordText = keywords?.join(' ') || '';
  return `${name} ${keywordText} ${domain}`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result: SeedResult = {
      success: true,
      services_updated: 0,
      materials_updated: 0,
      errors: [],
    };

    // Fetch all services without embeddings
    const { data: services, error: servicesError } = await supabase
      .from('normalized_services')
      .select('id, name, keywords, service_domain')
      .is('embedding', null);

    if (servicesError) {
      result.errors.push(`Error fetching services: ${servicesError.message}`);
    } else if (services && services.length > 0) {
      console.log(`[seed-embeddings] Processing ${services.length} services...`);
      
      for (const service of services) {
        const text = createEmbeddingText(service.name, service.keywords, service.service_domain);
        const embedding = await generateEmbedding(text);
        
        if (embedding) {
          const { error: updateError } = await supabase
            .from('normalized_services')
            .update({ embedding: JSON.stringify(embedding) })
            .eq('id', service.id);
          
          if (updateError) {
            result.errors.push(`Error updating service ${service.id}: ${updateError.message}`);
          } else {
            result.services_updated++;
            console.log(`[seed-embeddings] ✓ Service: ${service.name}`);
          }
        } else {
          result.errors.push(`Failed to generate embedding for service: ${service.name}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      console.log('[seed-embeddings] No services need embedding updates');
    }

    // Fetch all materials without embeddings
    const { data: materials, error: materialsError } = await supabase
      .from('normalized_materials')
      .select('id, name, keywords, service_domain')
      .is('embedding', null);

    if (materialsError) {
      result.errors.push(`Error fetching materials: ${materialsError.message}`);
    } else if (materials && materials.length > 0) {
      console.log(`[seed-embeddings] Processing ${materials.length} materials...`);
      
      for (const material of materials) {
        const text = createEmbeddingText(material.name, material.keywords, material.service_domain);
        const embedding = await generateEmbedding(text);
        
        if (embedding) {
          const { error: updateError } = await supabase
            .from('normalized_materials')
            .update({ embedding: JSON.stringify(embedding) })
            .eq('id', material.id);
          
          if (updateError) {
            result.errors.push(`Error updating material ${material.id}: ${updateError.message}`);
          } else {
            result.materials_updated++;
            console.log(`[seed-embeddings] ✓ Material: ${material.name}`);
          }
        } else {
          result.errors.push(`Failed to generate embedding for material: ${material.name}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      console.log('[seed-embeddings] No materials need embedding updates');
    }

    console.log(`[seed-embeddings] Complete: ${result.services_updated} services, ${result.materials_updated} materials updated`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[seed-embeddings] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
