import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmbeddingRequest {
  text: string | string[];
}

interface EmbeddingResponse {
  success: boolean;
  embeddings?: number[][];
  embedding?: number[];
  error?: string;
  model?: string;
}

// Simple hash-based embedding for semantic similarity
// This creates a deterministic 256-dimensional vector based on text content
function createSimpleEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  const embedding = new Array(256).fill(0);
  
  // Create hash-based features
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const charCode = word.charCodeAt(j);
      const idx = (charCode * (i + 1) * (j + 1)) % 256;
      embedding[idx] += 1 / (1 + j);
    }
    
    // N-gram features (bigrams)
    if (i < words.length - 1) {
      const bigram = words[i] + words[i + 1];
      const bigramHash = hashString(bigram) % 256;
      embedding[bigramHash] += 0.5;
    }
    
    // Word-level features
    const wordHash = hashString(word) % 256;
    embedding[wordHash] += 1;
  }
  
  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

// Simple string hash function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: EmbeddingRequest = await req.json();
    
    if (!body.text) {
      return new Response(
        JSON.stringify({ success: false, error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const texts = Array.isArray(body.text) ? body.text : [body.text];
    
    console.log(`[generate-embedding] Creating embeddings for ${texts.length} text(s)`);

    // Generate embeddings using our semantic embedding function
    const embeddings = texts.map(t => createSemanticEmbedding(t));

    console.log(`[generate-embedding] ✓ Generated ${embeddings.length} embedding(s), dim=${embeddings[0]?.length || 0}`);

    const result: EmbeddingResponse = {
      success: true,
      embeddings: embeddings,
      embedding: embeddings.length === 1 ? embeddings[0] : undefined,
      model: 'local-semantic-v1',
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-embedding] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
