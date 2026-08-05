-- Capability 3: Verification, Evidence, Developer, and Property seed data.
-- All records are FACT type unless noted. UUIDs are stable for dev/test referencing.
-- Run AFTER seed-societies.sql (societies must exist before properties reference them).

-- ─── Trust: Verifications ────────────────────────────────────────────────────

SET search_path = trust;

INSERT INTO verifications (id, subject_type, subject_id, claim, status, evidence_refs, verified_at)
VALUES
(
  'b1b2c3d4-0001-0001-0001-000000000001',
  'SOCIETY',
  'a1b2c3d4-0001-0001-0001-000000000001', -- Park View City
  'NOC Approved by CDA',
  'VERIFIED',
  ARRAY['e1b2c3d4-0001-0001-0001-000000000001', 'e1b2c3d4-0001-0001-0001-000000000002'],
  NOW()
),
(
  'b1b2c3d4-0002-0002-0002-000000000002',
  'SOCIETY',
  'a1b2c3d4-0002-0002-0002-000000000002', -- CDA Sector F-10
  'NOC Approved by CDA',
  'VERIFIED',
  ARRAY['e1b2c3d4-0002-0002-0002-000000000001'],
  NOW()
),
(
  'b1b2c3d4-0003-0003-0003-000000000003',
  'SOCIETY',
  'a1b2c3d4-0003-0003-0003-000000000003', -- Bahria Town Rawalpindi (verification pending)
  'NOC Approved by RDA',
  'PENDING',
  ARRAY[]::text[],
  NULL
),
(
  'b1b2c3d4-9999-9999-9999-000000000099',
  'SOCIETY',
  'a1b2c3d4-9999-9999-9999-000000000099', -- Zoraiz Heights
  'NOC Approved by CDA',
  'VERIFIED',
  ARRAY['e1b2c3d4-9999-9999-9999-000000000099'],
  NOW()
),
(
  'b2b2c3d4-0001-0001-0001-000000000001',
  'DEVELOPER',
  'd1b2c3d4-0001-0001-0001-000000000001', -- DHA Development Authority
  'Registered developer in good standing',
  'VERIFIED',
  ARRAY['e2b2c3d4-0001-0001-0001-000000000001'],
  NOW()
),
(
  'b2b2c3d4-0002-0002-0002-000000000002',
  'DEVELOPER',
  'd1b2c3d4-0002-0002-0002-000000000002', -- Imtiaz Builders (pending)
  'Registered developer in good standing',
  'PENDING',
  ARRAY[]::text[],
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- ─── Trust: Evidence ─────────────────────────────────────────────────────────

INSERT INTO evidence (id, type, file_ref, source_ref, record_type)
VALUES
-- Park View City evidence (2 docs)
(
  'e1b2c3d4-0001-0001-0001-000000000001',
  'document',
  'trust/pvc/noc-cda-2021.pdf',
  'CDA Portal — NOC No. CDA/D-16/2021/PVC',
  'FACT'
),
(
  'e1b2c3d4-0001-0001-0001-000000000002',
  'document',
  'trust/pvc/layout-approval-2022.pdf',
  'CDA Portal — Layout Plan Approval 2022',
  'FACT'
),
-- CDA Sector F-10 evidence (1 doc)
(
  'e1b2c3d4-0002-0002-0002-000000000001',
  'document',
  'trust/f10/noc-cda-sector.pdf',
  'CDA Official Records — Sector F-10 Development Approval',
  'FACT'
),
-- Zoraiz Heights evidence (1 doc)
(
  'e1b2c3d4-9999-9999-9999-000000000099',
  'document',
  'trust/zoraiz/noc-cda-zoraiz.pdf',
  'CDA Portal — NOC No. CDA/D-16/2023/ZH',
  'FACT'
),
-- DHA Development Authority evidence (1 doc)
(
  'e2b2c3d4-0001-0001-0001-000000000001',
  'document',
  'trust/dha/registration-cert.pdf',
  'NAPHDA — Developer Registration Certificate No. NPH/2019/DHA-ISB',
  'FACT'
)
ON CONFLICT (id) DO NOTHING;

-- ─── Property Intelligence: Developers ───────────────────────────────────────

SET search_path = property_intelligence;

INSERT INTO developers (id, name, project_history, is_siraat_affiliated)
VALUES
(
  'd1b2c3d4-0001-0001-0001-000000000001',
  'DHA Development Authority',
  ARRAY['DHA Phase 1 Islamabad', 'DHA Phase 2 Islamabad', 'DHA Rawalpindi Phase 5'],
  false
),
(
  'd1b2c3d4-0002-0002-0002-000000000002',
  'Imtiaz Builders',
  ARRAY['Imtiaz Garden Rawalpindi', 'Imtiaz Residencia Islamabad'],
  false
)
ON CONFLICT (id) DO NOTHING;

-- ─── Property Intelligence: Properties ───────────────────────────────────────
-- 2–3 individual properties per existing society so Property Details has real data

INSERT INTO properties (id, society_id, owner_ref, address, price, listing_source, status, property_type, area_marla)
VALUES
-- Park View City (3 properties)
(
  'b1b2c3d4-0001-0001-0001-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  NULL,
  'Plot A-14, Sector A, Park View City, Islamabad',
  22000000,
  'Zameen.com',
  'LISTED',
  'PLOT',
  10
),
(
  'b1b2c3d4-0001-0001-0001-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  NULL,
  'Plot B-22, Sector B, Park View City, Islamabad',
  27500000,
  'OLX Pakistan',
  'ACTIVE',
  'PLOT',
  14
),
(
  'b1b2c3d4-0001-0001-0001-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  NULL,
  'House 7, Block C, Park View City, Islamabad',
  48000000,
  'Zameen.com',
  'LISTED',
  'HOUSE',
  10
),
-- CDA Sector F-10 (2 properties)
(
  'b1b2c3d4-0002-0002-0002-000000000001',
  'a1b2c3d4-0002-0002-0002-000000000002',
  NULL,
  'House 41, Street 5, F-10/2, Islamabad',
  85000000,
  'CDA Auction',
  'ACTIVE',
  'HOUSE',
  10
),
(
  'b1b2c3d4-0002-0002-0002-000000000002',
  'a1b2c3d4-0002-0002-0002-000000000002',
  NULL,
  'Plot 12, F-10 Markaz, Islamabad',
  120000000,
  'Direct',
  'LISTED',
  'PLOT',
  60
),
-- Bahria Town Rawalpindi (2 properties)
(
  'b1b2c3d4-0003-0003-0003-000000000001',
  'a1b2c3d4-0003-0003-0003-000000000003',
  NULL,
  'Flat 3B, Tower 2, Bahria Town Rawalpindi',
  15000000,
  'Zameen.com',
  'LISTED',
  'APARTMENT',
  5
),
(
  'b1b2c3d4-0003-0003-0003-000000000002',
  'a1b2c3d4-0003-0003-0003-000000000003',
  NULL,
  'Plot 88, Block D, Bahria Town Rawalpindi',
  18000000,
  'OLX Pakistan',
  'LISTED',
  'PLOT',
  10
),
-- Zoraiz Heights (2 properties)
(
  'b1b2c3d4-9999-9999-9999-000000000001',
  'a1b2c3d4-9999-9999-9999-000000000099',
  NULL,
  'Plot Z-01, Phase 1, Zoraiz Heights, Islamabad',
  21000000,
  'Siraat Platform',
  'LISTED',
  'PLOT',
  10
),
(
  'b1b2c3d4-9999-9999-9999-000000000002',
  'a1b2c3d4-9999-9999-9999-000000000099',
  NULL,
  'Plot Z-05, Phase 1, Zoraiz Heights, Islamabad',
  23500000,
  'Siraat Platform',
  'LISTED',
  'PLOT',
  10
)
ON CONFLICT (id) DO NOTHING;
