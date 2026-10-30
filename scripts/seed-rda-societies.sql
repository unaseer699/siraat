INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'RDA', 'Rawalpindi', 'NOT_STARTED', 'FACT'
FROM (VALUES
('Pakistan Employees Cooperative Housing Society (PECHS)'),
('Al Haram City Phase 1'),
('Kingdom Valley'),
('Forest Town'),
('Tariq Sharif Smart City'),
('Prism Town'),
('OGDC Housing Society'),
('Lake Vista Residencia'),
('T & T Employees Cooperative Housing Society'),
('Faisal Hills-II'),
('Al-Khan Enclave'),
('Taj Residencia'),
('Bahria Town Phase-VIII (Shahpur)'),
('Marble Arch Enclave'),
('Utility Cooperative Employees Housing Society'),
('Commoners Sky Garden'),
('Faisal Margalla City'),
('Faisal Hills'),
('New City Housing Scheme (Phase-II)'),
('Rawalpindi Railway Employees Cooperative Housing Society'),
('Shifa Cooperative Housing Scheme'),
('Rail View Housing Scheme'),
('Judicial Employees Cooperative Housing Society'),
('Fizaia Housing Scheme'),
('Doctors Town Cooperative Housing Society'),
('PARC Cooperative Housing Scheme')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'RDA' AND lower(regexp_replace(c.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'RDA', 'Rawalpindi', 'NOT_STARTED', 'FACT'
FROM (VALUES
('Municipal Corporation Co-operative Housing Scheme (Sector A&B)'),
('Golden Jubilee Cooperative Housing'),
('Bahria Paradise'),
('Eastridge Housing Scheme'),
('Safari Villas-II'),
('Army Welfare Housing Scheme (Defense-I)'),
('Rabia Bangalows'),
('Bahria Town (Phase-I, II & III Partially)'),
('Safari Enclave II (Land Sub Division)'),
('Bostan Avenue Housing Scheme'),
('Safari Villas-I'),
('Sanober City'),
('Clifton Town'),
('Revenue Employees Cooperative Housing Society'),
('Kehkashan Town'),
('Abad Cooperative Housing Society (Gulshan-a-Abad)'),
('Garden Villas'),
('Bahria Town Phase-VIII (Gali)'),
('CBR Town Phase-II'),
('Kohsar View Housing Project'),
('Gulshan-e-Fatima'),
('Foreign Office Employees Cooperative Housing Society'),
('Up-Country Enclosure'),
('University Town'),
('Tarnol Housing Scheme'),
('Shalimar Town')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'RDA' AND lower(regexp_replace(c.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'RDA', 'Rawalpindi', 'NOT_STARTED', 'FACT'
FROM (VALUES
('Khudadad City including Airport Enclave'),
('Pakistan Atomic Energy Employees Cooperative Housing Society'),
('Silver City'),
('Qurtaba City'),
('Shahbaz Villas (Land Sub-division)'),
('French Housing Scheme'),
('Kohistan Enclave'),
('Multi Gardens'),
('Rabia Residency'),
('Banker City (court case)'),
('Pakistan Govt. Employees Cooperative Housing Society'),
('Safari Valley'),
('PIA Officers Cooperative Housing Society'),
('Pakistan Employees Cooperative Housing Society (PECHS) K, K-Ext, M Block'),
('Faisal Town (Rev & Extension)'),
('Capital Smart City'),
('Taj Residencia (Extension)'),
('Elite Reverie Housing (Eighteen)'),
('Gandhara City (Revised & Extension)'),
('Airport Green Garden (Revised & Extension)'),
('Top City'),
('Rehbar Colony'),
('Mumtaz City'),
('Aamin Housing One'),
('Silver City Prime'),
('Saffron City')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'RDA' AND lower(regexp_replace(c.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.societies (id, name, city, address, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Rawalpindi', v.address, v.area, v.noc, v.summ, 'https://rda.gop.pk/ahs', 'FACT'
FROM (VALUES
('Pakistan Employees Cooperative Housing Society (PECHS)','Mohri Khatran and Gurbal',3489.0,false,'RDA list: lop approved on area of 3489 kanals.'),
('Al Haram City Phase 1','Kolian Par, Chakri Road',NULL,false,'RDA list: lop approved'),
('Kingdom Valley','Mouza Choora',103.75,false,'RDA list: approved by phata over 103 kanal 15 marlas'),
('Forest Town','Chak Beli Khan Road',NULL,false,'RDA list: approved by phata'),
('Tariq Sharif Smart City','Barki Chohan & Dhoury',763.4,false,'RDA list: approved by phata on 763 kanals & 08 marlas'),
('Prism Town','Doulial',102.0,false,'RDA list: approved by phata over 102 kanal'),
('OGDC Housing Society','Hakla',NULL,false,'RDA list: listed as approved, no details given'),
('Lake Vista Residencia','Dhok Abdullah',NULL,false,'RDA list: scheme in rda jurisdiction but approved by tma potohar town (also advertised illegally as rawal city) illegal'),
('T & T Employees Cooperative Housing Society','Dhagal',NULL,false,'RDA list: town planning approved'),
('Faisal Hills-II','Ban Bhola, Thatta Khalil, Jalala & Bhalot Tehsil Taxila',7300.0,false,'RDA list: town planning approved over 7300 kanal, transfer & mortgage deed is under process'),
('Al-Khan Enclave','Lab Thatho, Tehsil Taxila',104.0,false,'RDA list: town planning approved over 104 kanal, transfer & mortgage deed is under process'),
('Taj Residencia','Kaak',224.0,true,'RDA list: final noc issued over an area of 224 kanal'),
('Bahria Town Phase-VIII (Shahpur)','Shahpur',5954.0,false,'RDA list: town planning approved over 5954 kanal (transfer deed & bank guarantee submitted in place of mortgage deed)'),
('Marble Arch Enclave','Mouza Jattal & Pind Dadu',1278.5,true,'RDA list: final noc issued over 1278.5 kanals'),
('Utility Cooperative Employees Housing Society','Manga',NULL,false,'RDA list: final sanction is not granted.'),
('Commoners Sky Garden','Menghle & Kathar, Angoori',NULL,true,'RDA list: final noc issued.'),
('Faisal Margalla City','Dhoke Jando & Choker',3671.41,true,'RDA list: final noc issued over an area measuring 3671.41 kanals'),
('Faisal Hills','Pind Gondal, Dhoke Syedo, Mohra Shahwali',11823.0,true,'RDA list: final noc issued over an area of measuring 11823 kanals'),
('New City Housing Scheme (Phase-II)','Taxila',1832.0,false,'RDA list: approved by tma hassan abdal over 1832 kanal, planning permission for 2005 kanal is under process in rda'),
('Rawalpindi Railway Employees Cooperative Housing Society','Lohi Bher',NULL,false,'RDA list: final sanction is not granted.'),
('Shifa Cooperative Housing Scheme','Gangal',206.0,false,'RDA list: town planning approved over 206 kanal ( transfer deed is submitted but mortgaged deed is pending)'),
('Rail View Housing Scheme','Chaklala',183.54,false,'RDA list: town planning approved over 183.54 kanal'),
('Judicial Employees Cooperative Housing Society','Gangal',305.87,false,'RDA list: town planning approved over 305.87 kanal. scheme is complete at site and completion certificate is issued.'),
('Fizaia Housing Scheme','Gangal',461.0,false,'RDA list: town planning approved over 461 kanal (tranfer & mortgage deed is pending)'),
('Doctors Town Cooperative Housing Society','Lohi Bher',387.43,false,'RDA list: town planning approved over 387.43 kanal (tranfer & mortgage deed is pending)'),
('PARC Cooperative Housing Scheme','Bagga Sheikhan',501.7,false,'RDA list: town planning approved over 501.70 kanal (transfer & mortgage deed is submitted)')
) AS v(name, address, area, noc, summ)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies s WHERE s.city = 'Rawalpindi' AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.societies (id, name, city, address, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Rawalpindi', v.address, v.area, v.noc, v.summ, 'https://rda.gop.pk/ahs', 'FACT'
FROM (VALUES
('Municipal Corporation Co-operative Housing Scheme (Sector A&B)','Bagga Sheikhan',NULL,false,'RDA list: society is merged in dha.'),
('Golden Jubilee Cooperative Housing','Kotha Kalan',291.0,false,'RDA list: town planning approved over 291 kanal (transfer & mortgage deed is under process)'),
('Bahria Paradise','Kotha Kalan',164.64,false,'RDA list: town planning approved over 164.64 kanal however scheme now falls in the area of ict'),
('Eastridge Housing Scheme','Kotha Kalan',391.59,false,'RDA list: town planning approved over 391.59 kanal (transfer & mortgage deed is pending)'),
('Safari Villas-II','Kotha Kalan',310.75,false,'RDA list: town planning approved over 310.75 kanal (transfer deed & bank guarantee is submitted in place of mortgage deed)'),
('Army Welfare Housing Scheme (Defense-I)','Morgah, Kotha Kalan',NULL,false,'RDA list: phase-i is merged in dha'),
('Rabia Bangalows','Kotha Kalan',52.2,false,'RDA list: town planning approved over 52.20 kanal (transfer & mortgage deed is pending)'),
('Bahria Town (Phase-I, II & III Partially)','Kotha Kalan',2368.14,false,'RDA list: town planning approved over 2368.14 kanal (transfer deed & bank guarantee is submitted in place of mortgage deed)'),
('Safari Enclave II (Land Sub Division)','Dhagal',98.0,false,'RDA list: sub-division is approved at an area measuring 98 kanal.'),
('Bostan Avenue Housing Scheme','Kotha Kalan',312.87,false,'RDA list: town planning approved over 312.87 kanal (transfer & mortage deed is pending)'),
('Safari Villas-I','Kotha Kalan',562.05,false,'RDA list: town planning approved over 562.05 kanal (transfer deed & bank guarantee is submitted in place of mortgage deed)'),
('Sanober City','Kalri, Kalyal',407.35,false,'RDA list: town planning approved over 407.35 kanal ( transfer & mortgage deed is pending)'),
('Clifton Town','Kalri',700.0,false,'RDA list: town planning approved over 700 kanal (transfer & mortgage deed is pending)'),
('Revenue Employees Cooperative Housing Society','Morgah',NULL,false,'RDA list: town planning approved by rda. scheme sold to ghq (askari 14)'),
('Kehkashan Town','Shahpur',405.36,false,'RDA list: town planning approved over 405.36 kanal (transfer deed is submitted but mortgage deed is pending)'),
('Abad Cooperative Housing Society (Gulshan-a-Abad)','Kaliyal',2500.0,false,'RDA list: town planning approved over 2500 kanal (transfer & mortgage deed is pending) extension & sector 4 is illegal'),
('Garden Villas','Dhagal',1342.5,false,'RDA list: town planning approved over 1342.50 kanal (merged in dha)'),
('Bahria Town Phase-VIII (Gali)','Gali',11545.85,false,'RDA list: lop approved over 11545.85 kanal'),
('CBR Town Phase-II','Kot Kolian',1388.4,false,'RDA list: town planning approved over 1388.40 kanal (transfer deed is submitted but mortgage deed is pending)'),
('Kohsar View Housing Project','Lakkhu',600.0,false,'RDA list: town planning approved over 600 kanal (transfer & mortgage deed is under process)'),
('Gulshan-e-Fatima','Rupa',279.0,false,'RDA list: town planning approved over 279 kanal (transfer & mortgage deed is pending)'),
('Foreign Office Employees Cooperative Housing Society','Lakhu, Rupa, Pind Nasrala',1638.5,false,'RDA list: town planning approved over 1638.50 kanal (transfer deed is submitted but mortgage deed pending)'),
('Up-Country Enclosure','Kot Kolian, Rupa, Jataal',2014.42,false,'RDA list: town planning approved over 2014.42 kanal (transfer deed is submitted but mortgage deed is pending)'),
('University Town','Bajnial',3454.0,false,'RDA list: town planning approved over 3454 kanal (transfer & mortgage deed is under process)'),
('Tarnol Housing Scheme','Pind Nasrallah & Chahan',3828.0,false,'RDA list: approved by district council over 3828 kanal however not endorsed by rda yet (revised & extension is under process)'),
('Shalimar Town','Pind Nasrala & Chahan',915.8,true,'RDA list: final sanction issued over 915.8 kanal')
) AS v(name, address, area, noc, summ)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies s WHERE s.city = 'Rawalpindi' AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

INSERT INTO property_intelligence.societies (id, name, city, address, area_kanal, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Rawalpindi', v.address, v.area, v.noc, v.summ, 'https://rda.gop.pk/ahs', 'FACT'
FROM (VALUES
('Khudadad City including Airport Enclave','Pind Nasrala',1351.0,false,'RDA list: revised town planning approved over 1351 kanals'),
('Pakistan Atomic Energy Employees Cooperative Housing Society','AbbanChak',NULL,false,'RDA list: approved by tma court case'),
('Silver City','Ghariba, Jattal & Ranial',241.14,true,'RDA list: final noc issued over an area of 241.14 kanal'),
('Qurtaba City','Kolian Hameed, Chakra Chakri Road',7148.0,false,'RDA list: approved by tma over 7148 kanala but extension is illegal'),
('Shahbaz Villas (Land Sub-division)','Kotha Kalan',2.5,false,'RDA list: approved over 2.5 kanal'),
('French Housing Scheme','Dhagal',101.0,false,'RDA list: town planning approved over 101 kanal (transfer & mortgage deed is under process)'),
('Kohistan Enclave','Sagra Brahama',599.0,false,'RDA list: approved over an area measuring 599 kanal'),
('Multi Gardens','Bhadana Khurd, Chokar, Dhok Jando & Thatha Khalil',19263.4,false,'RDA list: approved over 19263.4 kanal, transfer & mortgage deed is under process'),
('Rabia Residency','Chahan, Chakri Road',314.37,false,'RDA list: approved by tma over 314.37 kanal'),
('Banker City (court case)','Nukriali, Adyala',NULL,false,'RDA list: approved over an area measuring 212.99'),
('Pakistan Govt. Employees Cooperative Housing Society','Jonial, Rawat Road',330.92,false,'RDA list: approved over an area measuring 330.92 kanal'),
('Safari Valley','Gali, Adyala Road',6199.81,false,'RDA list: approved by tma over 6199.81 kanal (revised plan is under processin rda)'),
('PIA Officers Cooperative Housing Society','Adyala',NULL,false,'RDA list: approved over an area measuring 1212'),
('Pakistan Employees Cooperative Housing Society (PECHS) K, K-Ext, M Block','Mohri Khatran and Gurbal',1576.0,false,'RDA list: town planning approved over 1576 kanal (transfer & mortgage deed in process)'),
('Faisal Town (Rev & Extension)','Chahan, Barkat, Pind Nasralla & Noughazi',4735.9,true,'RDA list: final noc issued over an area measuring 4735.90 kanals'),
('Capital Smart City','Chahan',7376.0,false,'RDA list: approved over an area measuring 7376 kanal.'),
('Taj Residencia (Extension)','Sheikhpur',2200.0,false,'RDA list: revised & extension is under process over 2200 kanal'),
('Elite Reverie Housing (Eighteen)','Bajnial, Bhamra',4839.0,false,'RDA list: town planning approved over 4839 kanal (transfer & mortgage deed is under process)'),
('Gandhara City (Revised & Extension)','Pind Nasrullah & Ghurbal',NULL,false,'RDA list: revised & extension lop is technically approved.'),
('Airport Green Garden (Revised & Extension)','Bajnial',5007.5,false,'RDA list: approved over an area of 5007.5 kanals.'),
('Top City','Bijnial, Pind',9681.0,false,'RDA list: approved over an area measuring 9681 kanal'),
('Rehbar Colony','Mouza Ranyal, Hayal Rnyal & Hayal Dhamyal Chakri Road',175.04,true,'RDA list: final sanction issued over 175.04 kanal'),
('Mumtaz City','Pind Nasrala Gharbal',3328.79,false,'RDA list: approved over 3328.79 kanal whereas town planning of extension is approved on 1502.58 kanal (transfer & mortgage deed of extension is in process)'),
('Aamin Housing One','Bajnial',224.03,true,'RDA list: final noc approved over an area of 224.03 kanal'),
('Silver City Prime','Mouza Jattal Tehsil and District Rawalpindi',559.9,true,'RDA list: final noc issued over an area of 559.90 kanals'),
('Saffron City','Karpal, Kalyam Mughal',NULL,false,'RDA list: lop approved')
) AS v(name, address, area, noc, summ)
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies s WHERE s.city = 'Rawalpindi' AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')));

WITH v(name, claim, eid) AS (VALUES
('Pakistan Employees Cooperative Housing Society (PECHS)','RDA list: lop approved on area of 3489 kanals.','8d56a863-94ba-578a-81f7-5eb1d979a263'),
('Al Haram City Phase 1','RDA list: lop approved','c846fe02-bbc8-5f43-a0f6-13db9aab827a'),
('Kingdom Valley','RDA list: approved by phata over 103 kanal 15 marlas','da96eea4-fcd8-5557-bcb5-f536676b35bc'),
('Forest Town','RDA list: approved by phata','b00302d8-6a7c-5234-bc75-c7ee1eef8d47'),
('Tariq Sharif Smart City','RDA list: approved by phata on 763 kanals & 08 marlas','9c22749b-2e61-599f-908d-8e71be27643a'),
('Prism Town','RDA list: approved by phata over 102 kanal','09b73bd7-4f02-51e5-85a8-d9ea74e135b3'),
('OGDC Housing Society','RDA list: listed as approved, no details given','50bc6990-d92c-5715-8ba1-56f442d18979'),
('Lake Vista Residencia','RDA list: scheme in rda jurisdiction but approved by tma potohar town (also advertised illegally as rawal city) illegal','300a1d60-6704-5103-b82a-7f5062517c09'),
('T & T Employees Cooperative Housing Society','RDA list: town planning approved','4ef98703-6c36-5663-8da5-20cd4350c3ab'),
('Faisal Hills-II','RDA list: town planning approved over 7300 kanal, transfer & mortgage deed is under process','46e11b8e-c119-54c6-948d-ec9c1b2726be'),
('Al-Khan Enclave','RDA list: town planning approved over 104 kanal, transfer & mortgage deed is under process','04aac771-ca80-5357-a467-1abd62e277c4'),
('Taj Residencia','RDA list: final noc issued over an area of 224 kanal','235736c9-b141-58fa-80b9-a404bc4938e3'),
('Bahria Town Phase-VIII (Shahpur)','RDA list: town planning approved over 5954 kanal (transfer deed & bank guarantee submitted in place of mortgage deed)','b3db6b38-6509-583e-b220-669b10ab0825'),
('Marble Arch Enclave','RDA list: final noc issued over 1278.5 kanals','cf91811f-6691-55b3-85ed-f7c15dc7d316'),
('Utility Cooperative Employees Housing Society','RDA list: final sanction is not granted.','d38171a3-09d3-59f8-a683-0a9d33d336f5'),
('Commoners Sky Garden','RDA list: final noc issued.','65cbba7d-eed5-5564-adb9-e963ae3635ff'),
('Faisal Margalla City','RDA list: final noc issued over an area measuring 3671.41 kanals','a9711005-4e87-554e-8288-993b4b869a61'),
('Faisal Hills','RDA list: final noc issued over an area of measuring 11823 kanals','4f0629f9-47b4-582e-b28d-fc3775e76b99'),
('New City Housing Scheme (Phase-II)','RDA list: approved by tma hassan abdal over 1832 kanal, planning permission for 2005 kanal is under process in rda','4919f6bb-1a7b-5cad-91be-430ffe7e0abd'),
('Rawalpindi Railway Employees Cooperative Housing Society','RDA list: final sanction is not granted.','214b7f8a-ef4d-56a0-8b70-3f5f619c53c0'),
('Shifa Cooperative Housing Scheme','RDA list: town planning approved over 206 kanal ( transfer deed is submitted but mortgaged deed is pending)','cd0d3aed-65b3-5c50-b6e6-793ac9c0789c'),
('Rail View Housing Scheme','RDA list: town planning approved over 183.54 kanal','9149f611-dac3-53b7-8d05-70a08f84789e'),
('Judicial Employees Cooperative Housing Society','RDA list: town planning approved over 305.87 kanal. scheme is complete at site and completion certificate is issued.','79dc9d62-333e-55a6-a972-bfa0c815629d'),
('Fizaia Housing Scheme','RDA list: town planning approved over 461 kanal (tranfer & mortgage deed is pending)','155d803e-2774-5bc0-b466-009e53d74d72'),
('Doctors Town Cooperative Housing Society','RDA list: town planning approved over 387.43 kanal (tranfer & mortgage deed is pending)','684c714d-b129-5924-b624-a9dd361af274'),
('PARC Cooperative Housing Scheme','RDA list: town planning approved over 501.70 kanal (transfer & mortgage deed is submitted)','5aa5dcc5-e869-54b9-8380-b18decabbac1')
),
t AS (SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON s.city = 'Rawalpindi' AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')),
ev AS (INSERT INTO trust.evidence (id, type, file_ref, source_ref, record_type) SELECT eid, 'document', 'https://rda.gop.pk/ahs', 'RDA approved housing societies list, rda.gop.pk, read 2026-10-30', 'FACT' FROM t RETURNING id)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs) SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid) AS (VALUES
('Municipal Corporation Co-operative Housing Scheme (Sector A&B)','RDA list: society is merged in dha.','ad22d755-92ab-57b6-a557-9721be6c98e0'),
('Golden Jubilee Cooperative Housing','RDA list: town planning approved over 291 kanal (transfer & mortgage deed is under process)','8c95e573-6784-5ab3-9c15-be728d95b81a'),
('Bahria Paradise','RDA list: town planning approved over 164.64 kanal however scheme now falls in the area of ict','9fa6e1fc-76ce-5205-b2c2-9fd110edee44'),
('Eastridge Housing Scheme','RDA list: town planning approved over 391.59 kanal (transfer & mortgage deed is pending)','393c8b90-4706-5eb9-9009-457f66292869'),
('Safari Villas-II','RDA list: town planning approved over 310.75 kanal (transfer deed & bank guarantee is submitted in place of mortgage deed)','284b5ed6-ee28-5b52-bb73-df617951700e'),
('Army Welfare Housing Scheme (Defense-I)','RDA list: phase-i is merged in dha','ce5d901d-52fd-59f9-b152-e8108226739a'),
('Rabia Bangalows','RDA list: town planning approved over 52.20 kanal (transfer & mortgage deed is pending)','9e361270-aafc-58b8-9390-8ecab22956f1'),
('Bahria Town (Phase-I, II & III Partially)','RDA list: town planning approved over 2368.14 kanal (transfer deed & bank guarantee is submitted in place of mortgage deed)','a5de6543-5013-59b9-bce9-a60e534925e5'),
('Safari Enclave II (Land Sub Division)','RDA list: sub-division is approved at an area measuring 98 kanal.','d9b153db-5997-57e9-8a3a-2e00775b1042'),
('Bostan Avenue Housing Scheme','RDA list: town planning approved over 312.87 kanal (transfer & mortage deed is pending)','924a5c60-920d-5557-b61e-e32a7fb707e7'),
('Safari Villas-I','RDA list: town planning approved over 562.05 kanal (transfer deed & bank guarantee is submitted in place of mortgage deed)','260fb960-4d9b-5383-9a4d-fbd182bbb6a5'),
('Sanober City','RDA list: town planning approved over 407.35 kanal ( transfer & mortgage deed is pending)','347c5d73-813a-56b9-b093-5b843117eb11'),
('Clifton Town','RDA list: town planning approved over 700 kanal (transfer & mortgage deed is pending)','150978d0-5c0d-5133-995e-87c156debba9'),
('Revenue Employees Cooperative Housing Society','RDA list: town planning approved by rda. scheme sold to ghq (askari 14)','97649247-7361-56f3-8269-b1d3d5eaee68'),
('Kehkashan Town','RDA list: town planning approved over 405.36 kanal (transfer deed is submitted but mortgage deed is pending)','6f7549bd-cf8d-51cc-90cc-4431b27b199b'),
('Abad Cooperative Housing Society (Gulshan-a-Abad)','RDA list: town planning approved over 2500 kanal (transfer & mortgage deed is pending) extension & sector 4 is illegal','66de774e-1c13-5197-8713-2b078073dc1d'),
('Garden Villas','RDA list: town planning approved over 1342.50 kanal (merged in dha)','9adafa8b-64ee-5a0e-ba44-c4fd822b1ae9'),
('Bahria Town Phase-VIII (Gali)','RDA list: lop approved over 11545.85 kanal','ddf8681a-9a31-5a6e-9dd8-d441347d6c8e'),
('CBR Town Phase-II','RDA list: town planning approved over 1388.40 kanal (transfer deed is submitted but mortgage deed is pending)','abe0f9b6-fece-56f1-ad88-189b4092fcef'),
('Kohsar View Housing Project','RDA list: town planning approved over 600 kanal (transfer & mortgage deed is under process)','5de7c464-1f75-5915-917f-13d129ebb648'),
('Gulshan-e-Fatima','RDA list: town planning approved over 279 kanal (transfer & mortgage deed is pending)','87f89523-4996-5ac6-a5b8-141c023f6cd0'),
('Foreign Office Employees Cooperative Housing Society','RDA list: town planning approved over 1638.50 kanal (transfer deed is submitted but mortgage deed pending)','77d7a6ef-ed73-5e93-b7cd-3bc9d91e9125'),
('Up-Country Enclosure','RDA list: town planning approved over 2014.42 kanal (transfer deed is submitted but mortgage deed is pending)','24cc5b4e-93ea-5c17-9431-1107c96a5e5b'),
('University Town','RDA list: town planning approved over 3454 kanal (transfer & mortgage deed is under process)','2e27a073-3dcf-5924-9212-796b14544fa6'),
('Tarnol Housing Scheme','RDA list: approved by district council over 3828 kanal however not endorsed by rda yet (revised & extension is under process)','6a47381c-cf63-5e1e-b9ec-f97f681684b2'),
('Shalimar Town','RDA list: final sanction issued over 915.8 kanal','7b590c32-f99b-5a03-8825-ee6f6ea4c70f')
),
t AS (SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON s.city = 'Rawalpindi' AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')),
ev AS (INSERT INTO trust.evidence (id, type, file_ref, source_ref, record_type) SELECT eid, 'document', 'https://rda.gop.pk/ahs', 'RDA approved housing societies list, rda.gop.pk, read 2026-10-30', 'FACT' FROM t RETURNING id)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs) SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid) AS (VALUES
('Khudadad City including Airport Enclave','RDA list: revised town planning approved over 1351 kanals','8ea574c5-388b-5632-8c5f-cadf5ed6fc81'),
('Pakistan Atomic Energy Employees Cooperative Housing Society','RDA list: approved by tma court case','ebe850fb-1a91-5c0f-920a-8602b7e05578'),
('Silver City','RDA list: final noc issued over an area of 241.14 kanal','5efd454e-2431-5c4f-b807-66310097b4f6'),
('Qurtaba City','RDA list: approved by tma over 7148 kanala but extension is illegal','4ae1a2d4-abab-5dbc-b1b8-33b3df8423b4'),
('Shahbaz Villas (Land Sub-division)','RDA list: approved over 2.5 kanal','8f3c1c96-099a-5c67-8766-1f5eb66c96b9'),
('French Housing Scheme','RDA list: town planning approved over 101 kanal (transfer & mortgage deed is under process)','248fd6ea-eefb-5275-ad93-d0c859bd1008'),
('Kohistan Enclave','RDA list: approved over an area measuring 599 kanal','6631bed6-fcb6-5a33-ab01-332e4b84107e'),
('Multi Gardens','RDA list: approved over 19263.4 kanal, transfer & mortgage deed is under process','8f52e38b-1cf6-54e5-af27-5caa3f0f3b11'),
('Rabia Residency','RDA list: approved by tma over 314.37 kanal','43e02f90-103c-599b-bb7d-5dad9d6a61d6'),
('Banker City (court case)','RDA list: approved over an area measuring 212.99','b60ad007-c712-5c18-95c4-dc60ffbc49be'),
('Pakistan Govt. Employees Cooperative Housing Society','RDA list: approved over an area measuring 330.92 kanal','81d9ed92-40b0-5c3b-b371-c50faa6430a6'),
('Safari Valley','RDA list: approved by tma over 6199.81 kanal (revised plan is under processin rda)','0310e75f-a850-5ffb-8862-9168da0d40e3'),
('PIA Officers Cooperative Housing Society','RDA list: approved over an area measuring 1212','a842ef00-d1a3-5fb0-9bcc-8030a82490a0'),
('Pakistan Employees Cooperative Housing Society (PECHS) K, K-Ext, M Block','RDA list: town planning approved over 1576 kanal (transfer & mortgage deed in process)','b2e8eedf-f529-56a1-b73e-329158a5e70c'),
('Faisal Town (Rev & Extension)','RDA list: final noc issued over an area measuring 4735.90 kanals','42f82dbd-0463-5a00-8071-a1de1316c958'),
('Capital Smart City','RDA list: approved over an area measuring 7376 kanal.','eaab674a-8073-53a2-a95b-0acb9e150698'),
('Taj Residencia (Extension)','RDA list: revised & extension is under process over 2200 kanal','72c0e310-2a74-51dd-9b50-2d2236001319'),
('Elite Reverie Housing (Eighteen)','RDA list: town planning approved over 4839 kanal (transfer & mortgage deed is under process)','79066f4a-d0bf-5607-8a96-1cc58f50adbd'),
('Gandhara City (Revised & Extension)','RDA list: revised & extension lop is technically approved.','acaaea68-9a04-5eb4-8375-721afa785bf1'),
('Airport Green Garden (Revised & Extension)','RDA list: approved over an area of 5007.5 kanals.','65c7b374-a7d2-54eb-ae87-b0c4e2f608fb'),
('Top City','RDA list: approved over an area measuring 9681 kanal','10078fd6-6bf4-5a73-ba1c-69bbe7a14343'),
('Rehbar Colony','RDA list: final sanction issued over 175.04 kanal','9a3a687b-104b-5931-aebd-fa8be3587083'),
('Mumtaz City','RDA list: approved over 3328.79 kanal whereas town planning of extension is approved on 1502.58 kanal (transfer & mortgage deed of extension is in process)','c4110db0-3681-5971-84c0-38552613b7b7'),
('Aamin Housing One','RDA list: final noc approved over an area of 224.03 kanal','74f05ec9-70e9-5041-8b63-8e872ed37994'),
('Silver City Prime','RDA list: final noc issued over an area of 559.90 kanals','946a4999-3085-51d7-bd79-ef84cc8e6cf7'),
('Saffron City','RDA list: lop approved','c498bdfa-bcd8-56fe-946d-608a5aaa4b08')
),
t AS (SELECT s.id AS sid, v.claim, v.eid::uuid AS eid FROM v JOIN property_intelligence.societies s ON s.city = 'Rawalpindi' AND lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v.name, '[^a-zA-Z0-9]', '', 'g')) WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')),
ev AS (INSERT INTO trust.evidence (id, type, file_ref, source_ref, record_type) SELECT eid, 'document', 'https://rda.gop.pk/ahs', 'RDA approved housing societies list, rda.gop.pk, read 2026-10-30', 'FACT' FROM t RETURNING id)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs) SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

UPDATE property_intelligence.candidate_societies SET status = 'ONBOARDED' WHERE regulator = 'RDA' AND status = 'NOT_STARTED' AND lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) IN (SELECT lower(regexp_replace(s.name, '[^a-zA-Z0-9]', '', 'g')) FROM property_intelligence.societies s WHERE s.city = 'Rawalpindi');