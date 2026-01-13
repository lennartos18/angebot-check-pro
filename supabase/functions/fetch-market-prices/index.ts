import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketPriceResult {
  preis_min: number | null;
  preis_max: number | null;
  preis_durchschnitt: number | null;
  quellen: string[];
  gefunden: boolean;
  cache_hit: boolean;
}

interface PositionQuery {
  beschreibung: string;
  material?: string;
  gewerk?: string;
  kategorie: 'handwerk' | 'kfz';
  einheit?: string;
  menge?: number;
}

// Extract prices from text using regex patterns
function extractPricesFromText(text: string): number[] {
  const prices: number[] = [];
  
  // Match various price patterns: €123, 123€, 123,45€, 123.45 EUR, etc.
  const patterns = [
    /(\d{1,6}[.,]\d{2})\s*(?:€|EUR|Euro)/gi,
    /(?:€|EUR|Euro)\s*(\d{1,6}[.,]\d{2})/gi,
    /(\d{1,6})\s*(?:€|EUR|Euro)/gi,
    /(?:€|EUR|Euro)\s*(\d{1,6})/gi,
    /(\d{1,6}[.,]\d{2})\s*(?:pro|je|\/)\s*(?:Stück|Stk|m²|qm|lfm|Std|Stunde)/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const priceStr = match[1].replace(',', '.');
      const price = parseFloat(priceStr);
      if (price > 0 && price < 100000) { // Sanity check
        prices.push(price);
      }
    }
  }
  
  return [...new Set(prices)].sort((a, b) => a - b);
}

// Build search queries for different sources
function buildSearchQueries(position: PositionQuery): string[] {
  const queries: string[] = [];
  const baseTerms = position.beschreibung.toLowerCase();
  
  if (position.kategorie === 'kfz') {
    queries.push(`${baseTerms} Werkstatt Kosten Deutschland`);
    queries.push(`${baseTerms} Reparatur Preis`);
    if (position.material) {
      queries.push(`${position.material} Ersatzteil Preis`);
    }
  } else {
    queries.push(`${baseTerms} Handwerker Kosten Deutschland`);
    queries.push(`${baseTerms} Preis pro ${position.einheit || 'Stück'}`);
    if (position.gewerk) {
      queries.push(`${position.gewerk} ${baseTerms} Kosten`);
    }
  }
  
  return queries;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { positionen, kategorie } = await req.json() as { 
      positionen: PositionQuery[]; 
      kategorie: 'handwerk' | 'kfz';
    };

    if (!positionen || !Array.isArray(positionen)) {
      return new Response(
        JSON.stringify({ success: false, error: 'positionen array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const results: Record<number, MarketPriceResult> = {};

    for (let i = 0; i < positionen.length; i++) {
      const position = positionen[i];
      const searchKey = `${position.beschreibung} ${position.material || ''} ${position.gewerk || ''}`.trim().toLowerCase();
      
      console.log(`Processing position ${i + 1}: ${position.beschreibung}`);

      // Check cache first
      const { data: cached } = await supabase
        .from('external_marktpreise_cache')
        .select('*')
        .ilike('suchbegriff', `%${searchKey.substring(0, 50)}%`)
        .eq('kategorie', kategorie)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();

      if (cached) {
        console.log(`Cache hit for: ${position.beschreibung}`);
        results[i] = {
          preis_min: cached.preis_min,
          preis_max: cached.preis_max,
          preis_durchschnitt: cached.preis_durchschnitt,
          quellen: cached.quellen || [],
          gefunden: true,
          cache_hit: true,
        };
        continue;
      }

      // Build and execute search queries
      const queries = buildSearchQueries({ ...position, kategorie });
      const allPrices: number[] = [];
      const allSources: string[] = [];

      for (const query of queries.slice(0, 2)) { // Limit to 2 queries per position
        try {
          console.log(`Searching: ${query}`);
          
          const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: query,
              limit: 5,
              lang: 'de',
              country: 'de',
              scrapeOptions: {
                formats: ['markdown'],
              },
            }),
          });

          if (!searchResponse.ok) {
            console.error(`Firecrawl search failed: ${searchResponse.status}`);
            continue;
          }

          const searchData = await searchResponse.json();
          
          if (searchData.success && searchData.data) {
            for (const result of searchData.data) {
              // Extract prices from markdown content
              const content = result.markdown || result.description || '';
              const prices = extractPricesFromText(content);
              allPrices.push(...prices);
              
              if (prices.length > 0 && result.url) {
                // Extract domain as source
                try {
                  const url = new URL(result.url);
                  allSources.push(url.hostname.replace('www.', ''));
                } catch {
                  allSources.push(result.url);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Search error for query "${query}":`, error);
        }
      }

      // Calculate price statistics
      if (allPrices.length > 0) {
        const uniquePrices = [...new Set(allPrices)].sort((a, b) => a - b);
        const uniqueSources = [...new Set(allSources)].slice(0, 5);
        
        // Filter outliers (remove prices outside 2x interquartile range)
        const q1 = uniquePrices[Math.floor(uniquePrices.length * 0.25)];
        const q3 = uniquePrices[Math.floor(uniquePrices.length * 0.75)];
        const iqr = q3 - q1;
        const validPrices = uniquePrices.filter(p => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
        
        if (validPrices.length > 0) {
          const preis_min = validPrices[0];
          const preis_max = validPrices[validPrices.length - 1];
          const preis_durchschnitt = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;

          results[i] = {
            preis_min: Math.round(preis_min * 100) / 100,
            preis_max: Math.round(preis_max * 100) / 100,
            preis_durchschnitt: Math.round(preis_durchschnitt * 100) / 100,
            quellen: uniqueSources,
            gefunden: true,
            cache_hit: false,
          };

          // Cache the result
          await supabase.from('external_marktpreise_cache').insert({
            suchbegriff: searchKey,
            gewerk: position.gewerk,
            kategorie: kategorie,
            preis_min: results[i].preis_min,
            preis_max: results[i].preis_max,
            preis_durchschnitt: results[i].preis_durchschnitt,
            quellen: uniqueSources,
            raw_data: { prices: validPrices, sources: uniqueSources },
          });

          console.log(`Found prices for ${position.beschreibung}: ${preis_min} - ${preis_max}`);
          continue;
        }
      }

      // No prices found
      console.log(`No prices found for: ${position.beschreibung}`);
      results[i] = {
        preis_min: null,
        preis_max: null,
        preis_durchschnitt: null,
        quellen: [],
        gefunden: false,
        cache_hit: false,
      };
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('fetch-market-prices error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
