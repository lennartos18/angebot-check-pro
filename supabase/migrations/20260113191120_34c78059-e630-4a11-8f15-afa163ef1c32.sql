-- Neue Tabelle: external_reference_data (Externe Branchenreferenzen)
CREATE TABLE external_reference_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_domain TEXT NOT NULL,
  normalized_service_id UUID REFERENCES normalized_services(id),
  normalized_material_id UUID REFERENCES normalized_materials(id),
  
  -- Preisdaten
  price_min NUMERIC(12,2),
  price_max NUMERIC(12,2),
  price_median NUMERIC(12,2),
  unit TEXT,
  
  -- Quelle
  source_type TEXT NOT NULL CHECK (source_type IN (
    'hwk', 'ihk', 'innung', 'fachverband', 
    'marktstudie', 'hersteller_aw'
  )),
  source_name TEXT NOT NULL,
  source_url TEXT,
  source_date DATE NOT NULL,
  
  -- Regionale Einordnung
  region_type TEXT CHECK (region_type IN ('bundesweit', 'bundesland', 'region')),
  bundesland TEXT,
  
  -- Validitaet
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS fuer external_reference_data
ALTER TABLE external_reference_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "External reference data is publicly readable"
ON external_reference_data FOR SELECT
USING (true);

-- Neue Tabelle: price_evaluations (Bewertungsergebnisse)
CREATE TABLE price_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL,
  
  -- Datenquelle
  data_source TEXT NOT NULL CHECK (data_source IN ('internal', 'mixed', 'external_only', 'none')),
  internal_comparison_count INTEGER DEFAULT 0,
  external_reference_used BOOLEAN DEFAULT FALSE,
  external_source_name TEXT,
  
  -- Statistische Werte
  quartile_1 NUMERIC(12,2),
  median NUMERIC(12,2),
  quartile_3 NUMERIC(12,2),
  
  -- Einordnung (verbindliche Stufen)
  evaluation_level TEXT NOT NULL CHECK (evaluation_level IN (
    'im_regionalen_rahmen',
    'leicht_ueber_vergleich', 
    'auffaellig_hoch',
    'auffaellig_niedrig',
    'nicht_einordenbar'
  )),
  
  -- Begruendung und Transparenz
  evaluation_reason TEXT NOT NULL,
  data_basis_description TEXT NOT NULL,
  uncertainty_note TEXT,
  deviation_percent NUMERIC(6,2),
  
  -- Referenzen
  region_cluster_id UUID REFERENCES region_clusters(id),
  normalized_service_id UUID REFERENCES normalized_services(id),
  normalized_material_id UUID REFERENCES normalized_materials(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS fuer price_evaluations
ALTER TABLE price_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price evaluations are readable by authenticated users"
ON price_evaluations FOR SELECT
USING (true);

-- Erweiterung document_positions
ALTER TABLE document_positions ADD COLUMN IF NOT EXISTS 
  comparison_eligible BOOLEAN DEFAULT TRUE;

-- Erweiterung positionen: Neue Spalten fuer Einordnung
ALTER TABLE positionen ADD COLUMN IF NOT EXISTS 
  einordnung_stufe TEXT;
ALTER TABLE positionen ADD COLUMN IF NOT EXISTS 
  einordnung_begruendung TEXT;
ALTER TABLE positionen ADD COLUMN IF NOT EXISTS 
  datengrundlage TEXT;
ALTER TABLE positionen ADD COLUMN IF NOT EXISTS 
  unsicherheitshinweis TEXT;
ALTER TABLE positionen ADD COLUMN IF NOT EXISTS 
  datenquelle TEXT;
ALTER TABLE positionen ADD COLUMN IF NOT EXISTS 
  interne_vergleiche INTEGER DEFAULT 0;