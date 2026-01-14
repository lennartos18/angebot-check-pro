
-- 1. Cache-Bereinigung: Automatischer Cleanup nach 30 Tagen via pg_cron
-- Erstelle die Cleanup-Funktion
CREATE OR REPLACE FUNCTION public.cleanup_old_cache_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Lösche Einträge älter als 30 Tage
  DELETE FROM document_analysis_cache 
  WHERE created_at < now() - interval '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Deleted % old cache entries', deleted_count;
END;
$$;

-- 2. Duplikat-Erkennung für documents: Unique constraint auf Hash
-- Füge unique_document_hash Spalte hinzu falls nicht vorhanden
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS content_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_content_hash 
ON documents(content_hash) 
WHERE content_hash IS NOT NULL;

-- 3. Verbessere create_anonymized_document Trigger für korrekte Anonymisierung
CREATE OR REPLACE FUNCTION public.create_anonymized_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_region_cluster_id UUID;
  v_document_id UUID;
  v_time_bucket TEXT;
  v_anonymized_provider TEXT;
BEGIN
  -- Nur wenn noch kein anonymisiertes Dokument existiert
  IF NEW.anonymized_document_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Region-Cluster aus PLZ ermitteln
  IF NEW.plz IS NOT NULL THEN
    v_region_cluster_id := get_region_cluster_id(NEW.plz);
  END IF;
  
  -- Time-Bucket generieren
  v_time_bucket := generate_time_bucket(COALESCE(NEW.upload_date::DATE, CURRENT_DATE));
  
  -- Provider anonymisieren (nur wenn Firma vorhanden)
  IF NEW.handwerker_firma IS NOT NULL AND NEW.handwerker_firma != '' THEN
    v_anonymized_provider := anonymize_text(LOWER(TRIM(NEW.handwerker_firma)));
  END IF;
  
  -- Anonymisiertes Dokument erstellen
  INSERT INTO documents (
    document_type,
    service_domain,
    submission_date,
    time_bucket,
    region_cluster_id,
    total_gross_amount,
    anonymized_provider_id,
    position_count
  ) VALUES (
    COALESCE(NEW.document_type, 'angebot'),
    COALESCE(NEW.service_domain, 'handwerk'),
    COALESCE(NEW.upload_date::DATE, CURRENT_DATE),
    v_time_bucket,
    v_region_cluster_id,
    NEW.gesamtpreis,
    v_anonymized_provider,
    0 -- Start bei 0, wird durch Positions-Trigger erhöht
  )
  RETURNING id INTO v_document_id;
  
  -- Verknüpfung speichern
  NEW.anonymized_document_id := v_document_id;
  
  RETURN NEW;
END;
$$;

-- 4. Erstelle Index für effiziente Cache-Suche
CREATE INDEX IF NOT EXISTS idx_cache_created_at ON document_analysis_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_last_accessed ON document_analysis_cache(last_accessed_at);

-- 5. Erstelle Index für schnelle Positionssuche
CREATE INDEX IF NOT EXISTS idx_document_positions_lookup 
ON document_positions(document_id, normalized_service_id, region_cluster_id);

-- 6. Erstelle Index für Marktpreis-Aggregation
CREATE INDEX IF NOT EXISTS idx_document_positions_aggregation
ON document_positions(service_domain, time_bucket, unit_price) 
WHERE comparison_eligible = true;

-- 7. Statistik-View für Skalierung
CREATE OR REPLACE VIEW public.database_statistics AS
SELECT 
  (SELECT COUNT(*) FROM documents) as total_documents,
  (SELECT COUNT(*) FROM document_positions) as total_positions,
  (SELECT COUNT(*) FROM document_analysis_cache) as cached_analyses,
  (SELECT COUNT(DISTINCT region_cluster_id) FROM documents WHERE region_cluster_id IS NOT NULL) as covered_regions,
  (SELECT COUNT(DISTINCT service_domain) FROM documents) as service_domains,
  (SELECT MIN(submission_date) FROM documents) as oldest_document,
  (SELECT MAX(submission_date) FROM documents) as newest_document;
