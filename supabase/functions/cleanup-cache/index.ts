import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== CACHE CLEANUP GESTARTET ===');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Lösche Cache-Einträge älter als 30 Tage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: deletedCache, error: cacheError } = await supabase
      .from('document_analysis_cache')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .select('id');

    if (cacheError) {
      console.error('Cache cleanup error:', cacheError);
    }

    const deletedCacheCount = deletedCache?.length || 0;
    console.log(`Gelöschte Cache-Einträge: ${deletedCacheCount}`);

    // 2. Lösche abgelaufene Guest-Sessions (älter als 24h)
    const { data: deletedSessions, error: sessionError } = await supabase
      .from('guest_sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (sessionError) {
      console.error('Session cleanup error:', sessionError);
    }

    const deletedSessionCount = deletedSessions?.length || 0;
    console.log(`Gelöschte abgelaufene Sessions: ${deletedSessionCount}`);

    // 3. Statistik abrufen
    const { data: stats } = await supabase
      .from('database_statistics')
      .select('*')
      .single();

    console.log('=== CACHE CLEANUP ABGESCHLOSSEN ===');

    return new Response(JSON.stringify({
      success: true,
      deleted_cache_entries: deletedCacheCount,
      deleted_sessions: deletedSessionCount,
      database_stats: stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cleanup Fehler:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
