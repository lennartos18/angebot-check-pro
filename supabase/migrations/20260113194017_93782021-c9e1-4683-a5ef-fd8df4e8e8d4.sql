-- =====================================================
-- PHASE 1.1: External Reference Data (HWK, IHK, Innungen)
-- Referenzpreise für gängige Handwerks- und Kfz-Leistungen
-- Erlaubte source_types: hwk, ihk, innung, fachverband, marktstudie, hersteller_aw
-- =====================================================

-- Handwerk: Elektroinstallation
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('hwk', 'Handwerkskammer Düsseldorf', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'Stunde',
 55.00, 75.00, 65.00, 'https://hwk-duesseldorf.de'),
('hwk', 'Handwerkskammer München', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Bayern', 'bundesland', 'Stunde',
 60.00, 85.00, 72.00, 'https://hwk-muenchen.de'),
('hwk', 'Handwerkskammer Stuttgart', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Baden-Württemberg', 'bundesland', 'Stunde',
 58.00, 80.00, 68.00, 'https://hwk-stuttgart.de');

-- Handwerk: Sanitärinstallation
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('innung', 'Sanitär-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'Stunde',
 52.00, 72.00, 62.00, NULL),
('innung', 'Sanitär-Innung Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Bayern', 'bundesland', 'Stunde',
 58.00, 78.00, 68.00, NULL),
('innung', 'Sanitär-Innung BaWü', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Baden-Württemberg', 'bundesland', 'Stunde',
 55.00, 75.00, 65.00, NULL);

