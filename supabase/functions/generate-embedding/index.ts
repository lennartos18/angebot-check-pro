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
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const body: EmbeddingRequest = await req.json();
    
    if (!body.text) {
      return new Response(
        JSON.stringify({ success: false, error: 'text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize input to array
    const texts = Array.isArray(body.text) ? body.text : [body.text];
    
    // Validate text lengths (max ~8000 tokens per text)
    const maxLength = 32000; // ~8000 tokens * 4 chars
    const validTexts = texts.map(t => t.slice(0, maxLength));

    console.log(`[generate-embedding] Generating embeddings for ${validTexts.length} text(s)`);

    // Call Lovable AI Gateway for embeddings
    const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: validTexts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-embedding] API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Payment required, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract embeddings from response
    // OpenAI format: { data: [{ embedding: [...], index: 0 }, ...], usage: {...} }
    const embeddings: number[][] = data.data
      .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
      .map((item: { embedding: number[] }) => item.embedding);

    console.log(`[generate-embedding] ✓ Generated ${embeddings.length} embedding(s), dim=${embeddings[0]?.length || 0}`);

    const result: EmbeddingResponse = {
      success: true,
      embeddings: embeddings,
      embedding: embeddings.length === 1 ? embeddings[0] : undefined,
      model: 'text-embedding-3-small',
      usage: data.usage,
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
