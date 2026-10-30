-- PDA (Peshawar) lists, https://pda.kp.gov.pk/illegalsocieties, read 2026-10-30: 8 approved ("valid NOC") and 3 un-approved societies.
-- Run the 4 statements one at a time, in order.

INSERT INTO property_intelligence.illegal_schemes (id, name, location, note, name_key, regulator, city, source_url, listed_as_of, is_active, record_type)
SELECT gen_random_uuid(), v.name, v.location, v.note, v.name_key, 'PDA', 'Peshawar', 'https://pda.kp.gov.pk/illegalsocieties', DATE '2026-10-30', true, 'FACT'
FROM (VALUES
('Peshawar Garden','Muza Rasheeda, G.T. Road, Peshawar','PDA lists it as illegal, 280 kanal','pdapeshawargardenmuzarasheedagtroadpeshawar'),
('Omal-Qura','Muza Rasheeda, G.T. Road, Peshawar','PDA lists it as illegal, 60 kanal','pdaomalquramuzarasheedagtroadpeshawar'),
('Madina Residencia','G.T. Road, Peshawar','PDA lists it as illegal, 300 kanal','pdamadinaresidenciagtroadpeshawar')
) AS v(name, location, note, name_key)
ON CONFLICT (name_key) DO NOTHING;

WITH v(name, addr, area, summ) AS (VALUES
('Sheikh Yaseen Town','Nasir Bagh Road, Peshawar',1020,'PDA list: approved, valid NOC'),
('Shaheen Housing Scheme','Warsak Road, Peshawar',400,'PDA list: approved, valid NOC'),
('Zintara Residences','Ring Road, near Charsadda Road, Peshawar',181.36,'PDA list: approved, valid NOC'),
('New University Model Town','Nasir Bagh Road, Peshawar',169,'PDA list: approved, valid NOC'),
('Professors Model Town','Nasir Bagh Road, Peshawar',450,'PDA list: approved, valid NOC'),
('Safia Homes','Warsak Road, Peshawar',186.36,'PDA list: approved, valid NOC'),
('Garden Villas','Service Road M-1, Near Toll Plaza, Peshawar',269,'PDA list: approved, valid NOC'),
('Hasham Babar Town','Mathra, Warsak Road, Peshawar',230,'PDA list: approved, valid NOC')
), s AS (
INSERT INTO property_intelligence.societies (id, name, city, address, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Peshawar', v.addr, v.area, true, v.summ, 'https://pda.kp.gov.pk/illegalsocieties', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies x WHERE x.city = 'Peshawar' AND lower(regexp_replace(x.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')))
RETURNING id
)
INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'PDA', 'Peshawar', 'ONBOARDED', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'PDA' AND lower(regexp_replace(c.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')));

WITH v(name, claim, eid) AS (VALUES
('Sheikh Yaseen Town','PDA list: approved, valid NOC','cfd0bbd5-9581-54e6-b40e-9a64f5cd768b'),
('Shaheen Housing Scheme','PDA list: approved, valid NOC','5e74d63b-5203-5103-b115-6aa1e8d6b47e'),
('Zintara Residences','PDA list: approved, valid NOC','372b303c-69a5-5179-b749-a183e351d175'),
('New University Model Town','PDA list: approved, valid NOC','5ec15205-8d29-54c8-b342-593ec70d4b4a'),
('Professors Model Town','PDA list: approved, valid NOC','0275acf6-3be0-53fc-82df-ef6b39a5b890'),
('Safia Homes','PDA list: approved, valid NOC','6728e830-93ef-5a67-96de-78cde6e7d769'),
('Garden Villas','PDA list: approved, valid NOC','86e73c66-bb14-5802-9cae-6e4ae93d13a1'),
('Hasham Babar Town','PDA list: approved, valid NOC','a4363f1c-435f-5dfa-aadd-d5a3052b77ad')
), t AS (
SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON s.city = 'Peshawar' AND lower(regexp_replace(s.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g'))
WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')
), ev AS (
INSERT INTO trust.evidence (id, type, file_ref, source_ref, document_type, record_type)
SELECT eid, 'document', 'https://pda.kp.gov.pk/illegalsocieties', 'PDA approved housing societies list, pda.kp.gov.pk, read 2026-10-30', 'OTHER', 'FACT' FROM t
ON CONFLICT (id) DO NOTHING
RETURNING id
)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs)
SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

SELECT 'Check: PDA illegal=' || (SELECT count(*) FROM property_intelligence.illegal_schemes WHERE regulator = 'PDA') || ', Peshawar societies=' || (SELECT count(*) FROM property_intelligence.societies WHERE city = 'Peshawar') AS result;
