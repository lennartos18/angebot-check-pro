-- Tabelle für gecachte Dokument-Analysen
CREATE TABLE public.document_analysis_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_hash TEXT NOT NULL UNIQUE,
  analysis_result JSONB NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_count INTEGER NOT NULL DEFAULT 1
);

-- Index für schnelle Hash-Lookups
CREATE INDEX idx_document_analysis_cache_hash ON public.document_analysis_cache(document_hash);

-- Index für Cache-Bereinigung (älteste zuerst)
CREATE INDEX idx_document_analysis_cache_accessed ON public.document_analysis_cache(last_accessed_at);

-- RLS aktivieren aber öffentlichen Lesezugriff erlauben (Cache wird von Edge Function verwaltet)
ALTER TABLE public.document_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Edge Functions nutzen Service Role Key, daher keine RLS-Policies nötig
-- Für direkte Abfragen (falls nötig) erlauben wir SELECT
CREATE POLICY "Cache is readable by anyone" 
ON public.document_analysis_cache 
FOR SELECT 
USING (true);

-- Kommentar zur Tabelle
COMMENT ON TABLE public.document_analysis_cache IS 'Speichert Analyse-Ergebnisse für bereits verarbeitete Dokumente anhand eines SHA-256 Hashes';