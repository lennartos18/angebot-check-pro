
-- Fix 1: Bestehende Dokumente mit NULL anonymized_provider_id und content_hash fixen
UPDATE documents
SET 
  anonymized_provider_id = 'anon_' || LEFT(encode(sha256((id::text || service_domain)::bytea), 'hex'), 16),
  content_hash = encode(sha256((id::text || service_domain || COALESCE(total_gross_amount::text, '') || time_bucket)::bytea), 'hex')
WHERE anonymized_provider_id IS NULL OR content_hash IS NULL;

-- Fix 2: Lernschleife mit bestehenden Positionen befüllen
-- Für jede unique Kombination aus raw_text + service_domain einen Eintrag erstellen
INSERT INTO text_normalizations (
  raw_text,
  cleaned_text,
  service_domain,
  position_type,
  normalized_service_id,
  normalized_material_id,
  confidence_score,
  match_count,
  is_verified
)
SELECT DISTINCT ON (dp.raw_text, dp.service_domain)
  dp.raw_text,
  LOWER(TRIM(REGEXP_REPLACE(dp.raw_text, '[^a-zA-ZäöüÄÖÜß0-9\s]', '', 'g'))),
  COALESCE(dp.service_domain, 'handwerk'),
  dp.position_type,
  dp.normalized_service_id,
  dp.normalized_material_id,
  COALESCE(dp.normalization_confidence, 70)::numeric,
  1,
  false
FROM document_positions dp
WHERE dp.raw_text IS NOT NULL 
  AND dp.raw_text != ''
  AND dp.normalization_status = 'normalized'
ON CONFLICT DO NOTHING;
