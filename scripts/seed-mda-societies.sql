-- MDA (Multan) approved private housing schemes / land sub-divisions, 61 rows read 2026-10-30 from https://mda.punjab.gov.pk/system/files/approved.pdf
-- (a scanned list: names, mouza and road only; areas and dates not loaded). Run the 3 statements one at a time, in order.

WITH v(name, addr, summ) AS (VALUES
('ADAMS Housing','Mouza Jahangirabad, Matital Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Al-Falah Defence City','Mouza Durana Langana, Matital Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Alfalah Dubai LSD','Mouza Durana Langana, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Al-Falah Sharjah City LSD','Mouza Durana Langana, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Al-Jannat Homes LSD','Mouza Taraf Mubarak Doem, Off Nawab Pur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Buch Executive Villas (Extension)','Mouza Buch Khusro Abad, Bosan Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Buch Executive Villas Phase-II','Mouza Buch Khusro Abad, Bosan Road Multan','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Buch LSD','Mouza Buch Khusro Abad, Bosan Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Buch Villas Extension-I','Mouza Buch Khusro Abad, Bosan Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Buch Villas HS','Mouza Buch Khusrao Abad, Bosan Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('BZU Teachers Housing Project-I','Mouza Durrana Langana, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Canal Cantt View LSD','Mouza Langrial, Langrial Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Cantt Canal View LSD','Mouza Langrial, Langrial Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Citi Housing HS','Mouza Lutf Abad, Bosan Road Multan','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Citi Housing Private Ltd','Mouza Lutf Abad, Bosan Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Classic Villas','Mouza Sajri, Shuja Abad Canal Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Faiz-e-Aam Homes LSD','Mouza Basti Nau, Nawabpur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Falah-ud-Din City LSD','Mouza Durana Langana, Matital Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Fatima LSD','Mouza Dura Langana, MA Jinnah Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Grand Enclave LSD','Mouza Durana Langana, Northern Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Green Avenue LSD','Mouza Kotla Matarban, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Hamza Villas LSD','Mouza Durana Langana, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Ibrahim LSD','Mouza Durana Langana, Northern Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Liberty Homes / Royal Garden','Mouza Durana Langana, Northern Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('MDA Officers Cooperative Housing Society','Mouza Durana Langana, M. A. Jinnah Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('New Crystal City','Mouza Sujjan Pur, LMQ Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Nistarian''s Cooperative Housing','Mouza Salah Mahy, Bosan Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Paramount Villas LSD','Mouza Bua Pur, LMQ Road Multan','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Posh Avenue LSD','Mouza Taraf Mubarak Doem, Ghaus ul Azam Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Royal Orchard (Extension)','Mouza Durana Langana, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Royal Orchard HS','Mouza Durana Langana, Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Sahara LSD','Mouza Durana Langana, Multan Public School Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Sharif City LSD','Mouza Jahangir abad, Off LMQ Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Smart Villas','Mouza Bua Pur, M. A. Jinnah Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('VIP LSD','Mouza Alamdi Surah, Suraj Miani Road','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone'),
('Adeel Bagh LSD','Mouza Samurana, Muzaffar Garh Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Al Jawad Town LSD','Mouza Taraf Daira, Suraj Kund Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Al-Hamd Canal View HS','Mouza Nai Wala, Budhla Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Dream Garden Extension (Dream Cottages) HS','Mouza Kotla Abul Fatah, Askaria Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Eden LSD','Mouza Kotla Muhammad Baqa, Off Bahawal Pur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Ehtesham City LSD','Mouza Kot Rab Nawaz Khan, Southern By Pass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Fahad Town HS','Mouza Hamid Pur Kanora, Multan Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Faisal Cottage (Revised) Phase-II HS','Mouza Kotla Abul Fatah & Rangeel Pur, Old Shujabad Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Fine City HS','Mouza Arazi Ghulam Mustafa, Southern Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Gulastan e Ashar LSD','Mouza Kotla Muhammad Baqa, Off Bahawal Pur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Habib Town LSD','Mouza Dera Muhammadi, Off Bahawalpur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Inam LSD','Mouza Kotla Muhammad Baqa, Wali Muhammad Canal Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Iram LSD','Mouza Kotla Muhammad Baqa, Off Bahawal Pur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Multan Canal View HS','Mouza Dera Muhammadi, Bahawalpur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Nayab City LSD','Mouza Bhaini, Stadium Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Rasheed Avenue LSD','Mouza Ram Kali, Bahawalpur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Razia Saeed HS','Mouza Alamgir, Muzaffargarh Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Revised Dream Garden HS','Mouza Kotla Abul Fatah, Askaria By Pass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Sabzwari Town HS','Mouza Kotla Muhammad Baqa, Near new Shah Shams Colony Vehari Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Sayyam Village HS','Mouza Bhaini & Ram Kali, Southern Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Shah Jahan Canal View HS','Mouza Ram Kali, BahawalPur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Zain Masood LSD','Mouza Bhaini, Dunya Pur Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Revised Green Lane LSD','Mouza Bakhar Arbi, Askaria Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Omega City HS','Mouza Arazi Ghulam Mustafa Khan, Southern Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Hateem City HS','Mouza Kotla Abul Fateh, Askaria Bypass Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone'),
('Khayebane Aziz LSD','Mouza Seer Kharak, Ghouse Azam Road','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone')
), s AS (
INSERT INTO property_intelligence.societies (id, name, city, address, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Multan', v.addr, true, v.summ, 'https://mda.punjab.gov.pk/private-housing-and-land-sub-division', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies x WHERE x.city = 'Multan' AND lower(regexp_replace(x.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')))
RETURNING id
)
INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'MDA', 'Multan', 'ONBOARDED', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'MDA' AND lower(regexp_replace(c.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')));

WITH v(name, claim, eid) AS (VALUES
('ADAMS Housing','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','7985b80a-3d59-5b7c-8373-41f6c303567f'),
('Al-Falah Defence City','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','c889a769-d759-5ff8-bab3-c7fa701bb9a3'),
('Alfalah Dubai LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','17487fd5-758c-55fd-afa5-de645f5535bc'),
('Al-Falah Sharjah City LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','713942b6-0565-52a7-9cc4-d5e358a2f120'),
('Al-Jannat Homes LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','0ed390c5-eba4-5ccc-bdde-ef49fe5a581c'),
('Buch Executive Villas (Extension)','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','d6b1e4f7-450a-5bfe-9251-14e3c05190f6'),
('Buch Executive Villas Phase-II','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','604746b2-fc5a-5ab8-b6cb-773a6e87db82'),
('Buch LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','b8db7258-fabb-5421-a7cc-c124ab4ceee1'),
('Buch Villas Extension-I','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','34f0d20b-3c14-5576-b92b-72a896d49ab3'),
('Buch Villas HS','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','04cbed51-a4b8-539b-a3e5-6d8ec07d4154'),
('BZU Teachers Housing Project-I','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','91ddc2f5-244f-590b-990b-5221d664ce2c'),
('Canal Cantt View LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','2fff4a15-a845-5341-bb89-2cac7271f9bc'),
('Cantt Canal View LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','b9890332-bd69-5cb8-9003-316ac6b3e520'),
('Citi Housing HS','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','66d85b5f-e1cb-5d81-a10f-a82acd0dbafd'),
('Citi Housing Private Ltd','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','b846be88-6931-54ee-9d2e-ec0e6a49551f'),
('Classic Villas','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','dd175fc4-d75d-575a-a94c-15a0eb791ca6'),
('Faiz-e-Aam Homes LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','544e65ac-5863-5f76-9bed-bdccf7ff7151'),
('Falah-ud-Din City LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','fb5edf5d-c695-517c-a877-09fa5973a998'),
('Fatima LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','083478e6-6b28-5e3b-b3f6-8681e5cf52ae'),
('Grand Enclave LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','e8eba156-cc6a-5be3-9021-d0c2f36fd667'),
('Green Avenue LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','67db75dd-3bc3-53d5-99df-dab6a30e577e'),
('Hamza Villas LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','cbeee6d4-117f-583c-b5fd-0ebacf037f0e'),
('Ibrahim LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','efd56706-a0fb-5c9e-87e7-1140e1522929'),
('Liberty Homes / Royal Garden','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','bfbc7376-1ffe-5ddf-b5ed-160db09f61f8'),
('MDA Officers Cooperative Housing Society','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','9e0db7c8-d940-5665-8a38-2b28400c1411'),
('New Crystal City','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','90bb5784-aaf8-5268-9135-223c95420456'),
('Nistarian''s Cooperative Housing','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','95167d92-e18d-5da7-9849-b6ee6f27996a'),
('Paramount Villas LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','307b7a30-e839-501b-a262-08da2b6b288c'),
('Posh Avenue LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','20d8fceb-22f3-5832-9494-fabbbadd2fb9'),
('Royal Orchard (Extension)','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','b094de41-653d-54b8-9e59-fdd5ffc50970'),
('Royal Orchard HS','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','b328890f-6bca-52df-898b-5c1a9d0d87a4'),
('Sahara LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','0d165768-a2e1-5936-9eca-6db532280009'),
('Sharif City LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','afe2cd10-198c-502a-9b9a-2250fd5d6656'),
('Smart Villas','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','4581dc1e-18cc-5489-a5a4-5083b636a31f'),
('VIP LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, North Zone','0f6b8ede-f7ba-521f-bcd2-2f8f1d01249e'),
('Adeel Bagh LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','801df6fe-6a0e-5462-ae7f-6775b0d75339'),
('Al Jawad Town LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','c967fd8a-0ea4-567b-aafe-6c82f4985937'),
('Al-Hamd Canal View HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','0edff2af-4567-5bf2-a2da-387f7a50d1b2'),
('Dream Garden Extension (Dream Cottages) HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','a51e8e0e-cd69-54f3-8c9a-7c078f7fc413'),
('Eden LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','04ca3dd6-48e4-5e41-ae5a-6549427235e7'),
('Ehtesham City LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','f55eb85f-6661-5645-a428-07c5da7e0b1b'),
('Fahad Town HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','1e30abe5-fd57-5b90-9cea-b07575fced3c'),
('Faisal Cottage (Revised) Phase-II HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','4e4c137b-34b6-5868-81fa-3b31b7249acc'),
('Fine City HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','f6633b82-28db-5d1c-9333-caa7941c7dc2'),
('Gulastan e Ashar LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','f94a47fc-b7d8-5633-b01d-473a8889c690'),
('Habib Town LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','6bc58a77-2f8e-5f3d-a1e5-3bfcff6bdaec'),
('Inam LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','f7fbafae-9ec7-5e79-beaa-73c39faa1892'),
('Iram LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','c2e49ab5-02e5-5dbd-806b-5abf37bd3086'),
('Multan Canal View HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','c97ddd9d-33a8-558f-9a45-17147a396c4e'),
('Nayab City LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','c3506417-454b-5c3b-b154-4355f376adb6'),
('Rasheed Avenue LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','26b1543a-e2fb-5bf8-804a-d80da42308cc'),
('Razia Saeed HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','a3a21944-9476-57aa-a56f-6b097fc52c76'),
('Revised Dream Garden HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','0bc3c9f0-a28c-57b3-a3fc-161ba2967fc1'),
('Sabzwari Town HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','77b1d340-4632-55ec-8b29-e29c1392e95a'),
('Sayyam Village HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','72ac5a41-a05e-5563-b929-d2c34cf36d5b'),
('Shah Jahan Canal View HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','1cd16cac-0e22-5fb3-9527-bbef089a1e08'),
('Zain Masood LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','64d89a31-c5f6-55ec-9658-a8e1732fc732'),
('Revised Green Lane LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','43bac800-8e7f-5700-b937-97e5e351fa48'),
('Omega City HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','331d85f7-abe7-5e8d-bf0c-0a1a629d5e56'),
('Hateem City HS','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','e09a7fa7-ce28-50ba-be22-9b63ace791cd'),
('Khayebane Aziz LSD','MDA list: sanctioned/approved private housing scheme or land sub-division, South Zone','e15cac01-2e0c-5bbc-875f-99d3e3f2280b')
), t AS (
SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON s.city = 'Multan' AND lower(regexp_replace(s.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g'))
WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')
), ev AS (
INSERT INTO trust.evidence (id, type, file_ref, source_ref, document_date, document_type, record_type)
SELECT eid, 'document', 'https://mda.punjab.gov.pk/system/files/approved.pdf', 'MDA list of sanctioned/approved private housing schemes and land sub-divisions, published at mda.punjab.gov.pk, dated 26 Sep 2025, read 2026-10-30', DATE '2025-09-26', 'OTHER', 'FACT' FROM t
ON CONFLICT (id) DO NOTHING
RETURNING id
)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs)
SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

SELECT count(*) AS multan_societies FROM property_intelligence.societies WHERE city = 'Multan';
