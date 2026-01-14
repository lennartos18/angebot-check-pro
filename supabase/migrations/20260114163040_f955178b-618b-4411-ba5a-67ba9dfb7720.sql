-- Update embedding columns to 512 dimensions (for local semantic embeddings)
ALTER TABLE normalized_services 
DROP COLUMN IF EXISTS embedding;

ALTER TABLE normalized_services 
ADD COLUMN embedding vector(512);

ALTER TABLE normalized_materials 
DROP COLUMN IF EXISTS embedding;

ALTER TABLE normalized_materials 
ADD COLUMN embedding vector(512);

ALTER TABLE document_positions 
DROP COLUMN IF EXISTS embedding;

ALTER TABLE document_positions 
ADD COLUMN embedding vector(512);

-- Recreate indexes
DROP INDEX IF EXISTS idx_services_embedding;
DROP INDEX IF EXISTS idx_materials_embedding;
DROP INDEX IF EXISTS idx_positions_embedding;

CREATE INDEX idx_services_embedding ON normalized_services 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_materials_embedding ON normalized_materials 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_positions_embedding ON document_positions 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Update RPC functions for 512 dimensions
CREATE OR REPLACE FUNCTION match_services(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  target_service_domain text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  service_domain text,
  keywords text[],
  standard_unit text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 
    ns.id,
    ns.name,
    ns.service_domain,
    ns.keywords,
    ns.standard_unit,
    1 - (ns.embedding <=> query_embedding) as similarity
  FROM normalized_services ns
  WHERE ns.embedding IS NOT NULL
    AND 1 - (ns.embedding <=> query_embedding) > match_threshold
    AND (target_service_domain IS NULL OR ns.service_domain = target_service_domain)
  ORDER BY ns.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_materials(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  target_service_domain text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  service_domain text,
  keywords text[],
  standard_unit text,
  material_category text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 
    nm.id,
    nm.name,
    nm.service_domain,
    nm.keywords,
    nm.standard_unit,
    nm.material_category,
    1 - (nm.embedding <=> query_embedding) as similarity
  FROM normalized_materials nm
  WHERE nm.embedding IS NOT NULL
    AND 1 - (nm.embedding <=> query_embedding) > match_threshold
    AND (target_service_domain IS NULL OR nm.service_domain = target_service_domain)
  ORDER BY nm.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION find_similar_unmatched(
  query_embedding vector(512),
  threshold float DEFAULT 0.7,
  max_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  raw_text text,
  service_domain text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 
    dp.id,
    dp.raw_text,
    dp.service_domain,
    1 - (dp.embedding <=> query_embedding) as similarity
  FROM document_positions dp
  WHERE dp.embedding IS NOT NULL
    AND dp.normalization_status = 'unmatched'
    AND 1 - (dp.embedding <=> query_embedding) > threshold
  ORDER BY dp.embedding <=> query_embedding
  LIMIT max_count;
$$;