-- Cache für externe Marktpreis-Recherchen
CREATE TABLE public.external_marktpreise_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suchbegriff TEXT NOT NULL,
  gewerk TEXT,
  kategorie TEXT, -- 'handwerk' oder 'kfz'
  preis_min NUMERIC,
  preis_max NUMERIC,
  preis_durchschnitt NUMERIC,
  quellen TEXT[],
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

-- Index für schnelle Suche
CREATE INDEX idx_external_marktpreise_cache_suchbegriff ON public.external_marktpreise_cache USING gin(to_tsvector('german', suchbegriff));
CREATE INDEX idx_external_marktpreise_cache_expires ON public.external_marktpreise_cache(expires_at);

-- RLS aktivieren (öffentlich lesbar für die Edge Function)
ALTER TABLE public.external_marktpreise_cache ENABLE ROW LEVEL SECURITY;

-- Alle können lesen
CREATE POLICY "External marktpreise cache is publicly readable" 
ON public.external_marktpreise_cache 
FOR SELECT 
USING (true);

-- Nur Service-Role kann schreiben (Edge Functions)
CREATE POLICY "Service role can insert external marktpreise cache" 
ON public.external_marktpreise_cache 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can update external marktpreise cache" 
ON public.external_marktpreise_cache 
FOR UPDATE 
USING (true);

CREATE POLICY "Service role can delete external marktpreise cache" 
ON public.external_marktpreise_cache 
FOR DELETE 
USING (true);