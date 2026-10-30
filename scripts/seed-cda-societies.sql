INSERT INTO property_intelligence.societies (id, name, city, zone, road, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Islamabad', v.zone, v.road, v.area, v.noc, v.summ, 'https://www.cda.gov.pk/housing-schemes', 'FACT'
FROM (VALUES
('CBR Town','Zone 5','IHW',1687.85,true,'CDA list: LOP Approved; NOC Issued'),
('Engineers Co-operative Housing Society','Zone 5','GT Road',4298,false,'CDA list: LOP Approved; NOC Not Issued'),
('Engineers Housing Scheme','Zone 2','GT Road',1156.29,true,'CDA list: LOP Approved; NOC Issued'),
('Faisal Residencia Housing Scheme','Zone 2','E.F Principal Road',1220.60,false,'CDA list: LOP Approved; NOC Not Issued'),
('Federal Government Employees Housing Foundation (FGEHF)','Zone 4','GT Road',3090,false,'CDA list: LOP Approved; NOC Not Issued'),
('Federation of Employees','Zone 2','GT Road',443,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('FIA Park Enclave Housing Scheme','Zone 4','GT Road',401.97,false,'CDA list: LOP Approved; NOC Not Issued'),
('Grace Valley','Zone 5','GT Road',436,true,'CDA list: LOP Approved; NOC Issued'),
('Gulberg Greens Farm Housing Scheme','Zone 4','GT Road',3862,true,'CDA list: LOP Approved; NOC Issued'),
('Gulberg Residencia (IBECHS Ph-III) Housing Scheme','Zone 5','GT Road',19390.36,true,'CDA list: LOP Approved; NOC Issued'),
('Gulshan-e-Rabia','Zone 5','GT Road',447,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Gulshan-e-Sehat','Zone 5','GT Road',1748,true,'CDA list: LOP Approved; NOC Issued'),
('Icon Garden','Zone 5','GT Road',146.92,false,'CDA list: LOP Approved; NOC Not Issued'),
('Islamabad Gardens','Zone 5','GT Road',811.50,true,'CDA list: LOP Approved; NOC Issued'),
('Islamabad Model Town','Zone 4','GT Road',423,false,'CDA list: LOP Approved; NOC Not Issued'),
('Jeddah Town','Zone 5','GT Road',800,true,'CDA list: LOP Approved; NOC Issued'),
('Jinnah Garden Phase-1 Extension','Zone 5','GT Road',1826.50,false,'CDA list: LOP Approved; NOC Not Issued'),
('Jinnah Garden, Phase-I','Zone 5','Islamabad Expressway',2548,false,'CDA list: LOP Cancelled; NOC Not Issued')
) AS v(name, zone, road, area, noc, summ)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies s WHERE lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.societies (id, name, city, zone, road, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Islamabad', v.zone, v.road, v.area, v.noc, v.summ, 'https://www.cda.gov.pk/housing-schemes', 'FACT'
FROM (VALUES
('Jinnah Garden, Phase-II','Zone 5','GT Road',430,false,'CDA list: LOP Approved; NOC Not Issued'),
('Jinnah Town','Zone 5','GT Road',2549,false,'CDA list: LOP Approved; NOC Not Issued'),
('Kashmir Gardens Farming Scheme','Zone 5','GT Road',2660.13,false,'CDA list: LOP Provisional Approval; NOC Not Issued'),
('Khayaban-e-Kashmir, Phase (Extension)','Zone 2','GT Road',3325,false,'CDA list: LOP Approved; NOC Not Issued'),
('Khayaban-e-Kashmir, Phase-I','Zone 2','GT Road',3482.62,true,'CDA list: LOP Approved; NOC Issued'),
('Khayaban-e-Kashmir, Phase-II','Zone 5','GT Road',1345,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Margalla View Housing Scheme','Zone 2','GT Road',1912.02,false,'CDA list: LOP Approved; NOC Not Issued'),
('Margalla View Housing Scheme (Extension)','Zone 2','GT Road',292.25,true,'CDA list: LOP Approved; NOC Issued'),
('Ministry of Interior Employees Co-operative Housing Society','Zone 2','GT Road',1630,true,'CDA list: LOP Approved; NOC Issued'),
('Morgah City','Zone 5','GT Road',882,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Multi Gardens, Phase-I','Zone 2','GT Road',4815.75,true,'CDA list: LOP Approved; NOC Issued'),
('Multi Gardens, Phase-II','Zone 2','GT Road',4480,true,'CDA list: LOP Approved; NOC Issued'),
('National Assembly Employees Cooperative Housing Society (NAECHS)','Zone 5','GT Road',407,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('National Cooperative Housing Society & New Islamabad Enclave','Zone 5','GT Road',1037,false,'CDA list: LOP Approved; NOC Not Issued'),
('National Police Foundation','Zone 2','GT Road',1325,false,'CDA list: LOP Approved; NOC Cancelled'),
('Naval Anchorage','Zone 5','GT Road',3702.70,true,'CDA list: LOP Approved; NOC Issued'),
('New Islamabad Garden','Zone 2','GT Road',800,false,'CDA list: LOP Approved; NOC Cancelled'),
('OPF Housing Scheme','Zone 5','GT Road',4683.25,true,'CDA list: LOP Approved; NOC Issued')
) AS v(name, zone, road, area, noc, summ)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies s WHERE lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.societies (id, name, city, zone, road, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Islamabad', v.zone, v.road, v.area, v.noc, v.summ, 'https://www.cda.gov.pk/housing-schemes', 'FACT'
FROM (VALUES
('Pakistan Medical Cooperative Housing Scheme','Zone 1','Islamabad Expressway',276,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Pakistan Navy Farms, Simly Dam Road, Islamabad','Zone 4','GT Road',2343.26,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Paradise City','Zone 2','Fateh Jang Road',1900,true,'CDA list: LOP Approved; NOC Issued'),
('Park View City Housing Scheme','Zone 4','GT Road',1067.90,true,'CDA list: LOP Approved; NOC Approved'),
('Parliamentarians Enclave','Zone 5','GT Road',414,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Rahman Enclave Housing Scheme','Zone 4','GT Road',705.68,true,'CDA list: LOP Approved; NOC Issued'),
('River Garden','Zone 5','GT Road',1079.17,false,'CDA list: LOP Approved; NOC Not Issued'),
('Roshan Pakistan (RP) Corporation Housing Scheme','Zone 2','GT Road',1619,false,'CDA list: LOP Cancelled; NOC Cancelled'),
('Senate Avenue','Zone 5','GT Road',680,true,'CDA list: LOP Approved; NOC Issued'),
('Services Co-operative Housing Society','Zone 5','GT Road',255,false,'CDA list: LOP Cancelled; NOC Not Issued'),
('Soan Garden Housing Scheme','Zone 5','Islamabad Expressway',2985,false,'CDA list: LOP Approved; NOC Cancelled'),
('Supreme Court Employees Housing Scheme','Zone 2','Service Road, Srinagar Highway',2222.06,true,'CDA list: LOP Approved; NOC Issued'),
('T & T Employees Cooperative Housing Society','Zone 2','Fateh Jang Road',1194.7,true,'CDA list: LOP Approved; NOC Issued'),
('Tele Gardens Housing Scheme, F-17, Islamabad','Zone 2','Fateh Jang Road',1757.65,true,'CDA list: LOP Approved; NOC Issued'),
('Tele Town','Zone 5','Dharwala Road',499.5,false,'CDA list: LOP Approved; NOC Not listed'),
('WWF Labor Colony','Zone 5','GT Road',1511,false,'CDA list: LOP Approved; NOC Not Issued'),
('Zaraj Housing','Zone 5','HUMAK',1564,true,'CDA list: LOP Approved; NOC Issued')
) AS v(name, zone, road, area, noc, summ)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies s WHERE lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

WITH v(name, claim, eid) AS (VALUES
('CBR Town','CDA list: LOP Approved; NOC Issued','e1d1c7d7-bc21-57af-a242-fa5403bdbf58'),
('Engineers Co-operative Housing Society','CDA list: LOP Approved; NOC Not Issued','205cbc1b-17e3-5844-82bf-9d243410ae0c'),
('Engineers Housing Scheme','CDA list: LOP Approved; NOC Issued','2343c56a-5ee5-50c0-8a37-2778382146bf'),
('Faisal Residencia Housing Scheme','CDA list: LOP Approved; NOC Not Issued','ecb98de1-ff06-505b-b981-5de9cf1ae504'),
('Federal Government Employees Housing Foundation (FGEHF)','CDA list: LOP Approved; NOC Not Issued','1277bbe8-dc6a-52ae-94d2-d798684151d2'),
('Federation of Employees','CDA list: LOP Cancelled; NOC Not Issued','ba63e58d-ff33-552e-93a5-c066b5b28f4e'),
('FIA Park Enclave Housing Scheme','CDA list: LOP Approved; NOC Not Issued','d7653fd1-b32c-5560-93a4-7e72fd7cd795'),
('Grace Valley','CDA list: LOP Approved; NOC Issued','1669e078-c562-5c3e-b4aa-b8b6a9df8662'),
('Gulberg Greens Farm Housing Scheme','CDA list: LOP Approved; NOC Issued','71514bab-93f3-5829-81ed-77771495edad'),
('Gulberg Residencia (IBECHS Ph-III) Housing Scheme','CDA list: LOP Approved; NOC Issued','b7375ab9-1dbc-54b3-aa04-9b9b75a0ec98'),
('Gulshan-e-Rabia','CDA list: LOP Cancelled; NOC Not Issued','b90803ef-bc36-5939-b838-c87a448f4136'),
('Gulshan-e-Sehat','CDA list: LOP Approved; NOC Issued','a64a912d-9afb-54a6-8066-5a2520b2aea8'),
('Icon Garden','CDA list: LOP Approved; NOC Not Issued','0bed6899-0eb8-5274-a8a4-2cfd6798d752'),
('Islamabad Gardens','CDA list: LOP Approved; NOC Issued','b6f159a8-5c84-5ce9-8a94-390582ef8dc6'),
('Islamabad Model Town','CDA list: LOP Approved; NOC Not Issued','4e6e7224-7531-5d6f-9c4d-8730a78ad514'),
('Jeddah Town','CDA list: LOP Approved; NOC Issued','f5e5e449-6bd3-5913-86b6-137e029043f1'),
('Jinnah Garden Phase-1 Extension','CDA list: LOP Approved; NOC Not Issued','5d2185b4-5c89-5502-8b62-c18890410704'),
('Jinnah Garden, Phase-I','CDA list: LOP Cancelled; NOC Not Issued','7e22cc6f-b44a-5e22-85de-92f89f845dbc')
),
t AS (SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')),
ev AS (INSERT INTO trust.evidence (id, type, file_ref, source_ref, record_type) SELECT eid, 'document', 'https://www.cda.gov.pk/housing-schemes', 'CDA private housing schemes list, cda.gov.pk, read 2026-10-30', 'FACT' FROM t RETURNING id)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs) SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid) AS (VALUES
('Jinnah Garden, Phase-II','CDA list: LOP Approved; NOC Not Issued','3c7d18e6-76de-59aa-99ae-889395dcfffd'),
('Jinnah Town','CDA list: LOP Approved; NOC Not Issued','732ce237-ca2f-51c5-984e-14ca0fd16932'),
('Kashmir Gardens Farming Scheme','CDA list: LOP Provisional Approval; NOC Not Issued','be6cf334-978f-5868-b885-c832c376ae34'),
('Khayaban-e-Kashmir, Phase (Extension)','CDA list: LOP Approved; NOC Not Issued','63e4a727-9108-5c11-97b8-1b227bf74ea8'),
('Khayaban-e-Kashmir, Phase-I','CDA list: LOP Approved; NOC Issued','62bfe723-1fb6-5a15-8dc0-8133a187ecd5'),
('Khayaban-e-Kashmir, Phase-II','CDA list: LOP Cancelled; NOC Not Issued','aec8f46c-7436-5622-b19a-04128448f4b1'),
('Margalla View Housing Scheme','CDA list: LOP Approved; NOC Not Issued','e47238e5-f84b-586b-b57a-48cdba25b0d5'),
('Margalla View Housing Scheme (Extension)','CDA list: LOP Approved; NOC Issued','3b7309e6-f449-5e6f-9f2a-a0de6ad2b30c'),
('Ministry of Interior Employees Co-operative Housing Society','CDA list: LOP Approved; NOC Issued','b738e6d5-6737-569c-80b5-5f1a9122bf17'),
('Morgah City','CDA list: LOP Cancelled; NOC Not Issued','fb075640-382f-5e6d-bf24-71878d1d5722'),
('Multi Gardens, Phase-I','CDA list: LOP Approved; NOC Issued','0fd1611b-0a79-5606-873d-6404cbcebd1b'),
('Multi Gardens, Phase-II','CDA list: LOP Approved; NOC Issued','75531d60-d4eb-5306-8e61-8060b76307e3'),
('National Assembly Employees Cooperative Housing Society (NAECHS)','CDA list: LOP Cancelled; NOC Not Issued','67f576d0-67e3-56d5-afb7-0343ee7ca74e'),
('National Cooperative Housing Society & New Islamabad Enclave','CDA list: LOP Approved; NOC Not Issued','e56d19bc-f998-5203-84dd-a0adf7cc0dda'),
('National Police Foundation','CDA list: LOP Approved; NOC Cancelled','9f878183-7aac-5612-bf38-ee86f009a5c0'),
('Naval Anchorage','CDA list: LOP Approved; NOC Issued','a10010ed-5d2e-5926-a2dc-f78fa6adfa88'),
('New Islamabad Garden','CDA list: LOP Approved; NOC Cancelled','39c395ce-de54-5645-9448-f657b015056f'),
('OPF Housing Scheme','CDA list: LOP Approved; NOC Issued','7fb13ec7-eeaa-55d4-a6bc-203c2c0ad363')
),
t AS (SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')),
ev AS (INSERT INTO trust.evidence (id, type, file_ref, source_ref, record_type) SELECT eid, 'document', 'https://www.cda.gov.pk/housing-schemes', 'CDA private housing schemes list, cda.gov.pk, read 2026-10-30', 'FACT' FROM t RETURNING id)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs) SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid) AS (VALUES
('Pakistan Medical Cooperative Housing Scheme','CDA list: LOP Cancelled; NOC Not Issued','2fe067b3-9a2f-5f56-b01a-a7283e9f6106'),
('Pakistan Navy Farms, Simly Dam Road, Islamabad','CDA list: LOP Cancelled; NOC Not Issued','60f533c0-a648-5138-9e6a-98cd5d22421d'),
('Paradise City','CDA list: LOP Approved; NOC Issued','eafb04c0-2620-56a6-97c9-0e1a645f7ec8'),
('Park View City Housing Scheme','CDA list: LOP Approved; NOC Approved','4372820a-1150-5200-b19e-e2643429e89b'),
('Parliamentarians Enclave','CDA list: LOP Cancelled; NOC Not Issued','d1268b12-5be1-5c71-abb2-87dbbbdb58a9'),
('Rahman Enclave Housing Scheme','CDA list: LOP Approved; NOC Issued','78d0ce3f-19b8-5498-9d4d-3b0d275f1d98'),
('River Garden','CDA list: LOP Approved; NOC Not Issued','9cb88438-7358-5dcc-bad9-21886271ce07'),
('Roshan Pakistan (RP) Corporation Housing Scheme','CDA list: LOP Cancelled; NOC Cancelled','848df93f-0ca9-594f-b6ad-23c19d8f13f0'),
('Senate Avenue','CDA list: LOP Approved; NOC Issued','6f7ed6be-6a56-50b9-ae3e-ca2051b6fca9'),
('Services Co-operative Housing Society','CDA list: LOP Cancelled; NOC Not Issued','8eb6dc6f-7b77-5341-900d-f2902d265faf'),
('Soan Garden Housing Scheme','CDA list: LOP Approved; NOC Cancelled','6edf0ee6-0811-5c51-ab3d-93a18068124e'),
('Supreme Court Employees Housing Scheme','CDA list: LOP Approved; NOC Issued','8e61cf30-3ff3-503b-aabd-da6411575984'),
('T & T Employees Cooperative Housing Society','CDA list: LOP Approved; NOC Issued','8ba03668-087f-5ca5-b371-2d3b99c101ed'),
('Tele Gardens Housing Scheme, F-17, Islamabad','CDA list: LOP Approved; NOC Issued','3dd896d5-bf98-5840-b564-0f8f6c639650'),
('Tele Town','CDA list: LOP Approved; NOC Not listed','3cc106f6-08f2-571e-8674-5a8f3e316dc0'),
('WWF Labor Colony','CDA list: LOP Approved; NOC Not Issued','7f4f9930-83e3-5e62-96a6-43bf53cad358'),
('Zaraj Housing','CDA list: LOP Approved; NOC Issued','3ce566ae-66d6-50ae-883d-e98e176799ad')
),
t AS (SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')),
ev AS (INSERT INTO trust.evidence (id, type, file_ref, source_ref, record_type) SELECT eid, 'document', 'https://www.cda.gov.pk/housing-schemes', 'CDA private housing schemes list, cda.gov.pk, read 2026-10-30', 'FACT' FROM t RETURNING id)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs) SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

UPDATE property_intelligence.candidate_societies SET status = 'ONBOARDED' WHERE regulator = 'CDA' AND status = 'NOT_STARTED' AND lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) IN (SELECT lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) FROM property_intelligence.societies s WHERE s.city = 'Islamabad');