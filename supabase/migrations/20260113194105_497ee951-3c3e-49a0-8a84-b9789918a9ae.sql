-- =====================================================
-- PHASE 1.2: Test-Dokumente und Vergleichsdaten erstellen
-- =====================================================

-- Schritt 1: Erstelle Test-Dokumente für verschiedene Regionen
INSERT INTO documents (
  id, time_bucket, service_domain, document_type, submission_date,
  region_cluster_id, position_count, total_net_amount, total_gross_amount
) VALUES
-- NRW Dokumente (Düsseldorf PLZ 40)
('d0000001-0001-0001-0001-000000000001', '2025-Q1', 'handwerk', 'angebot', '2025-01-10',
 (SELECT id FROM region_clusters WHERE plz_prefix = '40' LIMIT 1), 5, 2500.00, 2975.00),
('d0000001-0001-0001-0001-000000000002', '2025-Q1', 'handwerk', 'angebot', '2025-01-15',
 (SELECT id FROM region_clusters WHERE plz_prefix = '40' LIMIT 1), 4, 1800.00, 2142.00),
('d0000001-0001-0001-0001-000000000003', '2024-Q4', 'handwerk', 'rechnung', '2024-12-20',
 (SELECT id FROM region_clusters WHERE plz_prefix = '40' LIMIT 1), 6, 3200.00, 3808.00),

-- Bayern Dokumente (München PLZ 80)
('d0000001-0001-0001-0001-000000000004', '2025-Q1', 'handwerk', 'angebot', '2025-01-08',
 (SELECT id FROM region_clusters WHERE plz_prefix = '80' LIMIT 1), 5, 2800.00, 3332.00),
('d0000001-0001-0001-0001-000000000005', '2025-Q1', 'handwerk', 'angebot', '2025-01-12',
 (SELECT id FROM region_clusters WHERE plz_prefix = '80' LIMIT 1), 4, 2200.00, 2618.00),
('d0000001-0001-0001-0001-000000000006', '2024-Q4', 'handwerk', 'rechnung', '2024-11-25',
 (SELECT id FROM region_clusters WHERE plz_prefix = '80' LIMIT 1), 5, 2600.00, 3094.00),

-- Berlin Dokumente (PLZ 10)
('d0000001-0001-0001-0001-000000000007', '2025-Q1', 'handwerk', 'angebot', '2025-01-05',
 'ed6031a8-f862-4bb0-a4c0-602a9ed70851', 4, 1900.00, 2261.00),
('d0000001-0001-0001-0001-000000000008', '2024-Q4', 'handwerk', 'rechnung', '2024-12-10',
 'ed6031a8-f862-4bb0-a4c0-602a9ed70851', 5, 2400.00, 2856.00),

-- Hamburg Dokumente (PLZ 20)
('d0000001-0001-0001-0001-000000000009', '2025-Q1', 'handwerk', 'angebot', '2025-01-11',
 'd637d26b-5740-42e7-b796-e76d0c57acf8', 3, 1500.00, 1785.00),

-- Kfz Dokumente
('d0000001-0001-0001-0001-000000000010', '2025-Q1', 'werkstatt', 'rechnung', '2025-01-09',
 (SELECT id FROM region_clusters WHERE plz_prefix = '40' LIMIT 1), 4, 450.00, 535.50),
('d0000001-0001-0001-0001-000000000011', '2025-Q1', 'werkstatt', 'angebot', '2025-01-14',
 (SELECT id FROM region_clusters WHERE plz_prefix = '80' LIMIT 1), 5, 680.00, 809.20),
('d0000001-0001-0001-0001-000000000012', '2024-Q4', 'werkstatt', 'rechnung', '2024-12-18',
 'ed6031a8-f862-4bb0-a4c0-602a9ed70851', 3, 320.00, 380.80);