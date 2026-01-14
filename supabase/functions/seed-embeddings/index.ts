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

// Simple string hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Enhanced semantic embedding using word-level similarity features
function createSemanticEmbedding(text: string): number[] {
  const normalized = text.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = normalized.split(' ').filter(w => w.length > 1);
  const embedding = new Array(512).fill(0);
  
  // Character trigram features (captures spelling similarities)
  const trigrams = new Set<string>();
  for (const word of words) {
    for (let i = 0; i <= word.length - 3; i++) {
      trigrams.add(word.substring(i, i + 3));
    }
  }
  
  for (const trigram of trigrams) {
    const idx = hashString(trigram) % 256;
    embedding[idx] += 1;
  }
  
  // Word presence features
  for (const word of words) {
    const idx = 256 + (hashString(word) % 256);
    embedding[idx] += 1;
  }
  
  // Common automotive/construction term boosting
  const domainTerms: Record<string, number[]> = {
    'oel': [0, 1, 2],
    'oil': [0, 1, 2],
    'filter': [3, 4, 5],
    'wechsel': [6, 7, 8],
    'wechseln': [6, 7, 8],
    'austausch': [6, 7, 8],
    'motor': [9, 10, 11],
    'bremse': [12, 13, 14],
    'brems': [12, 13, 14],
    'farbe': [15, 16, 17],
    'streichen': [18, 19, 20],
    'anstrich': [18, 19, 20],
    'montage': [21, 22, 23],
    'montieren': [21, 22, 23],
    'einbau': [21, 22, 23],
    'reparatur': [24, 25, 26],
    'reparieren': [24, 25, 26],
    'service': [27, 28, 29],
    'wartung': [27, 28, 29],
    'inspektion': [27, 28, 29],
  };
  
  for (const word of words) {
    const indices = domainTerms[word];
    if (indices) {
      for (const idx of indices) {
        embedding[idx] += 2;
      }
    }
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
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
        const embedding = createSemanticEmbedding(text);
        
        // Convert to string format for pgvector
        const embeddingStr = `[${embedding.join(',')}]`;
        
        const { error: updateError } = await supabase
          .from('normalized_services')
          .update({ embedding: embeddingStr })
          .eq('id', service.id);
        
        if (updateError) {
          result.errors.push(`Error updating service ${service.id}: ${updateError.message}`);
        } else {
          result.services_updated++;
          console.log(`[seed-embeddings] ✓ Service: ${service.name}`);
        }
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
        const embedding = createSemanticEmbedding(text);
        
        // Convert to string format for pgvector
        const embeddingStr = `[${embedding.join(',')}]`;
        
        const { error: updateError } = await supabase
          .from('normalized_materials')
          .update({ embedding: embeddingStr })
          .eq('id', material.id);
        
        if (updateError) {
          result.errors.push(`Error updating material ${material.id}: ${updateError.message}`);
        } else {
          result.materials_updated++;
          console.log(`[seed-embeddings] ✓ Material: ${material.name}`);
        }
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
