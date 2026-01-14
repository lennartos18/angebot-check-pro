-- Enable pgvector extension for semantic similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to normalized_services (1536 dimensions for text-embedding-3-small)
ALTER TABLE normalized_services 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding columns to normalized_materials
ALTER TABLE normalized_materials 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding columns to document_positions
ALTER TABLE document_positions 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create IVFFlat indexes for fast similarity search
-- Using lists = 100 for optimal performance with expected ~1000-10000 rows
CREATE INDEX IF NOT EXISTS idx_services_embedding ON normalized_services 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_materials_embedding ON normalized_materials 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_positions_embedding ON document_positions 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RPC function to find similar services by embedding
CREATE OR REPLACE FUNCTION match_services(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
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

-- RPC function to find similar materials by embedding
CREATE OR REPLACE FUNCTION match_materials(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
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

-- RPC function to find similar unmatched positions (for clustering)
CREATE OR REPLACE FUNCTION find_similar_unmatched(
  query_embedding vector(1536),
  threshold float DEFAULT 0.85,
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

-- Create service_suggestions table for auto-discovered services
CREATE TABLE IF NOT EXISTS service_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_name text NOT NULL,
  suggested_keywords text[],
  similar_position_ids uuid[],
  service_domain text NOT NULL,
  cluster_size int DEFAULT 1,
  status text DEFAULT 'pending', -- pending, approved, rejected
  approved_service_id uuid REFERENCES normalized_services(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on service_suggestions
ALTER TABLE service_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_full_access" ON service_suggestions
  FOR ALL USING (true) WITH CHECK (true);