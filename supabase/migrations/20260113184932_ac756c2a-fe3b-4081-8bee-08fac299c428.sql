
-- =====================================================
-- SKALIERBARE, ANONYMISIERTE ANGEBOTS- UND RECHNUNGSDATENBANK
-- =====================================================

-- 1. REGION-CLUSTER (PLZ-basierte Regionen)
-- =====================================================
CREATE TABLE region_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plz_prefix TEXT NOT NULL UNIQUE,
  region_name TEXT,
  bundesland TEXT,
  area_type TEXT CHECK (area_type IN ('grossstadt', 'stadt', 'land', 'ballungsraum')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE region_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Region clusters are publicly readable"
ON region_clusters FOR SELECT
USING (true);

-- 2. SERVICE-KATEGORIEN (hierarchisch, erweitert gewerke)
-- =====================================================
CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_domain TEXT NOT NULL CHECK (service_domain IN ('handwerk', 'werkstatt')),
  parent_id UUID REFERENCES service_categories(id),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service categories are publicly readable"
ON service_categories FOR SELECT
USING (true);

-- 3. NORMALISIERTE LEISTUNGEN
-- =====================================================
CREATE TABLE normalized_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_domain TEXT NOT NULL CHECK (service_domain IN ('handwerk', 'werkstatt')),
  category_id UUID REFERENCES service_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  standard_unit TEXT,
  keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE normalized_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Normalized services are publicly readable"
ON normalized_services FOR SELECT
USING (true);

-- 4. NORMALISIERTE MATERIALIEN
-- =====================================================
CREATE TABLE normalized_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_domain TEXT NOT NULL CHECK (service_domain IN ('handwerk', 'werkstatt')),
  name TEXT NOT NULL,
  material_category TEXT,
  standard_unit TEXT,
  keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE normalized_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Normalized materials are publicly readable"
ON normalized_materials FOR SELECT
USING (true);

-- 5. ANONYMISIERTE DOKUMENTE (Kerntabelle für Vergleichsdaten)
-- =====================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dokumenttyp
  document_type TEXT NOT NULL CHECK (document_type IN ('angebot', 'kostenvoranschlag', 'rechnung')),
  service_domain TEXT NOT NULL CHECK (service_domain IN ('handwerk', 'werkstatt')),
  
  -- Zeitliche Einordnung
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_bucket TEXT NOT NULL,
  
  -- Regionale Einordnung (NIEMALS exakte Adresse)
  region_cluster_id UUID REFERENCES region_clusters(id),
  
  -- Beträge
  total_net_amount NUMERIC(12,2),
  total_gross_amount NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  
  -- Anonymisierte Referenzen (Hash-Werte)
  anonymized_provider_id TEXT,
  anonymized_customer_id TEXT,
  
  -- Metadaten
  position_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Documents are readable by authenticated users"
ON documents FOR SELECT
TO authenticated
USING (true);

-- Indizes für zeitliche und regionale Abfragen
CREATE INDEX idx_documents_time_bucket ON documents(time_bucket);
CREATE INDEX idx_documents_region ON documents(region_cluster_id);
CREATE INDEX idx_documents_domain ON documents(service_domain);
CREATE INDEX idx_documents_type ON documents(document_type);

-- 6. DOKUMENT-POSITIONEN (Kernentität für Vergleiche)
-- =====================================================
CREATE TABLE document_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  
  -- Positionstyp
  position_type TEXT NOT NULL CHECK (position_type IN (
    'arbeitszeit', 'material', 'ersatzteil', 'pauschale', 'sonstig'
  )),
  
  -- Rohtext (bereinigt, aber nicht interpretiert)
  raw_text TEXT NOT NULL,
  
  -- Mengen und Preise
  quantity NUMERIC(12,4),
  unit TEXT,
  unit_price NUMERIC(12,2),
  total_price NUMERIC(12,2),
  tax_rate NUMERIC(5,2),
  
  -- Zeitliche und regionale Einordnung (denormalisiert für schnelle Abfragen)
  position_date DATE,
  region_cluster_id UUID REFERENCES region_clusters(id),
  time_bucket TEXT,
  
  -- Branchenspezifisch
  service_domain TEXT CHECK (service_domain IN ('handwerk', 'werkstatt')),
  
  -- Normalisierungs-Referenzen (optional, für spätere Zuordnung)
  normalized_service_id UUID REFERENCES normalized_services(id),
  normalized_material_id UUID REFERENCES normalized_materials(id),
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Document positions are readable by authenticated users"
ON document_positions FOR SELECT
TO authenticated
USING (true);

-- Indizes für statistische Auswertungen
CREATE INDEX idx_positions_region_time ON document_positions(region_cluster_id, time_bucket);
CREATE INDEX idx_positions_type_domain ON document_positions(position_type, service_domain);
CREATE INDEX idx_positions_unit ON document_positions(unit);
CREATE INDEX idx_positions_document ON document_positions(document_id);

-- 7. KFZ-SPEZIFISCHE ERWEITERUNGEN
-- =====================================================
CREATE TABLE vehicle_related_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES document_positions(id) ON DELETE CASCADE,
  
  -- Ersatzteil-Klassifikation
  part_type TEXT CHECK (part_type IN ('oem', 'aftermarket', 'no_name', 'gebraucht')),
  
  -- Arbeitswerte
  labor_units NUMERIC(8,2),
  labor_unit_price NUMERIC(8,2),
  
  -- Fahrzeugklasse (anonymisiert)
  vehicle_class TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vehicle_related_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicle extensions are readable by authenticated users"
ON vehicle_related_extensions FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_vehicle_extensions_position ON vehicle_related_extensions(position_id);

-- 8. FUNKTION: PLZ zu Region-Cluster
-- =====================================================
CREATE OR REPLACE FUNCTION get_region_cluster_id(plz TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cluster_id UUID;
BEGIN
  -- Versuche 2-stelligen Prefix
  SELECT id INTO v_cluster_id
  FROM region_clusters
  WHERE plz_prefix = LEFT(plz, 2)
  LIMIT 1;
  
  RETURN v_cluster_id;
END;
$$;

-- 9. FUNKTION: Time-Bucket generieren
-- =====================================================
CREATE OR REPLACE FUNCTION generate_time_bucket(d DATE)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN TO_CHAR(d, 'YYYY-"Q"Q');
END;
$$;

-- 10. FUNKTION: SHA256-Hash für Anonymisierung
-- =====================================================
CREATE OR REPLACE FUNCTION anonymize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN ENCODE(SHA256(input_text::BYTEA), 'hex');
END;
$$;

-- 11. BESTEHENDE TABELLEN ERWEITERN (für Migration)
-- =====================================================
-- Füge anonymized_document_id zu angebote hinzu
ALTER TABLE angebote 
ADD COLUMN IF NOT EXISTS anonymized_document_id UUID REFERENCES documents(id);

ALTER TABLE angebote 
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'angebot';

ALTER TABLE angebote 
ADD COLUMN IF NOT EXISTS service_domain TEXT DEFAULT 'handwerk';

-- 12. TRIGGER: Automatische Anonymisierung bei neuen Angeboten
-- =====================================================
CREATE OR REPLACE FUNCTION create_anonymized_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_region_cluster_id UUID;
  v_document_id UUID;
  v_time_bucket TEXT;
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
  
  -- Anonymisiertes Dokument erstellen
  INSERT INTO documents (
    document_type,
    service_domain,
    submission_date,
    time_bucket,
    region_cluster_id,
    total_gross_amount,
    anonymized_provider_id
  ) VALUES (
    COALESCE(NEW.document_type, 'angebot'),
    COALESCE(NEW.service_domain, 'handwerk'),
    COALESCE(NEW.upload_date::DATE, CURRENT_DATE),
    v_time_bucket,
    v_region_cluster_id,
    NEW.gesamtpreis,
    anonymize_text(NEW.handwerker_firma)
  )
  RETURNING id INTO v_document_id;
  
  -- Verknüpfung speichern
  NEW.anonymized_document_id := v_document_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_anonymized_document
BEFORE INSERT ON angebote
FOR EACH ROW
EXECUTE FUNCTION create_anonymized_document();

-- 13. TRIGGER: Positionen zu anonymisierten Dokumenten kopieren
-- =====================================================
CREATE OR REPLACE FUNCTION copy_position_to_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document_id UUID;
  v_region_cluster_id UUID;
  v_time_bucket TEXT;
  v_service_domain TEXT;
  v_position_type TEXT;
BEGIN
  -- Hole das anonymisierte Dokument
  SELECT a.anonymized_document_id, a.service_domain, d.region_cluster_id, d.time_bucket
  INTO v_document_id, v_service_domain, v_region_cluster_id, v_time_bucket
  FROM angebote a
  LEFT JOIN documents d ON d.id = a.anonymized_document_id
  WHERE a.id = NEW.angebot_id;
  
  -- Wenn kein anonymisiertes Dokument existiert, nicht kopieren
  IF v_document_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Bestimme Positionstyp basierend auf Material
  IF NEW.material IS NOT NULL AND NEW.material != '' THEN
    v_position_type := 'material';
  ELSE
    v_position_type := 'arbeitszeit';
  END IF;
  
  -- Kopiere Position zu document_positions
  INSERT INTO document_positions (
    document_id,
    position_type,
    raw_text,
    quantity,
    unit,
    unit_price,
    total_price,
    region_cluster_id,
    time_bucket,
    service_domain
  ) VALUES (
    v_document_id,
    v_position_type,
    NEW.beschreibung,
    NEW.menge,
    NEW.einheit,
    NEW.einzelpreis,
    NEW.gesamtpreis,
    v_region_cluster_id,
    v_time_bucket,
    v_service_domain
  );
  
  -- Update position_count im Dokument
  UPDATE documents
  SET position_count = position_count + 1
  WHERE id = v_document_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_copy_position_to_document
AFTER INSERT ON positionen
FOR EACH ROW
EXECUTE FUNCTION copy_position_to_document();

-- 14. REGION-CLUSTER INITIAL BEFÜLLEN
-- =====================================================
INSERT INTO region_clusters (plz_prefix, region_name, bundesland, area_type) VALUES
  ('01', 'Dresden', 'Sachsen', 'grossstadt'),
  ('04', 'Leipzig', 'Sachsen', 'grossstadt'),
  ('10', 'Berlin-Mitte', 'Berlin', 'grossstadt'),
  ('12', 'Berlin-Süd', 'Berlin', 'grossstadt'),
  ('13', 'Berlin-Nord', 'Berlin', 'grossstadt'),
  ('14', 'Potsdam', 'Brandenburg', 'stadt'),
  ('20', 'Hamburg-Mitte', 'Hamburg', 'grossstadt'),
  ('22', 'Hamburg-Ost', 'Hamburg', 'grossstadt'),
  ('28', 'Bremen', 'Bremen', 'grossstadt'),
  ('30', 'Hannover', 'Niedersachsen', 'grossstadt'),
  ('40', 'Düsseldorf', 'NRW', 'grossstadt'),
  ('44', 'Dortmund', 'NRW', 'grossstadt'),
  ('45', 'Essen', 'NRW', 'grossstadt'),
  ('50', 'Köln', 'NRW', 'grossstadt'),
  ('53', 'Bonn', 'NRW', 'stadt'),
  ('60', 'Frankfurt', 'Hessen', 'grossstadt'),
  ('68', 'Mannheim', 'Baden-Württemberg', 'grossstadt'),
  ('70', 'Stuttgart', 'Baden-Württemberg', 'grossstadt'),
  ('80', 'München-Mitte', 'Bayern', 'grossstadt'),
  ('81', 'München-Ost', 'Bayern', 'grossstadt'),
  ('90', 'Nürnberg', 'Bayern', 'grossstadt')
ON CONFLICT (plz_prefix) DO NOTHING;

-- 15. SERVICE-KATEGORIEN INITIAL BEFÜLLEN
-- =====================================================
INSERT INTO service_categories (service_domain, name, code) VALUES
  ('handwerk', 'Sanitär, Heizung, Klima', 'SHK'),
  ('handwerk', 'Elektro', 'ELEK'),
  ('handwerk', 'Maler & Lackierer', 'MALER'),
  ('handwerk', 'Tischler & Schreiner', 'TISCH'),
  ('handwerk', 'Dachdecker', 'DACH'),
  ('handwerk', 'Maurer & Beton', 'MAUR'),
  ('handwerk', 'Fliesenleger', 'FLIES'),
  ('handwerk', 'Zimmerer', 'ZIMM'),
  ('werkstatt', 'Kfz-Mechanik', 'KFZ-MECH'),
  ('werkstatt', 'Kfz-Elektrik', 'KFZ-ELEK'),
  ('werkstatt', 'Kfz-Karosserie', 'KFZ-KAR'),
  ('werkstatt', 'Kfz-Lackierung', 'KFZ-LACK'),
  ('werkstatt', 'Reifenservice', 'KFZ-REIF'),
  ('werkstatt', 'Inspektion & Wartung', 'KFZ-INSP')
ON CONFLICT DO NOTHING;
