
-- Fix security warnings: Add search_path to immutable functions
-- =====================================================

-- Fix generate_time_bucket function
CREATE OR REPLACE FUNCTION generate_time_bucket(d DATE)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN TO_CHAR(d, 'YYYY-"Q"Q');
END;
$$;

-- Fix anonymize_text function
CREATE OR REPLACE FUNCTION anonymize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN ENCODE(SHA256(input_text::BYTEA), 'hex');
END;
$$;
