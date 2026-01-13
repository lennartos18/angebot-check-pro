-- ===========================================
-- NORMALISIERUNGS-INFRASTRUKTUR
-- ===========================================

-- 1. Tabelle für Text-Normalisierungen (Lernfähigkeit)
CREATE TABLE public.text_normalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_text TEXT NOT NULL,
  cleaned_text TEXT NOT NULL,
  service_domain TEXT NOT NULL CHECK (service_domain IN ('handwerk', 'werkstatt')),
  position_type TEXT CHECK (position_type IN ('arbeitszeit', 'material', 'ersatzteil', 'pauschale', 'sonstig')),
  normalized_service_id UUID REFERENCES public.normalized_services(id) ON DELETE SET NULL,
  normalized_material_id UUID REFERENCES public.normalized_materials(id) ON DELETE SET NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  match_count INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Suche
CREATE INDEX idx_text_normalizations_cleaned ON public.text_normalizations(cleaned_text, service_domain);
CREATE INDEX idx_text_normalizations_confidence ON public.text_normalizations(confidence_score DESC, match_count DESC);

-- RLS aktivieren
ALTER TABLE public.text_normalizations ENABLE ROW LEVEL SECURITY;

-- Policy: Lesbar für authentifizierte Nutzer
CREATE POLICY "Text normalizations are readable by authenticated users"
  ON public.text_normalizations FOR SELECT
  USING (true);

-- 2. Synonym-Wörterbuch
CREATE TABLE public.normalization_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_domain TEXT NOT NULL CHECK (service_domain IN ('handwerk', 'werkstatt', 'allgemein')),
  canonical_term TEXT NOT NULL,
  synonym TEXT NOT NULL,
  weight NUMERIC(3,2) DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_domain, canonical_term, synonym)
);

CREATE INDEX idx_synonyms_lookup ON public.normalization_synonyms(service_domain, synonym);

ALTER TABLE public.normalization_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Synonyms are publicly readable"
  ON public.normalization_synonyms FOR SELECT
  USING (true);

-- 3. Stopp-Wörter
CREATE TABLE public.normalization_stopwords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.normalization_stopwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stopwords are publicly readable"
  ON public.normalization_stopwords FOR SELECT
  USING (true);