-- Handwerk: Malerarbeiten
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('hwk', 'Maler-Innung Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 8.00, 18.00, 12.00, NULL),
('hwk', 'Maler-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'qm',
 9.00, 16.00, 12.50, NULL),
('hwk', 'Maler-Innung Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Bayern', 'bundesland', 'qm',
 10.00, 20.00, 14.00, NULL);

-- Handwerk: Fliesenarbeiten
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('innung', 'Fliesen-Innung Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 35.00, 75.00, 52.00, NULL),
('innung', 'Fliesen-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'qm',
 38.00, 70.00, 50.00, NULL),
('innung', 'Fliesen-Innung Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Bayern', 'bundesland', 'qm',
 40.00, 80.00, 55.00, NULL);

-- Handwerk: Heizungsinstallation
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('ihk', 'IHK Heizung-Klima Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stunde',
 58.00, 85.00, 70.00, NULL),
('hwk', 'Heizungsbauer-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'Stunde',
 55.00, 80.00, 67.00, NULL),
('hwk', 'Heizungsbauer-Innung Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Bayern', 'bundesland', 'Stunde',
 60.00, 90.00, 75.00, NULL);

-- Handwerk: Tischler/Schreiner
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('hwk', 'Tischler-Innung Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stunde',
 50.00, 75.00, 62.00, NULL),
('hwk', 'Schreiner-Innung Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Bayern', 'bundesland', 'Stunde',
 55.00, 85.00, 68.00, NULL);

-- Handwerk: Dachdecker
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('innung', 'Dachdecker-Innung Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 45.00, 120.00, 75.00, NULL),
('innung', 'Dachdecker-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'qm',
 50.00, 110.00, 72.00, NULL);

-- Handwerk: Bodenleger/Parkett
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('hwk', 'Parkett-Innung Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 25.00, 60.00, 38.00, NULL),
('hwk', 'Bodenleger-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', 'Nordrhein-Westfalen', 'bundesland', 'qm',
 22.00, 55.00, 35.00, NULL);

-- =====================================================
-- Kfz-Werkstatt: Arbeitsstunden (source_type: marktstudie)
-- =====================================================
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('ihk', 'Kfz-Innung Deutschland', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', NULL, 'bundesweit', 'AW',
 1.20, 2.50, 1.80, NULL),
('ihk', 'Kfz-Innung NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Nordrhein-Westfalen', 'bundesland', 'AW',
 1.30, 2.20, 1.70, NULL),
('ihk', 'Kfz-Innung Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Bayern', 'bundesland', 'AW',
 1.40, 2.80, 2.00, NULL),
('ihk', 'Kfz-Innung BaWü', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Baden-Württemberg', 'bundesland', 'AW',
 1.35, 2.60, 1.90, NULL);

-- Kfz: Stundensätze freie Werkstätten (marktstudie)
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('marktstudie', 'DAT-Report 2025', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', NULL, 'bundesweit', 'Stunde',
 75.00, 130.00, 98.00, 'https://dat.de/report'),
('marktstudie', 'DAT-Report NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Nordrhein-Westfalen', 'bundesland', 'Stunde',
 70.00, 120.00, 92.00, NULL),
('marktstudie', 'DAT-Report Bayern', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Bayern', 'bundesland', 'Stunde',
 80.00, 145.00, 105.00, NULL);

-- Kfz: Ölwechsel pauschal (marktstudie)
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('marktstudie', 'ADAC Preisvergleich', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', NULL, 'bundesweit', 'pauschal',
 89.00, 180.00, 120.00, 'https://adac.de'),
('marktstudie', 'ADAC NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Nordrhein-Westfalen', 'bundesland', 'pauschal',
 85.00, 160.00, 115.00, NULL);

-- Kfz: Bremsenwechsel (fachverband)
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('fachverband', 'Kfz-Marktpreise DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', NULL, 'bundesweit', 'Achse',
 180.00, 450.00, 280.00, NULL),
('fachverband', 'Kfz-Marktpreise NRW', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', 'Nordrhein-Westfalen', 'bundesland', 'Achse',
 170.00, 400.00, 260.00, NULL);

-- Kfz: Zahnriemenwechsel (fachverband)
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('fachverband', 'Kfz-Marktpreise DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', NULL, 'bundesweit', 'pauschal',
 400.00, 1200.00, 650.00, NULL);

-- Kfz: HU/AU (fachverband)
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
('fachverband', 'TÜV/DEKRA Durchschnitt', '2025-01-01', '2025-01-01', '2025-12-31',
 'kfz', NULL, 'bundesweit', 'pauschal',
 100.00, 180.00, 140.00, NULL);

-- =====================================================
-- Handwerk: Materialpreise Referenz
-- =====================================================
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
-- Elektro-Material
('hwk', 'Elektro-Material DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stück',
 2.50, 8.00, 4.50, NULL),
-- Sanitär-Material
('hwk', 'Sanitär-Material DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stück',
 15.00, 120.00, 45.00, NULL),
-- Farbe/Lack
('hwk', 'Farbe-Material DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Liter',
 8.00, 35.00, 18.00, NULL),
-- Fliesen
('hwk', 'Fliesen-Material DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 15.00, 80.00, 35.00, NULL),
-- Parkett
('hwk', 'Parkett-Material DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 25.00, 120.00, 55.00, NULL);

-- =====================================================
-- Weitere Handwerks-Leistungen
-- =====================================================
INSERT INTO external_reference_data (
  source_type, source_name, source_date, valid_from, valid_until,
  service_domain, bundesland, region_type, unit,
  price_min, price_max, price_median, source_url
) VALUES
-- Gartenbau/Landschaftsbau
('hwk', 'GaLaBau-Innung DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stunde',
 45.00, 70.00, 55.00, NULL),
-- Metallbau
('hwk', 'Metallbau-Innung DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stunde',
 55.00, 85.00, 68.00, NULL),
-- Maurerarbeiten
('hwk', 'Maurer-Innung DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stunde',
 48.00, 72.00, 58.00, NULL),
-- Trockenbau
('hwk', 'Trockenbau-Innung DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'qm',
 28.00, 55.00, 38.00, NULL),
-- Fenster/Türen Montage
('hwk', 'Fensterbauer-Innung DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stück',
 80.00, 200.00, 130.00, NULL),
-- Rollladenbau
('hwk', 'Rollladen-Innung DE', '2025-01-01', '2025-01-01', '2025-12-31',
 'handwerk', NULL, 'bundesweit', 'Stück',
 150.00, 400.00, 250.00, NULL);