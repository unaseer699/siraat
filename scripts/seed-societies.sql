-- Seed: 2-3 manually verified societies for Capability 1 testing
-- All records are FACT type; UUIDs are stable for dev/test referencing

SET search_path = property_intelligence;

INSERT INTO societies (
  id, name, city,
  min_price, max_price,
  min_area_marla, max_area_marla,
  property_types,
  noc_approved, base_confidence, is_siraat_affiliated, affiliation_disclosure,
  noc_summary, source_document_ids,
  is_stale, staleness_threshold_days, record_type
) VALUES
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Park View City',
  'Islamabad',
  18000000, 30000000,
  10, 20,
  ARRAY['PLOT', 'HOUSE'],
  true, 0.915, false, NULL,
  'NOC approved by CDA with high development density. Multiple residential sectors handed over.',
  ARRAY['doc_noc_pvc_001', 'doc_layout_pvc_002'],
  false, 30, 'FACT'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'CDA Sector F-10',
  'Islamabad',
  35000000, 120000000,
  7, 60,
  ARRAY['PLOT', 'HOUSE', 'APARTMENT'],
  true, 0.970, false, NULL,
  'CDA-developed sector with full infrastructure and NOC clearance. Established neighbourhood.',
  ARRAY['doc_noc_cda_f10_001'],
  false, 30, 'FACT'
),
(
  'a1b2c3d4-0003-0003-0003-000000000003',
  'Bahria Town Rawalpindi',
  'Rawalpindi',
  12000000, 45000000,
  5, 40,
  ARRAY['PLOT', 'HOUSE', 'APARTMENT', 'COMMERCIAL'],
  true, 0.840, false, NULL,
  'RDA-approved housing scheme with gated community facilities. Active construction ongoing.',
  ARRAY['doc_noc_bahria_rwp_001', 'doc_layout_bahria_rwp_002'],
  false, 30, 'FACT'
)
ON CONFLICT (id) DO NOTHING;