-- 4. Erweiterung document_positions
ALTER TABLE public.document_positions 
  ADD COLUMN IF NOT EXISTS normalization_confidence INTEGER CHECK (normalization_confidence BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS normalization_status TEXT DEFAULT 'pending' CHECK (normalization_status IN ('pending', 'normalized', 'unmatched', 'manual'));

-- ===========================================
-- STAMMDATEN: STOPP-WÖRTER
-- ===========================================
INSERT INTO public.normalization_stopwords (word) VALUES
('und'), ('oder'), ('mit'), ('ohne'), ('für'), ('fuer'), ('bei'), ('nach'), ('vor'),
('inkl'), ('inklusive'), ('exkl'), ('exklusive'), ('ca'), ('circa'), ('etwa'),
('gem'), ('gemäß'), ('gemaess'), ('lt'), ('laut'), ('siehe'), ('vgl'),
('der'), ('die'), ('das'), ('den'), ('dem'), ('des'), ('ein'), ('eine'), ('einer'),
('auf'), ('in'), ('an'), ('am'), ('im'), ('zum'), ('zur'), ('vom'), ('von'),
('wie'), ('als'), ('auch'), ('nur'), ('noch'), ('schon'), ('bereits'),
('sowie'), ('bzw'), ('etc'), ('usw'), ('ggf'), ('evtl');

-- ===========================================
-- STAMMDATEN: SYNONYME
-- ===========================================
INSERT INTO public.normalization_synonyms (service_domain, canonical_term, synonym, weight) VALUES
-- Allgemeine Einheiten
('allgemein', 'm2', 'qm', 1.0),
('allgemein', 'm2', 'quadratmeter', 1.0),
('allgemein', 'm', 'meter', 1.0),
('allgemein', 'm', 'lfm', 1.0),
('allgemein', 'm', 'laufendermeter', 1.0),
('allgemein', 'std', 'stunde', 1.0),
('allgemein', 'std', 'stunden', 1.0),
('allgemein', 'std', 'h', 0.9),
('allgemein', 'stk', 'stueck', 1.0),
('allgemein', 'stk', 'stck', 1.0),
('allgemein', 'stk', 'st', 0.9),
('allgemein', 'psch', 'pauschale', 1.0),
('allgemein', 'psch', 'pauschal', 1.0),
-- Handwerk
('handwerk', 'streichen', 'anstreichen', 1.0),
('handwerk', 'streichen', 'malern', 0.9),
('handwerk', 'streichen', 'anstrich', 1.0),
('handwerk', 'montage', 'montieren', 1.0),
('handwerk', 'montage', 'einbau', 0.9),
('handwerk', 'montage', 'einbauen', 0.9),
('handwerk', 'demontage', 'demontieren', 1.0),
('handwerk', 'demontage', 'ausbau', 0.9),
('handwerk', 'demontage', 'ausbauen', 0.9),
('handwerk', 'fliesen', 'fliese', 1.0),
('handwerk', 'fliesen', 'kacheln', 0.9),
('handwerk', 'tapezieren', 'tapete', 1.0),
('handwerk', 'tapezieren', 'tapeten', 1.0),
('handwerk', 'spachteln', 'verspachteln', 1.0),
('handwerk', 'spachteln', 'glaetten', 0.8),
('handwerk', 'grundieren', 'grundierung', 1.0),
('handwerk', 'grundieren', 'voranstrich', 0.9),
-- Werkstatt
('werkstatt', 'aw', 'arbeitswert', 1.0),
('werkstatt', 'aw', 'arbeitseinheit', 0.9),
('werkstatt', 'aw', 'ae', 0.9),
('werkstatt', 'oelwechsel', 'motoroelwechsel', 1.0),
('werkstatt', 'oelwechsel', 'oelservice', 0.9),
('werkstatt', 'reifen', 'raeder', 0.9),
('werkstatt', 'reifen', 'pneu', 0.8),
('werkstatt', 'bremse', 'bremsen', 1.0),
('werkstatt', 'bremse', 'bremsanlage', 1.0),
('werkstatt', 'oem', 'original', 1.0),
('werkstatt', 'oem', 'erstausruester', 0.9),
('werkstatt', 'aftermarket', 'zubehoer', 0.8),
('werkstatt', 'inspektion', 'wartung', 0.9),
('werkstatt', 'inspektion', 'service', 0.8);

-- ===========================================
-- STAMMDATEN: NORMALISIERTE LEISTUNGEN
-- ===========================================

-- Handwerk: Maler
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('handwerk', (SELECT id FROM service_categories WHERE code = 'MALER' LIMIT 1), 
 'Wandfläche streichen', 'm2', 
 ARRAY['streichen', 'anstrich', 'wandfarbe', 'dispersionsfarbe', 'wandanstrich', 'innenanstrich', 'wand'],
 'Streichen von Wandflächen mit Dispersionsfarbe'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'MALER' LIMIT 1), 
 'Decke streichen', 'm2', 
 ARRAY['deckenanstrich', 'decke', 'zimmerdecke', 'deckenfarbe'],
 'Streichen von Deckenflächen'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'MALER' LIMIT 1), 
 'Tapezieren', 'm2', 
 ARRAY['tapezieren', 'tapete', 'tapeten', 'raufaser', 'vliestapete'],
 'Tapezieren von Wänden'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'MALER' LIMIT 1), 
 'Spachteln und Glätten', 'm2', 
 ARRAY['spachteln', 'glaetten', 'verspachteln', 'spachtelarbeiten', 'q2', 'q3', 'q4'],
 'Spachtel- und Glättarbeiten'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'MALER' LIMIT 1), 
 'Lackieren Türrahmen', 'Stk', 
 ARRAY['lackieren', 'tuerrahmen', 'tuerzarge', 'zarge', 'lack'],
 'Lackieren von Türrahmen/Zargen');

