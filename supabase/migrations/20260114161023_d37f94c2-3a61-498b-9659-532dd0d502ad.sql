-- Add region_type column to region_clusters
ALTER TABLE public.region_clusters 
ADD COLUMN IF NOT EXISTS region_type text 
CHECK (region_type IN ('grossstadt', 'mittelstadt', 'kleinstadt', 'laendlich'));

-- Update existing regions with city type based on PLZ prefix patterns
UPDATE public.region_clusters SET region_type = 'grossstadt' 
WHERE plz_prefix IN ('10','12','13','20','22','40','50','60','70','80','81');

UPDATE public.region_clusters SET region_type = 'mittelstadt'
WHERE region_type IS NULL AND plz_prefix IN ('30','34','35','38','45','46','47','48','51','53','55','64','65','66','68','69','73','74','76','86','90','91');

UPDATE public.region_clusters SET region_type = 'kleinstadt'
WHERE region_type IS NULL AND plz_prefix IN ('14','15','16','17','18','19','23','24','25','26','27','28','29','31','32','33','36','37','39','41','42','44','49','52','54','56','57','58','59','61','63','67','72','75','77','78','79','82','83','84','85','87','88','89','92','93','94','95','96','97','98','99');

UPDATE public.region_clusters SET region_type = 'laendlich'
WHERE region_type IS NULL;

-- Create comprehensive admin monitoring view
DROP VIEW IF EXISTS public.admin_monitoring;
CREATE VIEW public.admin_monitoring AS
SELECT
  -- Schlecht erkannte Positionen (confidence < 70)
  (SELECT COUNT(*) FROM document_positions 
   WHERE normalization_confidence IS NOT NULL AND normalization_confidence < 70) as low_confidence_positions,
  
  -- Positionen ohne Normalisierung
  (SELECT COUNT(*) FROM document_positions 
   WHERE normalized_service_id IS NULL AND normalized_material_id IS NULL) as unnormalized_positions,
  
  -- Fehlende Vergleichsdaten (Services ohne Positionen in den letzten 12 Monaten)
  (SELECT COUNT(*) FROM normalized_services ns 
   WHERE NOT EXISTS (
     SELECT 1 FROM document_positions dp 
     WHERE dp.normalized_service_id = ns.id
     AND dp.created_at > NOW() - INTERVAL '12 months'
   )) as unused_services,
  
  -- Lernschleife Status
  (SELECT COUNT(*) FROM text_normalizations WHERE match_count >= 3) as learned_patterns,
  (SELECT COUNT(*) FROM text_normalizations) as total_normalizations,
  
  -- Anonymisierung Status
  (SELECT COUNT(*) FROM documents WHERE anonymized_provider_id IS NULL) as missing_provider_anonymization,
  (SELECT COUNT(*) FROM documents WHERE content_hash IS NULL) as missing_content_hash,
  
  -- Duplikat-Check
  (SELECT COUNT(*) - COUNT(DISTINCT content_hash) FROM documents WHERE content_hash IS NOT NULL) as potential_duplicates,
  
  -- Wachstum letzte 7 Tage
  (SELECT COUNT(*) FROM documents WHERE created_at > NOW() - INTERVAL '7 days') as documents_last_week,
  (SELECT COUNT(*) FROM document_positions WHERE created_at > NOW() - INTERVAL '7 days') as positions_last_week,
  
  -- Regionale Abdeckung
  (SELECT COUNT(DISTINCT region_cluster_id) FROM documents WHERE region_cluster_id IS NOT NULL) as covered_regions,
  (SELECT COUNT(*) FROM region_clusters) as total_regions,
  
  -- Service Domain Verteilung
  (SELECT json_object_agg(service_domain, cnt) FROM (
    SELECT service_domain, COUNT(*) as cnt FROM documents GROUP BY service_domain
  ) t) as domain_distribution,
  
  -- Position Type Verteilung
  (SELECT json_object_agg(position_type, cnt) FROM (
    SELECT position_type, COUNT(*) as cnt FROM document_positions GROUP BY position_type
  ) t) as position_type_distribution;

-- View für schlecht erkannte Positionen (Details)
DROP VIEW IF EXISTS public.admin_low_confidence_positions;
CREATE VIEW public.admin_low_confidence_positions AS
SELECT 
  dp.id,
  dp.raw_text,
  dp.position_type,
  dp.normalization_confidence,
  dp.normalization_status,
  dp.normalized_service_id,
  dp.normalized_material_id,
  dp.service_domain,
  dp.unit,
  dp.total_price,
  dp.created_at,
  rc.region_name,
  rc.bundesland
FROM document_positions dp
LEFT JOIN region_clusters rc ON dp.region_cluster_id = rc.id
WHERE dp.normalization_confidence IS NOT NULL AND dp.normalization_confidence < 70
ORDER BY dp.created_at DESC;

-- View für Preis-Streuung nach normalisierten Services
DROP VIEW IF EXISTS public.admin_price_variance;
CREATE VIEW public.admin_price_variance AS
SELECT 
  ns.id as service_id,
  ns.name as service_name,
  ns.service_domain,
  COUNT(dp.id) as position_count,
  ROUND(AVG(dp.unit_price)::numeric, 2) as avg_unit_price,
  ROUND(STDDEV(dp.unit_price)::numeric, 2) as stddev_unit_price,
  ROUND(MIN(dp.unit_price)::numeric, 2) as min_unit_price,
  ROUND(MAX(dp.unit_price)::numeric, 2) as max_unit_price,
  CASE 
    WHEN AVG(dp.unit_price) > 0 THEN ROUND((STDDEV(dp.unit_price) / AVG(dp.unit_price))::numeric, 2)
    ELSE 0
  END as variation_coefficient,
  CASE 
    WHEN AVG(dp.unit_price) > 0 AND STDDEV(dp.unit_price) / AVG(dp.unit_price) > 0.5 THEN true
    ELSE false
  END as high_variance
FROM normalized_services ns
LEFT JOIN document_positions dp ON dp.normalized_service_id = ns.id
WHERE dp.unit_price IS NOT NULL
GROUP BY ns.id, ns.name, ns.service_domain
HAVING COUNT(dp.id) >= 3
ORDER BY variation_coefficient DESC NULLS LAST;

-- View für regionale Preisunterschiede
DROP VIEW IF EXISTS public.admin_regional_prices;
CREATE VIEW public.admin_regional_prices AS
SELECT 
  rc.id as region_id,
  rc.plz_prefix,
  rc.region_name,
  rc.bundesland,
  rc.region_type,
  COUNT(DISTINCT d.id) as document_count,
  COUNT(dp.id) as position_count,
  ROUND(AVG(dp.unit_price)::numeric, 2) as avg_unit_price,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dp.unit_price)::numeric, 2) as median_unit_price
FROM region_clusters rc
LEFT JOIN documents d ON d.region_cluster_id = rc.id
LEFT JOIN document_positions dp ON dp.region_cluster_id = rc.id AND dp.unit_price IS NOT NULL
GROUP BY rc.id, rc.plz_prefix, rc.region_name, rc.bundesland, rc.region_type
ORDER BY document_count DESC;