-- Handwerk: Elektro
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('handwerk', (SELECT id FROM service_categories WHERE code = 'ELEKTRO' LIMIT 1), 
 'Steckdose installieren', 'Stk', 
 ARRAY['steckdose', 'schuko', 'steckdosenmontage', 'dose'],
 'Installation einer Steckdose'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'ELEKTRO' LIMIT 1), 
 'Lichtschalter installieren', 'Stk', 
 ARRAY['schalter', 'lichtschalter', 'wechselschalter', 'schaltermontage'],
 'Installation eines Lichtschalters'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'ELEKTRO' LIMIT 1), 
 'Kabel verlegen', 'm', 
 ARRAY['kabel', 'leitung', 'verkabelung', 'elektrokabel', 'nym'],
 'Verlegen von Elektrokabeln');

-- Handwerk: SHK
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('handwerk', (SELECT id FROM service_categories WHERE code = 'SHK' LIMIT 1), 
 'Heizkörper montieren', 'Stk', 
 ARRAY['heizkoerper', 'radiator', 'heizung', 'heizkoerpermontage'],
 'Montage eines Heizkörpers'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'SHK' LIMIT 1), 
 'Wasserhahn montieren', 'Stk', 
 ARRAY['wasserhahn', 'armatur', 'mischbatterie', 'einhebelmischer'],
 'Montage einer Wasserarmatur'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'SHK' LIMIT 1), 
 'WC montieren', 'Stk', 
 ARRAY['wc', 'toilette', 'klosett', 'wcmontage'],
 'Montage einer Toilettenanlage'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'SHK' LIMIT 1), 
 'Rohr verlegen', 'm', 
 ARRAY['rohr', 'rohrleitung', 'wasserleitung', 'abflussrohr', 'fallrohr'],
 'Verlegen von Rohrleitungen');

-- Handwerk: Fliesen
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('handwerk', (SELECT id FROM service_categories WHERE code = 'FLIESE' LIMIT 1), 
 'Bodenfliesen verlegen', 'm2', 
 ARRAY['bodenfliesen', 'fliesen', 'boden', 'bodenbelag', 'feinsteinzeug'],
 'Verlegen von Bodenfliesen'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'FLIESE' LIMIT 1), 
 'Wandfliesen verlegen', 'm2', 
 ARRAY['wandfliesen', 'fliesen', 'wand', 'wandbelag'],
 'Verlegen von Wandfliesen'),
('handwerk', (SELECT id FROM service_categories WHERE code = 'FLIESE' LIMIT 1), 
 'Fugen', 'm2', 
 ARRAY['fugen', 'verfugen', 'fugenmasse', 'fugenmaterial'],
 'Verfugen von Fliesen');

-- Werkstatt: Mechanik
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-MECH' LIMIT 1), 
 'Ölwechsel', 'Stk', 
 ARRAY['oelwechsel', 'motoroel', 'oelservice', 'oelfilter'],
 'Motorölwechsel mit Filter'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-MECH' LIMIT 1), 
 'Bremsbeläge wechseln', 'Achse', 
 ARRAY['bremsbelaege', 'bremsbelag', 'bremskloetze', 'bremsenwechsel'],
 'Wechsel der Bremsbeläge je Achse'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-MECH' LIMIT 1), 
 'Bremsscheiben wechseln', 'Achse', 
 ARRAY['bremsscheiben', 'bremsscheibe', 'scheibenbremse'],
 'Wechsel der Bremsscheiben je Achse'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-MECH' LIMIT 1), 
 'Auspuff wechseln', 'Stk', 
 ARRAY['auspuff', 'abgasanlage', 'auspuffanlage', 'endschalldaempfer'],
 'Wechsel der Auspuffanlage'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-MECH' LIMIT 1), 
 'Zahnriemen wechseln', 'Stk', 
 ARRAY['zahnriemen', 'zahnriemenwechsel', 'steuerriemen'],
 'Wechsel des Zahnriemens');

-- Werkstatt: Reifen
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-REIF' LIMIT 1), 
 'Reifenwechsel', 'Satz', 
 ARRAY['reifenwechsel', 'radwechsel', 'raederwechsel', 'reifenmontage'],
 'Wechsel eines Reifensatzes (4 Räder)'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-REIF' LIMIT 1), 
 'Auswuchten', 'Rad', 
 ARRAY['auswuchten', 'wuchten', 'radwuchten'],
 'Auswuchten je Rad'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-REIF' LIMIT 1), 
 'Reifenmontage auf Felge', 'Stk', 
 ARRAY['reifenmontage', 'aufziehen', 'montage', 'reifen'],
 'Montage eines Reifens auf Felge');

-- Werkstatt: Elektrik
INSERT INTO public.normalized_services (service_domain, category_id, name, standard_unit, keywords, description) VALUES
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-ELEK' LIMIT 1), 
 'Batterie wechseln', 'Stk', 
 ARRAY['batterie', 'starterbatterie', 'akku', 'batteriewechsel'],
 'Wechsel der Fahrzeugbatterie'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-ELEK' LIMIT 1), 
 'Lichtmaschine wechseln', 'Stk', 
 ARRAY['lichtmaschine', 'generator', 'lima'],
 'Wechsel der Lichtmaschine'),
('werkstatt', (SELECT id FROM service_categories WHERE code = 'KFZ-ELEK' LIMIT 1), 
 'Anlasser wechseln', 'Stk', 
 ARRAY['anlasser', 'starter', 'anlasserwechsel'],
 'Wechsel des Anlassers');

-- ===========================================
-- STAMMDATEN: NORMALISIERTE MATERIALIEN
-- ===========================================

-- Handwerk Materialien
INSERT INTO public.normalized_materials (service_domain, name, material_category, standard_unit, keywords) VALUES
('handwerk', 'Dispersionsfarbe weiß', 'Farbe', 'Liter', 
 ARRAY['dispersionsfarbe', 'wandfarbe', 'innenfarbe', 'weiss', 'weiß']),
('handwerk', 'Tiefengrund', 'Grundierung', 'Liter', 
 ARRAY['tiefengrund', 'grundierung', 'haftgrund', 'voranstrich']),
('handwerk', 'Raufasertapete', 'Tapete', 'm2', 
 ARRAY['raufaser', 'raufasertapete', 'tapete', 'rauhfaser']),
('handwerk', 'Silikon', 'Dichtmittel', 'Kartusche', 
 ARRAY['silikon', 'sanitaersilikon', 'fugensilikon', 'dichtmasse']),
('handwerk', 'Fliesenkleber', 'Kleber', 'kg', 
 ARRAY['fliesenkleber', 'flexkleber', 'duennbettmoertel']),
('handwerk', 'Fugenmasse', 'Fugenmaterial', 'kg', 
 ARRAY['fugenmasse', 'fugenmoertel', 'flexfuge']);

-- Werkstatt Materialien
INSERT INTO public.normalized_materials (service_domain, name, material_category, standard_unit, keywords) VALUES
('werkstatt', 'Motoröl 5W-30', 'Schmierstoff', 'Liter', 
 ARRAY['motoroel', '5w30', '5w-30', 'longlife', 'oel']),
('werkstatt', 'Motoröl 5W-40', 'Schmierstoff', 'Liter', 
 ARRAY['motoroel', '5w40', '5w-40', 'oel']),
('werkstatt', 'Bremsflüssigkeit DOT4', 'Betriebsstoff', 'Liter', 
 ARRAY['bremsfluessigkeit', 'dot4', 'dot 4', 'bremsoell']),
('werkstatt', 'Kühlflüssigkeit', 'Betriebsstoff', 'Liter', 
 ARRAY['kuehlmittel', 'kühlfluessigkeit', 'frostschutz', 'kuehler']),
('werkstatt', 'Ölfilter', 'Filter', 'Stk', 
 ARRAY['oelfilter', 'motoroelfilter', 'filter']),
('werkstatt', 'Luftfilter', 'Filter', 'Stk', 
 ARRAY['luftfilter', 'motorluftfilter', 'luftfiltereinsatz']),
('werkstatt', 'Pollenfilter', 'Filter', 'Stk', 
 ARRAY['pollenfilter', 'innenraumfilter', 'aktivkohlefilter', 'klimafilter']);

-- Trigger für updated_at
CREATE TRIGGER update_text_normalizations_updated_at
  BEFORE UPDATE ON public.text_normalizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();