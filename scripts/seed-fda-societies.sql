-- FDA approved private housing schemes (https://fda.gov.pk/schemes_private), read 2026-10-30.
-- Statements 1-4: societies + candidates. Statements 5-8: NOC claims + scheme-map evidence. Run one at a time, in order.

WITH v(name, noc, summ) AS (VALUES
('Sitara Sapna City Chak No.123/JB',true,'FDA list: Approved; 729 plots'),
('Al barkat Villas, Chak No. 226/RB, Faisalabad',true,'FDA list: Approved; 110 plots'),
('Cooperative Housing and Building Society Employees of University of Agriculture Faisalabad, Chak No. 196/RB',true,'FDA list: Approved; 476 plots'),
('Vista Homes Chak No. 121/JB',true,'FDA list: Approved; 117 plots'),
('Sitara Gold City Chak No. 215/RB',true,'FDA list: Approved; 704 plots'),
('Govt: Employees Co- Operative Housing Society Scheme-I Chak No.213/RB',true,'FDA list: Approved; 90 plots'),
('Rahim Town Chak No.220/RB',true,'FDA list: Approved; 180 plots'),
('Icon Gold Valley Chak No. 192/RB Faislabad',true,'FDA list: Approved; 496 plots'),
('Nazimabad City Chak No. 220/RB',true,'FDA list: Approved; 90 plots'),
('Model Town, Chak No. 263/RB, Samundari Road, dijkot, Faisalabad',true,'FDA list: Approved; 175 plots'),
('Lyallpur Garden Chak No. 212/RB',true,'FDA list: Approved; 467 plots'),
('Liaqat Town Chak No.220/RB',true,'FDA list: Approved; 623 plots'),
('New Farid Town Chak No.196/RB',true,'FDA list: Approved; 165 plots'),
('Ibrahim Villas Chak No. 199/RB',true,'FDA list: Approved; 34 plots'),
('Pine Park Chak No. 117/JB Faisalabad',true,'FDA list: Approved; 592 plots'),
('Raja Park Chak No.222/RB',true,'FDA list: Approved; 277 plots'),
('Ghafoor Garden, Chak No. 204/RB',true,'FDA list: Approved; 99 plots'),
('Sitara Park City Chak No. 215/RB',true,'FDA list: Approved; 767 plots'),
('CITI Housing Scheme Chak No. 4&5/JB',true,'FDA list: Approved; 2182 plots'),
('Wadi-e-Sitara Chak No. 200/RB',true,'FDA list: Approved; 487 plots'),
('Al Barkah Chak No. 226/RB Faisalabad',true,'FDA list: Approved; 21 plots'),
('Al-Hamra Town Chak No.199/RB',true,'FDA list: Approved; 172 plots'),
('Usman Block Chak No.120/JB',true,'FDA list: Approved; 91 plots'),
('Defence City, Chak No. 226/RB & 238/RB, Faisalabad',true,'FDA list: Approved; 813 plots'),
('Sitara Diamond City 226/RB, Satyana Road',true,'FDA list: Approved; 258 plots'),
('Govt: Employees Co-Operative Housing Society-II Chak No.199/RB',true,'FDA list: Approved; 202 plots'),
('Raheem Block Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 65 plots'),
('Ideal Valley Chak No. 202/RB',true,'FDA list: Approved; 131 plots'),
('Nawaz Town Chak No.120/JB',true,'FDA list: Approved; 48 plots'),
('Lyallpur Villas Chak No. 204/RB',true,'FDA list: Approved; 30 plots'),
('New Garden Block Phase II, Chak No.208/RB',true,'FDA list: Approved; 510 plots'),
('Raza Garden Chak No.204/RB',true,'FDA list: Approved; 149 plots'),
('Shahbaz Town Chak No.220/RB Faisalabad',true,'FDA list: Approved; 880 plots'),
('Sitara Park City Extension Chak No. 215/RB',true,'FDA list: Approved; 767 plots'),
('LCM Canal Burg Chak No. 212/RB',true,'FDA list: Approved; 339 plots'),
('Qamar Block Chak No. 208/RB Faisalabad',true,'FDA list: Approved'),
('Madina Paradise Chak No. 235/RB Faisalabad',true,'FDA list: Approved; 526 plots'),
('Gulberg housing Chak No. 61/GB, 120/GB Faisalabad',true,'FDA list: Approved; 1000 plots'),
('Ali Town Sitara Gold city, Chak No. 215/RB, Satyana Road, Faisalabad',true,'FDA list: Approved; 100 plots'),
('Younis Town Chak No. 225/RB',true,'FDA list: Approved; 501 plots'),
('Defence view Executive Block Chak No. 226/RB Satiana Road Faisalabad',true,'FDA list: Approved; 89 plots'),
('The Four Seasons Phase-I Chak No. 234/RB',true,'FDA list: Approved; 1121 plots'),
('Orchard Homes Zaman Block Chak No. 239/RB',true,'FDA list: Approved; 266 plots'),
('EMAAN CITY Chak No. 61/GB',true,'FDA list: Approved; 505 plots'),
('Fatima Block Chak No. 209/RB Faisalabad',true,'FDA list: Approved; 19 plots'),
('Green Homes Chak No. 208/RB',true,'FDA list: Approved; 153 plots'),
('Zee Garden Chak No. 198/RB, Faisalabad',true,'FDA list: Approved; 585 plots'),
('Ibraheem Bajwa Town Chak No.217/RB',true,'FDA list: Approved; 376 plots'),
('Faisal Town Chak No.217/RB',true,'FDA list: Approved; 160 plots'),
('Green Orchard Chak No. 209 RB Faisalabad',true,'FDA list: Approved; 650 plots')
), s AS (
INSERT INTO property_intelligence.societies (id, name, city, address, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Faisalabad', 'Faisalabad', v.noc, v.summ, 'https://fda.gov.pk/schemes_private', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies x WHERE x.city = 'Faisalabad' AND lower(regexp_replace(x.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')))
RETURNING id
)
INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'FDA', 'Faisalabad', 'ONBOARDED', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'FDA' AND lower(regexp_replace(c.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')));

WITH v(name, noc, summ) AS (VALUES
('Smart Block Sitara Diamond City 226/RB, Faisalabad',true,'FDA list: Approved; 258 plots'),
('Al-Raheem Valley Extension Chak No. 215/RB, Faisalabad',true,'FDA list: Approved; 91 plots'),
('Iqbal Block, Chak No. 204/RB, Faisalabad',true,'FDA list: Approved; 66 plots'),
('Sitara Qamar Villas Chak No. 198/RB Faisalabad',true,'FDA list: Approved; 31 plots'),
('Madina Garden, Chak No. 239/GB, Faisalabad',true,'FDA list: Approved; 754 plots'),
('Raza Town Chak No.204/RB',true,'FDA list: Approved; 159 plots'),
('Khalid Town Chak No. 7/JB Faisalabad',true,'FDA list: Approved; 244 plots'),
('Al-Haram Town Chak No. 66/JB',true,'FDA list: Approved; 71 plots'),
('New Garden Town Chak No.214/RB',true,'FDA list: Approved; 145 plots'),
('Madina Garden, Chak No. 234/RB, Samundari Road, Faisalabad',true,'FDA list: Approved; 348 plots'),
('New Muslim Town Chak No. 120/JB',true,'FDA list: Approved; 140 plots'),
('Defence Paradise Chak No. 222/RB Faisalabad',true,'FDA list: Approved; 533 plots'),
('WAPDA City Chak No.192/RB',true,'FDA list: Approved; 12124 plots'),
('Rehman Block Chak No. 204/RB',true,'FDA list: Approved; 112 plots'),
('Green Block Chak No. 204/RB',true,'FDA list: Approved; 173 plots'),
('Image Villas, Chak No. 225/RB, Faisalabad',true,'FDA list: Approved; 45 plots'),
('A.Zee Housing Chak No. 234/RB',true,'FDA list: Approved; 1182 plots'),
('Canal Villas Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 122 plots'),
('Model City Royal Villas, Chak No. 214/RB Faisalabad',true,'FDA list: Approved; 1202 plots'),
('Ejaz Town Chak No.124/JB Faisalabad',true,'FDA list: Approved; 172 plots'),
('Faisal Town Chak No.217/RB Faisalabad',true,'FDA list: Approved'),
('Nazimabad Villas Chak No. 220/ RB, Faisalabad',true,'FDA list: Approved; 80 plots'),
('Hamza Homes Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 173 plots'),
('Oasis One Chak No. 209/RB Faisalabad',true,'FDA list: Approved; 543 plots'),
('Paradise Palm Chak No.234/RB, Faisalabad',true,'FDA list: Approved'),
('Madina Garden, Chak No. 387/GB, Samundari Road, Faisalabad',true,'FDA list: Approved; 436 plots'),
('Lyallpur Villas Executive Block Chak No. 204/RB Faisalabad',true,'FDA list: Approved'),
('Koh-I-Noor Town Chak No.213/RB Faisalabad',true,'FDA list: Approved; 215 plots'),
('Abdullah Farm Housing Scheme Chak No.204/RB',true,'FDA list: Approved; 23 plots'),
('Prime Valley Chak No. 225/RB Faisalabad',true,'FDA list: Approved; 290 plots'),
('Lyallpur Avenue Chak No.227/RB Faisalabad',true,'FDA list: Approved; 349 plots'),
('Nasir Town Chak No.224/RB Faisalabad',true,'FDA list: Approved; 108 plots'),
('Rehmat Garden Chak No. 222/RB, Faisalabad',true,'FDA list: Approved'),
('Rachna Town Chak No.214/RB Faisalabad',true,'FDA list: Approved; 341 plots'),
('Sitara Abban Valley Chak No. 197/RB & 198/RB Faisalabad',true,'FDA list: Approved; 339 plots'),
('Sitara Heights Chak No.120/JB Faisalabad',true,'FDA list: Approved; 56 plots'),
('SMD Homes, Chak No. 121/ JB, Sargodha Road, Near Same Nala, Faisalabad',true,'FDA list: Approved; 966 plots'),
('The Meadows Phase-II, Chak No. 234/RB Faisalabad',true,'FDA list: Approved; 1375 plots'),
('The Fasialabad Lawyers Cooperative Housing Society, Chak No. 208/RB Faisalabad',true,'FDA list: Approved; 783 plots'),
('The Meadows Phase-I, Chak No. 234/RB Faisalabad',true,'FDA list: Approved; 115 plots'),
('Top City Chak No. 236/RB Faisalabad',true,'FDA list: Approved; 210 plots'),
('Umer Exectutive Block Chak No. 07/JB Faisalabad',true,'FDA list: Approved'),
('Air Avinue City, Chak No. 230/RB Faisalabad',true,'FDA list: Approved; 347 plots'),
('Wadi-e-Aban Chak No.200/RB Faisalabad',true,'FDA list: Approved; 27 plots'),
('Chenab Garden Chak No. 223/RB Faisalabad',true,'FDA list: Approved; 2027 plots'),
('Din Gardens Chak No. 144/RB Faisalabad',true,'FDA list: Approved; 604 plots'),
('Fareed Town Chak No.214/RB Faisalabad',true,'FDA list: Approved; 227 plots'),
('Shalimar Park Chak No.224/RB Faisalabad',true,'FDA list: Approved; 70 plots'),
('Haider Garden Chak No. 119/GB Faisalabad',true,'FDA list: Approved; 699 plots'),
('Haven Habitat-I Chak No.204/RB Faisalabad',true,'FDA list: Approved; 157 plots')
), s AS (
INSERT INTO property_intelligence.societies (id, name, city, address, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Faisalabad', 'Faisalabad', v.noc, v.summ, 'https://fda.gov.pk/schemes_private', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies x WHERE x.city = 'Faisalabad' AND lower(regexp_replace(x.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')))
RETURNING id
)
INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'FDA', 'Faisalabad', 'ONBOARDED', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'FDA' AND lower(regexp_replace(c.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')));

WITH v(name, noc, summ) AS (VALUES
('Prime City Chak NO. 239/RB, Staina Road, Faisalabad',true,'FDA list: Approved; 266 plots'),
('Gulshane-e-Haram Villas Chak no.223/RB, Faisalabad',true,'FDA list: Approved; 395 plots'),
('LalazarColony Chak No.226/RB Faisalabad',true,'FDA list: Approved; 127 plots'),
('Muhammad Khan Town Chak No.207/RB Faisalabad',true,'FDA list: Approved; 242 plots'),
('GREEN BLOCK PHASE-IV Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 210 plots'),
('GREEN BLOCK PHASE-I II, Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 87 plots'),
('Grand Housing Arena Chak No. 235/RB Faisalabad',true,'FDA list: Approved; 149 plots'),
('Khayaban Garden Hassan Block Chak No. 121/JB Faisalabad',true,'FDA list: Approved; 318 plots'),
('Faisalabad Lawyers Cooperative Housing Society Chak No. 198/RB',true,'FDA list: Approved'),
('Nawab City Chak No. 5/JB Faisalabad',true,'FDA list: Approved; 324 plots'),
('Dream Valley Chak No. 186/RB Faisalabad',true,'FDA list: Approved; 147 plots'),
('Hameed Town Chak No.124/JB Faisalabad',true,'FDA list: Approved; 53 plots'),
('Divine Enclave Chak No. 204/Rb Faislabad',true,'FDA list: Approved; 456 plots'),
('Deens Paradise VIP Block Chak No. 233/RB, Faisalabad',true,'FDA list: Approved; 394 plots'),
('Rafi Villas Chak No. 119/GB Faisalabad',true,'FDA list: Approved; 199 plots'),
('Executive City Chak No. 215/RB Faisalabad',true,'FDA list: Approved; 509 plots'),
('Abdullah Defence Chak No. 229/RB Faisalabad',true,'FDA list: Approved; 202 plots'),
('Babar Sultan Valley Chak No. 258/RB, Faisalabad',true,'FDA list: Approved; 316 plots'),
('Sitara Colony Chak No.222/RB Faisalabad',true,'FDA list: Approved; 1223 plots'),
('Canal Valley Chak No. 209 & 215/RB Faisalabad',true,'FDA list: Approved; 507 plots'),
('Bismillah Orchard Chak No. 61/GB Faisalabad',true,'FDA list: Approved; 464 plots'),
('Umar Garden Chak No. 204/RB',true,'FDA list: Approved; 81 plots'),
('The Four Seasons Phase-II Chak No. 234/RB Faisalabad',true,'FDA list: Approved; 729 plots'),
('AJS Housing Chak No. 215/RB Faisalabad',true,'FDA list: Approved; 852 plots'),
('Akbar Housing Scheme Chak No. 204/RB',true,'FDA list: Approved; 81 plots'),
('Ahmad Canal View Chak No247/RB',true,'FDA list: Approved'),
('Shalimar Homes 213/RB Faisalabad',true,'FDA list: Approved'),
('Abdullah Valley Chak No. 235/RB',true,'FDA list: Approved; 340 plots'),
('CITI Housing Scheme Chak No. 234/RB',true,'FDA list: Approved; 2157 plots'),
('Tech. Town Phase-II & III, Chak No. 226/RB',true,'FDA list: Approved; 1025 plots'),
('Shadman Town Chak No.120/JB',true,'FDA list: Approved; 219 plots'),
('Pine Garden Chak No. 209 RB Faisalabad',true,'FDA list: Approved; 978 plots'),
('Premium Block Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 232 plots'),
('Karim Town Chak No.224/RB',true,'FDA list: Approved; 127 plots'),
('Gulshan-e-Madina Chak No.120/JB',true,'FDA list: Approved; 371 plots'),
('Eden Villas Chak No. 222/RB',true,'FDA list: Approved; 102 plots'),
('Model City-II Chak No. 238/RB',true,'FDA list: Approved; 474 plots'),
('Al-Jameel Farm Housing Scheme, Chak No. 217/RB, Faisalabad',true,'FDA list: Approved; 190 plots'),
('Defense Fort Chak No. 223 RB',true,'FDA list: Approved; 169 plots'),
('Green Town Chak No.122/JB',true,'FDA list: Approved; 250 plots'),
('Bilal Orchard, Chak No.196/RB, Ghona Road, Faisalabad',true,'FDA list: Approved'),
('Tech Town, Phase-V, Chak No. 225/RB, Malkhan wala, Faisalabad',true,'FDA list: Approved; 462 plots'),
('Iqbal Town Chak No.124/JB',true,'FDA list: Approved; 634 plots'),
('Madina Green Valley, Chak No. 214/RB, Faisalabad',true,'FDA list: Approved; 108 plots'),
('Niaz Garden Chak No.242/RB',true,'FDA list: Approved; 187 plots'),
('Rehmat Town Chak No.124/JB',true,'FDA list: Approved; 747 plots'),
('Sitara Supreme City Chak No.119/JB, Faisalabad',true,'FDA list: Approved; 603 plots'),
('Sehgal City Chak No. 234/RB (Approved by TMA)',true,'FDA list: Approved; 824 plots'),
('Al-Mahboob Garden Chak No. 223/RB',true,'FDA list: Approved; 209 plots'),
('Park View Homes Chak No.5/JB, Sargodha Road Faisalabad',true,'FDA list: Approved; 36 plots')
), s AS (
INSERT INTO property_intelligence.societies (id, name, city, address, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Faisalabad', 'Faisalabad', v.noc, v.summ, 'https://fda.gov.pk/schemes_private', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies x WHERE x.city = 'Faisalabad' AND lower(regexp_replace(x.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')))
RETURNING id
)
INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'FDA', 'Faisalabad', 'ONBOARDED', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'FDA' AND lower(regexp_replace(c.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')));

WITH v(name, noc, summ) AS (VALUES
('Model City Chak No. 465/GB',true,'FDA list: Approved; 299 plots'),
('Doctor City Chak No 238/RB Faisalabad',true,'FDA list: Approved; 480 plots'),
('100 Homes Chak No. 204/RB',true,'FDA list: Approved; 56 plots'),
('Canal Park Chak No.204/RB Faisalabad',true,'FDA list: Approved; 40 plots'),
('Green Valley Chak No. 234/RB',true,'FDA list: Approved; 798 plots'),
('Ismael Green, Chak No. 196/RB, Millat Road, Faisalabad',true,'FDA list: Approved; 702 plots'),
('Oasis Orchard Chak No.223/RB, Faisalabad',true,'FDA list: Approved; 363 plots'),
('Riaz-ul-Jinnah Umar Block Chak No. 7/JB',true,'FDA list: Approved; 581 plots'),
('Sitara Valley Chak No. 197/RB & 198/RB',true,'FDA list: Approved; 381 plots'),
('Al-Qasim Blossom View Chak No.121/JB, Faisalabad',true,'FDA list: Approved; 140 plots'),
('Eden Garden Chak No. 208/RB',true,'FDA list: Approved; 438 plots'),
('Green View Colony Chak No.123/RB',true,'FDA list: Approved; 285 plots'),
('Gulshan-e-Iqbal Chak No.222/RB',true,'FDA list: Approved; 1012 plots'),
('Muhammad Ali Housing Scheme Chak No. 222/RB',true,'FDA list: Approved; 443 plots'),
('Jalal Town Chak No.196/RB',true,'FDA list: Approved; 135 plots'),
('Executive Block Chak No. 204/RB Faisalabad',true,'FDA list: Approved; 55 plots'),
('Manan Town Chak No. 121/JB',true,'FDA list: Approved; 399 plots'),
('Omega Residencia chak no.3/JB, FSD',true,'FDA list: Approved; 640 plots'),
('Saeed Colony, 213/RB',true,'FDA list: Approved; 177 plots'),
('Sitara Villas Chak No. 197/RB, 198/RB Faisalabad',true,'FDA list: Approved; 82 plots'),
('Al-Raheem Valley Chak No. 215/RB',true,'FDA list: Approved; 308 plots'),
('Eden Garden Executive Block Chak No. 208/RB',true,'FDA list: Approved; 809 plots'),
('Gulberg Valley Chak No. 215/RB',true,'FDA list: Approved; 525 plots'),
('Jamil Town Chak No.124/JB',true,'FDA list: Approved; 716 plots'),
('Eden Orchard Chak No. 121/JB',true,'FDA list: Approved; 1723 plots'),
('Bilal Garden 196 RB, Faisalabad',true,'FDA list: Approved; 240 plots'),
('Syed Block Chak No. 207/RB',true,'FDA list: Approved; 127 plots'),
('MID City Chak No.207/RB, Faisalabad',true,'FDA list: Approved; 342 plots'),
('Sareena Town Chak No.200/RB',true,'FDA list: Approved'),
('Park View Colony Chak No.200/RB',true,'FDA list: Approved; 73 plots'),
('Millat Town-III Chak No.196/RB',true,'FDA list: Approved; 500 plots'),
('Orchard Homes Chak No. 239/RB',true,'FDA list: Approved; 387 plots'),
('Johar Town, Chak No. 243/RB, Faisalabad',true,'FDA list: Approved; 241 plots'),
('Haider Valley Chak No. 225/RB Faisalabad',true,'FDA list: Approved; 372 plots'),
('Gulshan-e-Hayat Chak No.220/RB',true,'FDA list: Approved; 385 plots'),
('Alpha Housing Chak No. 296/RB',true,'FDA list: Approved; 407 plots'),
('Bilal City Chak No. 197/RB',true,'FDA list: Approved; 161 plots'),
('Khayaban e Manzoor Chak No. 209/RB Faisalabad',true,'FDA list: Approved; 450 plots'),
('Safeena Town Chak No.200/RB',true,'FDA list: Approved'),
('Sultan Town Chak No.217/RB',true,'FDA list: Approved; 374 plots'),
('Salma Town Chak No.224/RB',true,'FDA list: Approved; 100 plots'),
('SMD City Chak No. 196/RB, 202/RB Faisalabad',true,'FDA list: Approved; 1183 plots'),
('Palm Villas Chak No. 217/RB',true,'FDA list: Approved; 178 plots'),
('Millat Colony Chak Chak No.223/RB',true,'FDA list: Approved'),
('Jawad Town, Chak No. 223/RB, Faisalabad',true,'FDA list: Approved; 517 plots'),
('GULBERG VILLAS Chak No. 219/RB Faisalabad',true,'FDA list: Approved; 235 plots'),
('Amin Town Chak No. 207/RB',true,'FDA list: Approved; 974 plots'),
('Eden Garden Phase-II Chak No. 208/RB',true,'FDA list: Approved; 476 plots')
), s AS (
INSERT INTO property_intelligence.societies (id, name, city, address, noc_approved, noc_summary, details_source_url, record_type)
SELECT gen_random_uuid(), v.name, 'Faisalabad', 'Faisalabad', v.noc, v.summ, 'https://fda.gov.pk/schemes_private', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.societies x WHERE x.city = 'Faisalabad' AND lower(regexp_replace(x.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')))
RETURNING id
)
INSERT INTO property_intelligence.candidate_societies (id, name, regulator, city, status, record_type)
SELECT gen_random_uuid(), v.name, 'FDA', 'Faisalabad', 'ONBOARDED', 'FACT' FROM v
WHERE NOT EXISTS (SELECT 1 FROM property_intelligence.candidate_societies c WHERE c.regulator = 'FDA' AND lower(regexp_replace(c.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g')));

WITH v(name, claim, eid, url, src) AS (VALUES
('Sitara Sapna City Chak No.123/JB','FDA list: Approved; 729 plots','d76889ac-47cc-51c3-ac3b-274e19a79f96','https://fda.gov.pk/uploads/society/society_map_sitara-sapna-city-chak-no-123jb_5997_13072023032203.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al barkat Villas, Chak No. 226/RB, Faisalabad','FDA list: Approved; 110 plots','a44e97b5-b24d-5941-9168-06f8762d8e0d','https://fda.gov.pk/uploads/society/society_map_al-barkat-villas-chak-no-226rb-faisalabad_9784_17072023102831.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Cooperative Housing and Building Society Employees of University of Agriculture Faisalabad, Chak No. 196/RB','FDA list: Approved; 476 plots','7b3d02a2-e178-5361-81cc-6ee5f757b97f','https://fda.gov.pk/uploads/society/society_map_cooperative-housing-and-building-society-employees-of-university-of-agriculture-faisalabad-chak-no-196rb_3865_14112024032541.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Vista Homes Chak No. 121/JB','FDA list: Approved; 117 plots','29d7480b-83b7-5bba-9da0-9b6710661f39','https://fda.gov.pk/uploads/society/society_map_vista-homes-chak-no-121jb_2614_17072023105453.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Gold City Chak No. 215/RB','FDA list: Approved; 704 plots','fd8ec6c6-a993-5e91-8eb3-8ae5bc29ca45','https://fda.gov.pk/uploads/society/society_map_sitara-gold-city-chak-no-215rb_9596_13072023035746.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Govt: Employees Co- Operative Housing Society Scheme-I Chak No.213/RB','FDA list: Approved; 90 plots','9ce28525-7864-528e-bfa4-42680b8f4fe8','https://fda.gov.pk/uploads/society/society_map_govt-employees-co-operative-housing-society-scheme-i-chak-no-213rb_9706_14112024033123.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Rahim Town Chak No.220/RB','FDA list: Approved; 180 plots','310d4558-d42f-5636-90ac-f1889459846e','https://fda.gov.pk/uploads/society/society_map_rahim-town-chak-no-220rb_5219_14112024034232.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Icon Gold Valley Chak No. 192/RB Faislabad','FDA list: Approved; 496 plots','1c087faf-33ac-54d4-813f-4a326dccb446','https://fda.gov.pk/uploads/society/society_map_icon-gold-valley-chak-no-192rb-faislabad_7987_14112024033422.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Nazimabad City Chak No. 220/RB','FDA list: Approved; 90 plots','50b44f5e-124a-5b3d-a8c3-aa686ed068b7','https://fda.gov.pk/uploads/society/society_map_nazimabad-city-chak-no-220rb_9429_13072023034253.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Model Town, Chak No. 263/RB, Samundari Road, dijkot, Faisalabad','FDA list: Approved; 175 plots','45f3e248-1096-5661-baa2-633244f55742','https://fda.gov.pk/uploads/society/society_map_model-town-chak-no-263rb-samundari-road-dijkot-faisalabad_5184_14112024033822.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Lyallpur Garden Chak No. 212/RB','FDA list: Approved; 467 plots','0567d19e-68ce-5354-8373-89ea894a6409','https://fda.gov.pk/uploads/society/society_map_lyallpur-garden-chak-no-212rb_4177_13072023040044.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Liaqat Town Chak No.220/RB','FDA list: Approved; 623 plots','3cfac4bb-e2a7-55af-be40-72af0451262a','https://fda.gov.pk/uploads/society/society_map_liaqat-town-chak-no-220rb_4905_13072023030108.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('New Farid Town Chak No.196/RB','FDA list: Approved; 165 plots','5273f27f-5d8d-5b83-8ef8-4bcd59a92d17','https://fda.gov.pk/uploads/society/society_map_new-farid-town-chak-no-196rb_7346_13072023031304.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ibrahim Villas Chak No. 199/RB','FDA list: Approved; 34 plots','4f7541a2-bd8d-5821-a9d8-4c70400d8bba','https://fda.gov.pk/uploads/society/society_map_ibrahim-villas-chak-no-199rb_6064_17072023104204.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Pine Park Chak No. 117/JB Faisalabad','FDA list: Approved; 592 plots','a06a4cf2-4966-5984-8fc0-9643a31b9ea1','https://fda.gov.pk/uploads/society/society_map_pine-park-chak-no-117jb-faisalabad_7415_14112024034055.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Raja Park Chak No.222/RB','FDA list: Approved; 277 plots','9becbeda-2a7d-5dfb-a47d-3876234b769c','https://fda.gov.pk/uploads/society/society_map_raja-park-chak-no-222rb_2231_13072023024809.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ghafoor Garden, Chak No. 204/RB','FDA list: Approved; 99 plots','102479b4-328b-5439-b767-f023cf412c9c','https://fda.gov.pk/uploads/society/society_map_ghafoor-garden-chak-no-204rb_4758_13072023033100.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Park City Chak No. 215/RB','FDA list: Approved; 767 plots','1b6bb9b3-42eb-5248-8aff-39858caa5021','https://fda.gov.pk/uploads/society/society_map_sitara-park-city-chak-no-215rb_4970_13072023040928.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('CITI Housing Scheme Chak No. 4&5/JB','FDA list: Approved; 2182 plots','f3d5bf11-1da0-5837-8c71-d42a3621c740','https://fda.gov.pk/uploads/society/society_map_citi-housing-scheme-chak-no-45jb_1022_20022024024106.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Wadi-e-Sitara Chak No. 200/RB','FDA list: Approved; 487 plots','79cf9578-7b26-56c9-b1f8-9a90041d4ea5','https://fda.gov.pk/uploads/society/society_map_wadi-e-sitara-chak-no-200rb_4345_13072023040439.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al Barkah Chak No. 226/RB Faisalabad','FDA list: Approved; 21 plots','34d8c304-80d5-53ef-9b80-72036f463dfc','https://fda.gov.pk/uploads/society/society_map_al-barkah-chak-no-226rb-faisalabad_9304_14112024032034.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Hamra Town Chak No.199/RB','FDA list: Approved; 172 plots','3d17d177-c3d0-5ccb-8d30-d58854c1fada','https://fda.gov.pk/uploads/society/society_map_al-hamra-town-chak-no-199rb_1270_22072024010453.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Usman Block Chak No.120/JB','FDA list: Approved; 91 plots','84b4ebd9-50b9-58ad-b69c-0dc96fca5654','https://fda.gov.pk/uploads/society/society_map_usman-block-chak-no-120jb_2149_17072023105406.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Defence City, Chak No. 226/RB & 238/RB, Faisalabad','FDA list: Approved; 813 plots','f0d5cc02-f6c9-5884-b493-3d186ac7be6e','https://fda.gov.pk/uploads/society/society_map_defence-city-chak-no-226rb-238rb-faisalabad_1861_17072023103234.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Diamond City 226/RB, Satyana Road','FDA list: Approved; 258 plots','840e07c4-aa5c-506f-b5ba-322ff5200527','https://fda.gov.pk/uploads/society/society_map_sitara-diamond-city-226rb-satyana-road_7267_14112024034444.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Govt: Employees Co-Operative Housing Society-II Chak No.199/RB','FDA list: Approved; 202 plots','47a2eb83-60b9-578b-b9ea-b58fe51bf715','https://fda.gov.pk/uploads/society/society_map_govt-employees-co-operative-housing-society-ii-chak-no-199rb_5963_14112024033140.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Raheem Block Chak No. 204/RB Faisalabad','FDA list: Approved; 65 plots','cbd54a80-7cf6-5c02-8071-53d575a1a061','https://fda.gov.pk/uploads/society/society_map_raheem-block-chak-no-204rb-faisalabad_9839_14112024034147.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ideal Valley Chak No. 202/RB','FDA list: Approved; 131 plots','28908d30-9397-5406-b719-c15b1b2b899b','https://fda.gov.pk/uploads/society/society_map_ideal-valley-chak-no-202rb_6835_13072023041017.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Nawaz Town Chak No.120/JB','FDA list: Approved; 48 plots','a91a17a8-43c9-5c4f-b864-91418673ddc8','https://fda.gov.pk/uploads/society/society_map_nawaz-town-chak-no-120jb_5012_13072023025953.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Lyallpur Villas Chak No. 204/RB','FDA list: Approved; 30 plots','f94f0872-d4f3-588f-86aa-5b482770adc0','https://fda.gov.pk/uploads/society/society_map_lyallpur-villas-chak-no-204rb_2855_28112024093737.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('New Garden Block Phase II, Chak No.208/RB','FDA list: Approved; 510 plots','f24a6a45-979e-5f9b-a91c-205c8b27561a','https://fda.gov.pk/uploads/society/society_map_new-garden-block-phase-ii-chak-no-208rb_9096_17072023102412.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Raza Garden Chak No.204/RB','FDA list: Approved; 149 plots','0add240b-5de9-53af-800b-51ae5f0b83b5','https://fda.gov.pk/uploads/society/society_map_raza-garden-chak-no-204rb_5247_13072023032005.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Shahbaz Town Chak No.220/RB Faisalabad','FDA list: Approved; 880 plots','14e5df0e-cfa6-5c03-b8d6-bf6d7525b6b0','https://fda.gov.pk/uploads/society/society_map_shahbaz-town-chak-no-220rb-faisalabad_4381_13072023031105.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Park City Extension Chak No. 215/RB','FDA list: Approved; 767 plots','b60ffc01-cabd-55cf-8ff3-7613f1b82e8c','https://fda.gov.pk/uploads/society/society_map_sitara-park-city-extension-chak-no-215rb_4933_14112024034541.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('LCM Canal Burg Chak No. 212/RB','FDA list: Approved; 339 plots','cd7925ac-fec1-5e58-99a3-d9bf207f375d','https://fda.gov.pk/uploads/society/society_map_lcm-canal-burg-chak-no-212rb_4583_17072023102306.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Qamar Block Chak No. 208/RB Faisalabad','FDA list: Approved','8daabc85-c38c-576a-989c-e8814b45675c','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Madina Paradise Chak No. 235/RB Faisalabad','FDA list: Approved; 526 plots','2e663826-cc3a-5d17-b7c7-ea066e9b043b','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Gulberg housing Chak No. 61/GB, 120/GB Faisalabad','FDA list: Approved; 1000 plots','11c7bcb1-e82d-56a4-bfbc-5acab951d2f6','https://fda.gov.pk/uploads/society/society_map_gulberg-housing-chak-no-61gb-120gb-faisalabad_9642_21052026014805.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ali Town Sitara Gold city, Chak No. 215/RB, Satyana Road, Faisalabad','FDA list: Approved; 100 plots','5e296c65-6ae1-51bc-9850-5ca483c2617c','https://fda.gov.pk/uploads/society/society_map_ali-town-sitara-gold-city-chak-no-215rb-satyana-road-faisalabad_5862_14112024032204.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Younis Town Chak No. 225/RB','FDA list: Approved; 501 plots','3aa8e6b6-787b-5bc2-914d-09cbc061d574','https://fda.gov.pk/uploads/society/society_map_younis-town-chak-no-225rb_2776_13072023030340.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Defence view Executive Block Chak No. 226/RB Satiana Road Faisalabad','FDA list: Approved; 89 plots','4236e775-1fb7-5f54-960a-b0fdfe967f6f','https://fda.gov.pk/uploads/society/society_map_defence-view-executive-block-chak-no-226rb-satiana-road-faisalabad_7452_14112024032741.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('The Four Seasons Phase-I Chak No. 234/RB','FDA list: Approved; 1121 plots','819a3ade-b293-5317-a455-97fb00d147e5','https://fda.gov.pk/uploads/society/society_map_the-four-seasons-phase-i-chak-no-234rb_9626_13072023032636.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Orchard Homes Zaman Block Chak No. 239/RB','FDA list: Approved; 266 plots','36beb359-1248-5207-9fd0-8b25f8b1df1a','https://fda.gov.pk/uploads/society/society_map_orchard-homes-zaman-block-chak-no-239rb_3978_17122024010315.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('EMAAN CITY Chak No. 61/GB','FDA list: Approved; 505 plots','73b96eb8-2a49-5566-8f8d-2ce32a30efa4','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Fatima Block Chak No. 209/RB Faisalabad','FDA list: Approved; 19 plots','6f390d1d-d8fe-58b0-8c13-13b669721211','https://fda.gov.pk/uploads/society/society_map_fatima-block-chak-no-209rb-faisalabad_4572_14112024033039.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Green Homes Chak No. 208/RB','FDA list: Approved; 153 plots','af067c0d-f0bb-5ec7-aa4b-0ae7bfba7885','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Zee Garden Chak No. 198/RB, Faisalabad','FDA list: Approved; 585 plots','3778efcd-d3f7-5fb9-a3b5-6d01d28e9196','https://fda.gov.pk/uploads/society/zeegarden.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ibraheem Bajwa Town Chak No.217/RB','FDA list: Approved; 376 plots','77c86ef4-3227-58c9-a6ce-dceca13bb6c5','https://fda.gov.pk/uploads/society/society_map_ibraheem-bajwa-town-chak-no-217rb_1678_14112024033357.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Faisal Town Chak No.217/RB','FDA list: Approved; 160 plots','24eaf6d4-958d-5bb2-9daf-759ddb95612f','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Green Orchard Chak No. 209 RB Faisalabad','FDA list: Approved; 650 plots','fe6518cc-dcd8-5e22-9f50-dc5deae03e6b','https://fda.gov.pk/uploads/society/society_map_green-orchard-chak-no-209-rb-faisalabad_5133_14112024033250.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30')
), t AS (
SELECT s.id AS sid, v.claim, v.eid::uuid AS eid, v.url, v.src FROM v JOIN property_intelligence.societies s ON s.city = 'Faisalabad' AND lower(regexp_replace(s.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g'))
WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')
), ev AS (
INSERT INTO trust.evidence (id, type, file_ref, source_ref, document_type, record_type)
SELECT eid, 'document', url, src, 'OTHER', 'FACT' FROM t
ON CONFLICT (id) DO NOTHING
RETURNING id
)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs)
SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid, url, src) AS (VALUES
('Smart Block Sitara Diamond City 226/RB, Faisalabad','FDA list: Approved; 258 plots','4099b787-465e-5468-8a4c-788f0d1d88cd','https://fda.gov.pk/uploads/society/society_map_smart-block-sitara-diamond-city-226rb-faisalabad_7927_28112024094101.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Raheem Valley Extension Chak No. 215/RB, Faisalabad','FDA list: Approved; 91 plots','831149d2-51bd-5bcd-9744-42ef6a3bfc59','https://fda.gov.pk/uploads/society/society_map_al-raheem-valley-extension-chak-no-215rb-faisalabad_3989_17122024122047.PDF','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Iqbal Block, Chak No. 204/RB, Faisalabad','FDA list: Approved; 66 plots','2dd02809-53ec-5454-80e6-140b1e052ffa','https://fda.gov.pk/uploads/society/society_map_iqbal-block-chak-no-204rb-faisalabad_9504_28112024093638.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Qamar Villas Chak No. 198/RB Faisalabad','FDA list: Approved; 31 plots','580a1d22-293f-5bf8-8312-3b9bc07b8eb9','https://fda.gov.pk/uploads/society/society_map_sitara-qamar-villas-chak-no-198rb-faisalabad_9909_14112024034559.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Madina Garden, Chak No. 239/GB, Faisalabad','FDA list: Approved; 754 plots','b2048c3f-e49c-5fc1-87c4-4e6201cd6a80','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Raza Town Chak No.204/RB','FDA list: Approved; 159 plots','fe116046-c907-5347-a3cb-5dbbf182f1ef','https://fda.gov.pk/uploads/society/society_map_raza-town-chak-no-204rb_5193_13072023031409.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Khalid Town Chak No. 7/JB Faisalabad','FDA list: Approved; 244 plots','5378f63e-e23e-5737-8fa4-d501af46009b','https://fda.gov.pk/uploads/society/society_map_khalid-town-chak-no-7jb-faisalabad_9640_17072023104234.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Haram Town Chak No. 66/JB','FDA list: Approved; 71 plots','100cbbf8-13fb-51c2-90c7-037221e1ce72','https://fda.gov.pk/uploads/society/society_map_al-haram-town-chak-no-66jb_4686_08052024011101.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('New Garden Town Chak No.214/RB','FDA list: Approved; 145 plots','e957ce6c-cd8b-5995-9d86-e978c2c3e80c','https://fda.gov.pk/uploads/society/society_map_new-garden-town-chak-no-214rb_2928_13072023025045.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Madina Garden, Chak No. 234/RB, Samundari Road, Faisalabad','FDA list: Approved; 348 plots','ef5e66b0-d0f3-5b64-a940-d3c90bef40b9','https://fda.gov.pk/uploads/society/society_map_madina-garden-chak-no-234rb-samundari-road-faisalabad_2621_14112024033646.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('New Muslim Town Chak No. 120/JB','FDA list: Approved; 140 plots','7d99cbe1-c0c9-5bf0-9e1d-fca3ccaa1b63','https://fda.gov.pk/uploads/society/society_map_new-muslim-town-chak-no-120jb_4016_17072023104419.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Defence Paradise Chak No. 222/RB Faisalabad','FDA list: Approved; 533 plots','03b1a1fd-b8ae-515f-bb12-3eb41366d688','https://fda.gov.pk/uploads/society/society_map_defence-paradise-chak-no-222rb-faisalabad_1067_17072023103324.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('WAPDA City Chak No.192/RB','FDA list: Approved; 12124 plots','e1afee7a-152f-5727-89af-b1b9e35f794d','https://fda.gov.pk/uploads/society/society_map_wapda-city-chak-no-192rb_6110_14112024034911.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Rehman Block Chak No. 204/RB','FDA list: Approved; 112 plots','0f9fb1ba-812f-58dc-8565-ff2e2f321a3f','https://fda.gov.pk/uploads/society/society_map_rehman-block-chak-no-204rb_7817_14112024034326.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Green Block Chak No. 204/RB','FDA list: Approved; 173 plots','491215cf-1156-55de-802e-f474269d6bd5','https://fda.gov.pk/uploads/society/society_map_green-block-chak-no-204rb_2225_17072023103836.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Image Villas, Chak No. 225/RB, Faisalabad','FDA list: Approved; 45 plots','39f8adf7-d9b0-513c-a1d1-610de491ead7','https://fda.gov.pk/uploads/society/society_map_image-villas-chak-no-225rb-faisalabad_6223_14112024033459.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('A.Zee Housing Chak No. 234/RB','FDA list: Approved; 1182 plots','d9621c0a-a59b-5458-8d37-d16e52a5cea2','https://fda.gov.pk/uploads/society/society_map_a-zee-housing-chak-no-234rb-faisalabad_6987_14112024023744.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Canal Villas Chak No. 204/RB Faisalabad','FDA list: Approved; 122 plots','56e5d166-a19d-5940-a418-432ed939d377','https://fda.gov.pk/uploads/society/society_map_canal-villas-chak-no-204rb-faisalabad_6265_13072023035837.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Model City Royal Villas, Chak No. 214/RB Faisalabad','FDA list: Approved; 1202 plots','2d85f3e1-7415-5e8d-bc34-8278020f37f3','https://fda.gov.pk/uploads/society/society_map_model-city-royal-villas-chak-no-214rb-faisalabad_2643_17122024010114.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ejaz Town Chak No.124/JB Faisalabad','FDA list: Approved; 172 plots','7a727c91-d188-579a-93f2-554a6caec394','https://fda.gov.pk/uploads/society/society_map_ejaz-town-chak-no-124jb-faisalabad_3990_13072023024542.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Faisal Town Chak No.217/RB Faisalabad','FDA list: Approved','0833e1e0-3ff2-5e32-8572-8a7413550653','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Nazimabad Villas Chak No. 220/ RB, Faisalabad','FDA list: Approved; 80 plots','0edf1fb2-2642-5155-94d1-cf22e35d3a21','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Hamza Homes Chak No. 204/RB Faisalabad','FDA list: Approved; 173 plots','bb93f30a-0226-574c-8b22-5a53e1603ddb','https://fda.gov.pk/uploads/society/society_map_hamza-homes-chak-no-204rb-faisalabad_5777_14112024033325.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Oasis One Chak No. 209/RB Faisalabad','FDA list: Approved; 543 plots','aba80f23-2cb0-5b7c-8e5b-a925305bc8e5','https://fda.gov.pk/uploads/society/society_map_oasis-one-chak-no-209rb-faisalabad_1236_17122024010144.PDF','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Paradise Palm Chak No.234/RB, Faisalabad','FDA list: Approved','f4696751-d570-5354-a339-5a49fcb56ab3','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Madina Garden, Chak No. 387/GB, Samundari Road, Faisalabad','FDA list: Approved; 436 plots','08719103-b4c5-59c6-b25a-bbd7fe48fe8c','https://fda.gov.pk/uploads/society/society_map_madina-garden-chak-no-387gb-samundari-road-faisalabad_7464_28112024093833.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Lyallpur Villas Executive Block Chak No. 204/RB Faisalabad','FDA list: Approved','9e7d9e35-bcb8-5d20-98f9-b72dcb8e1113','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Koh-I-Noor Town Chak No.213/RB Faisalabad','FDA list: Approved; 215 plots','ff2bde08-2829-5c2f-ba75-ff1731899be8','https://fda.gov.pk/uploads/society/society_map_koh-i-noor-town-chak-no-213rb-faisalabad_4252_28112024093707.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Abdullah Farm Housing Scheme Chak No.204/RB','FDA list: Approved; 23 plots','df9dff21-2d2e-5712-bc9e-2372b093c524','https://fda.gov.pk/uploads/society/society_map_abdullah-farm-housing-scheme-chak-no-204rb_3515_13072023032430.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Prime Valley Chak No. 225/RB Faisalabad','FDA list: Approved; 290 plots','baf599c5-94f9-542c-ad21-f3e164874d78','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Lyallpur Avenue Chak No.227/RB Faisalabad','FDA list: Approved; 349 plots','fcbb2f9f-e0f2-5287-b29c-6e64fa36f008','https://fda.gov.pk/uploads/society/society_map_lyallpur-avenue-chak-no-227rb-faisalabad_3419_13022023121045.PDF','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Nasir Town Chak No.224/RB Faisalabad','FDA list: Approved; 108 plots','48076413-6525-5456-9cbd-2254b7a717f6','https://fda.gov.pk/uploads/society/society_map_nasir-town-chak-no-224rb-faisalabad_5462_14112024033843.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Rehmat Garden Chak No. 222/RB, Faisalabad','FDA list: Approved','7e50a2d6-2a84-5c53-8562-06b119155b5c','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Rachna Town Chak No.214/RB Faisalabad','FDA list: Approved; 341 plots','bd108fb1-6276-5fba-b7f8-20f224690911','https://fda.gov.pk/uploads/society/society_map_rachna-town-chak-no-214rb-faisalabad_6311_13072023025238.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Abban Valley Chak No. 197/RB & 198/RB Faisalabad','FDA list: Approved; 339 plots','e371d69e-e77c-5c7e-802d-a328af3c268a','https://fda.gov.pk/uploads/society/society_map_sitara-abban-valley-chak-no-197rb-198rb-faisalabad_5302_13072023035416.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Heights Chak No.120/JB Faisalabad','FDA list: Approved; 56 plots','5522df42-adcb-5e41-aead-aba2b1a15e11','https://fda.gov.pk/uploads/society/society_map_sitara-heights-chak-no-120jb-faisalabad_4736_02022023034556.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('SMD Homes, Chak No. 121/ JB, Sargodha Road, Near Same Nala, Faisalabad','FDA list: Approved; 966 plots','766a1787-133f-5be8-8ce2-f3a106ba2e44','https://fda.gov.pk/uploads/society/society_map_smd-homes-chak-no-121-jb-sargodha-road-near-same-nala-faisalabad_2705_29112024101454.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('The Meadows Phase-II, Chak No. 234/RB Faisalabad','FDA list: Approved; 1375 plots','070c7aa0-d738-5069-94c7-8c6fa216c966','https://fda.gov.pk/uploads/society/society_map_the-meadows-phase-ii-chak-no-234rb-faisalabad_1259_14112024034752.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('The Fasialabad Lawyers Cooperative Housing Society, Chak No. 208/RB Faisalabad','FDA list: Approved; 783 plots','14280e62-d818-532f-91e7-c6535778f92a','https://fda.gov.pk/uploads/society/society_map_the-fasialabad-lawyers-cooperative-housing-society-chak-no-208rb-faisalabad_3270_17122024122324.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('The Meadows Phase-I, Chak No. 234/RB Faisalabad','FDA list: Approved; 115 plots','2be891ed-3d23-5aec-bf39-1c906af6a509','https://fda.gov.pk/uploads/society/society_map_the-meadows-phase-i-chak-no-234rb-faisalabad_8867_13072023035503.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Top City Chak No. 236/RB Faisalabad','FDA list: Approved; 210 plots','c29b809c-0a2d-5441-aab0-c481c4038794','https://fda.gov.pk/uploads/society/society_map_top-city-chak-no-236rb-faisalabad_5109_28112024020318.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Umer Exectutive Block Chak No. 07/JB Faisalabad','FDA list: Approved','7480fd16-b0a6-561f-9238-da081904f5d9','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Air Avinue City, Chak No. 230/RB Faisalabad','FDA list: Approved; 347 plots','38483801-1294-51a3-8b46-f7b8adefb4c0','https://fda.gov.pk/uploads/society/society_map_air-avinue-city-chak-no-230rb-faisalabad_3705_17072023102743.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Wadi-e-Aban Chak No.200/RB Faisalabad','FDA list: Approved; 27 plots','cdca96b3-6771-536f-a0d5-1f0999821f0c','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Chenab Garden Chak No. 223/RB Faisalabad','FDA list: Approved; 2027 plots','59d1f8ce-97a9-54c5-a202-b963b950e390','https://fda.gov.pk/uploads/society/society_map_chenab-garden-chak-no-223rb-faisalabad_3624_13072023023450.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Din Gardens Chak No. 144/RB Faisalabad','FDA list: Approved; 604 plots','fccd55de-113a-5427-96f1-c2bc56bf93a0','https://fda.gov.pk/uploads/society/society_map_din-gardens-chak-no-144rb-faisalabad_8465_12102023101300.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Fareed Town Chak No.214/RB Faisalabad','FDA list: Approved; 227 plots','b1072869-02c4-5941-a6b2-e217fb5a1bed','https://fda.gov.pk/uploads/society/society_map_fareed-town-chak-no-214rb-faisalabad_6919_13072023024853.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Shalimar Park Chak No.224/RB Faisalabad','FDA list: Approved; 70 plots','ecd89e69-5e21-5bdb-8ac4-24a5a475ee81','https://fda.gov.pk/uploads/society/society_map_shalimar-park-chak-no-224rb-faisalabad_2261_13072023024222.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Haider Garden Chak No. 119/GB Faisalabad','FDA list: Approved; 699 plots','67fe388c-7c41-5085-9e23-cd7c0377f42d','https://fda.gov.pk/uploads/society/society_map_haider-garden-chak-no-119gb-faisalabad_3258_13072023040525.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Haven Habitat-I Chak No.204/RB Faisalabad','FDA list: Approved; 157 plots','1d69cad1-3ed2-52c4-bc5b-bdfcb8af07ad','https://fda.gov.pk/uploads/society/society_map_haven-habitat-i-chak-no-204rb-faisalabad_5386_13072023031841.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30')
), t AS (
SELECT s.id AS sid, v.claim, v.eid::uuid AS eid, v.url, v.src FROM v JOIN property_intelligence.societies s ON s.city = 'Faisalabad' AND lower(regexp_replace(s.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g'))
WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')
), ev AS (
INSERT INTO trust.evidence (id, type, file_ref, source_ref, document_type, record_type)
SELECT eid, 'document', url, src, 'OTHER', 'FACT' FROM t
ON CONFLICT (id) DO NOTHING
RETURNING id
)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs)
SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid, url, src) AS (VALUES
('Prime City Chak NO. 239/RB, Staina Road, Faisalabad','FDA list: Approved; 266 plots','64708e1f-d93d-581a-aceb-d33f1ea31f2a','https://fda.gov.pk/uploads/society/society_map_prime-city-chak-no-239rb-staina-road-faisalabad_6692_17072023104553.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Gulshane-e-Haram Villas Chak no.223/RB, Faisalabad','FDA list: Approved; 395 plots','b0df4d0a-9859-5e4d-8165-2ee565471808','https://fda.gov.pk/uploads/society/society_map_gulshane-e-haram-villas-chak-no-223rb-faisalabad_8464_17122024121935.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('LalazarColony Chak No.226/RB Faisalabad','FDA list: Approved; 127 plots','21bd83d5-77b1-5593-bcf7-25f7556b32cf','https://fda.gov.pk/uploads/society/society_map_lalazarcolony-chak-no-226rb-faisalabad_3988_13072023024429.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Muhammad Khan Town Chak No.207/RB Faisalabad','FDA list: Approved; 242 plots','7425d9f6-f3d5-5389-874d-1f1757ea81e5','https://fda.gov.pk/uploads/society/society_map_muhammad-khan-town-chak-no-207rb-faisalabad_3754_13072023031459.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('GREEN BLOCK PHASE-IV Chak No. 204/RB Faisalabad','FDA list: Approved; 210 plots','b7bfc159-3a29-5424-9dc2-0dfe72bcf5ca','https://fda.gov.pk/uploads/society/society_map_green-block-phase-iv-chak-no-204rb-faisalabad_2376_28112024093608.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('GREEN BLOCK PHASE-I II, Chak No. 204/RB Faisalabad','FDA list: Approved; 87 plots','0c7d9392-4b5a-5cdf-ab7c-7c149315b0a8','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Grand Housing Arena Chak No. 235/RB Faisalabad','FDA list: Approved; 149 plots','d5f43653-d622-55c2-8f4b-72c18ee574b8','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Khayaban Garden Hassan Block Chak No. 121/JB Faisalabad','FDA list: Approved; 318 plots','b0d2345e-18cc-544c-8d90-3ec0b8d1c4e9','https://fda.gov.pk/uploads/society/society_map_khayaban-garden-hassan-block-chak-no-121jb-faisalabad_1934_17072023102140.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Faisalabad Lawyers Cooperative Housing Society Chak No. 198/RB','FDA list: Approved','e0e104f2-49c7-5801-a713-3de47a09757f','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Nawab City Chak No. 5/JB Faisalabad','FDA list: Approved; 324 plots','ab5fe6ab-a4da-5128-9265-7ecba8cb0a34','https://fda.gov.pk/uploads/society/society_map_nawab-city-chak-no-5jb-faisalabad_7694_17072023101839.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Dream Valley Chak No. 186/RB Faisalabad','FDA list: Approved; 147 plots','3ec41028-e6e6-5592-b9e0-b9f315491211','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Hameed Town Chak No.124/JB Faisalabad','FDA list: Approved; 53 plots','f825b200-d8b5-533a-96ac-5b9199bd8817','https://fda.gov.pk/uploads/society/society_map_hameed-town-chak-no-124jb-faisalabad_1746_17072023104128.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Divine Enclave Chak No. 204/Rb Faislabad','FDA list: Approved; 456 plots','8254ab66-40bd-5905-afb2-f88bb92c0fdb','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Deens Paradise VIP Block Chak No. 233/RB, Faisalabad','FDA list: Approved; 394 plots','06ae7b23-5cba-53af-9a54-5c5f4703593a','https://fda.gov.pk/uploads/society/society_map_deens-paradise-vip-block-chak-no-233rb-faisalabad_1502_29112024101419.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Rafi Villas Chak No. 119/GB Faisalabad','FDA list: Approved; 199 plots','88495086-ae5c-5c8b-ae75-6092b903a766','https://fda.gov.pk/uploads/society/society_map_rafi-villas-chak-no-119gb-faisalabad_8448_21052026014501.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Executive City Chak No. 215/RB Faisalabad','FDA list: Approved; 509 plots','41126e3d-b5ff-5c6d-9f7c-0cead95e3194','https://fda.gov.pk/uploads/society/society_map_executive-city-chak-no-215rb-faisalabad_2189_17122024121817.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Abdullah Defence Chak No. 229/RB Faisalabad','FDA list: Approved; 202 plots','30874852-bf92-578f-9510-c81161df7b6f','https://fda.gov.pk/uploads/society/society_map_abdullah-defence-chak-no-229rb-faisalabad_4960_17072023102638.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Babar Sultan Valley Chak No. 258/RB, Faisalabad','FDA list: Approved; 316 plots','139cd474-9f39-55f9-8f98-e99a31c3ffbf','https://fda.gov.pk/uploads/society/society_map_babar-sultan-valley-chak-no-258rb-faisalabad_7361_29112024101827.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Colony Chak No.222/RB Faisalabad','FDA list: Approved; 1223 plots','3c32b1cf-178b-5d9d-83f9-08cbf2665b93','https://fda.gov.pk/uploads/society/society_map_sitara-colony-chak-no-222rb-faisalabad_2095_13072023023905.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Canal Valley Chak No. 209 & 215/RB Faisalabad','FDA list: Approved; 507 plots','3259bf57-4279-5031-96ac-65d2bf6a7bba','https://fda.gov.pk/uploads/society/society_map_canal-valley-chak-no-209-215rb-faisalabad_4847_28112024093516.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Bismillah Orchard Chak No. 61/GB Faisalabad','FDA list: Approved; 464 plots','fae019fd-d966-583f-b83d-76f05c6c76c7','https://fda.gov.pk/uploads/society/society_map_bismillah-orchard-chak-no-61gb-faisalabad_5062_28112024093437.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Umar Garden Chak No. 204/RB','FDA list: Approved; 81 plots','80a6a88e-c220-5ce0-a413-244e99caabc3','https://fda.gov.pk/uploads/society/society_map_umar-garden-chak-no-204rb_2066_14112024034841.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('The Four Seasons Phase-II Chak No. 234/RB Faisalabad','FDA list: Approved; 729 plots','df68aaf4-9ec1-573e-b9a3-db6dcdc0b685','https://fda.gov.pk/uploads/society/society_map_the-four-seasons-phase-ii-chak-no-234rb-faisalabad_4743_13072023034951.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('AJS Housing Chak No. 215/RB Faisalabad','FDA list: Approved; 852 plots','cfb2db2f-dda4-5f21-825e-23e7b9955d2b','https://fda.gov.pk/uploads/society/society_map_ajs-housing-chak-no-215rb-faisalabad_7927_02052025113546.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Akbar Housing Scheme Chak No. 204/RB','FDA list: Approved; 81 plots','2f8aaec6-7013-58bb-9316-283ee21f73d5','https://fda.gov.pk/uploads/society/society_map_akbar-housing-scheme-chak-no-204rb_5089_13072023040613.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ahmad Canal View Chak No247/RB','FDA list: Approved','b01855a1-5ae0-5d8d-b5d3-b33cda1929da','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Shalimar Homes 213/RB Faisalabad','FDA list: Approved','dee038bc-b809-5afb-a9eb-0354ea9af406','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Abdullah Valley Chak No. 235/RB','FDA list: Approved; 340 plots','ef8bd789-eaa3-52ef-80b3-02a311294600','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('CITI Housing Scheme Chak No. 234/RB','FDA list: Approved; 2157 plots','efaf5540-344c-53b5-a7ec-7d3b594abcdd','https://fda.gov.pk/uploads/society/society_map_citi-housing-scheme-chak-no-234rb_6999_13072023041142.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Tech. Town Phase-II & III, Chak No. 226/RB','FDA list: Approved; 1025 plots','06623eda-6b05-5ef3-ae06-1a53158f6177','https://fda.gov.pk/uploads/society/society_map_tech-town-phase-ii-iii-chak-no-226rb_2316_14112024031535.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Shadman Town Chak No.120/JB','FDA list: Approved; 219 plots','9baa8919-25ec-5f98-a803-7f118dd121aa','https://fda.gov.pk/uploads/society/society_map_shadman-town-chak-no-120jb_6833_13072023024938.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Pine Garden Chak No. 209 RB Faisalabad','FDA list: Approved; 978 plots','ec84e0d3-7012-557e-8a0f-77aab5b9d1a6','https://fda.gov.pk/uploads/society/society_map_pine-garden-chak-no-209-rb-faisalabad_6326_14112024031551.PDF','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Premium Block Chak No. 204/RB Faisalabad','FDA list: Approved; 232 plots','e2030631-eec8-5286-bc78-54ac5a41d8c0','https://fda.gov.pk/uploads/society/society_map_premium-block-chak-no-204rb-faisalabad_9009_14112024031510.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Karim Town Chak No.224/RB','FDA list: Approved; 127 plots','e0f63526-6695-534a-a420-9f55926ad967','https://fda.gov.pk/uploads/society/society_map_karim-town-chak-no-224rb_6066_13072023030431.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Gulshan-e-Madina Chak No.120/JB','FDA list: Approved; 371 plots','099c47f3-c2ef-5de2-a334-f622448534c3','https://fda.gov.pk/uploads/society/society_map_gulshan-e-madina-chak-no-120jb_3394_17072023104053.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Eden Villas Chak No. 222/RB','FDA list: Approved; 102 plots','eed0bae6-d33f-5aee-9dca-98fa3fb9d9f6','https://fda.gov.pk/uploads/society/society_map_eden-villas-chak-no-222rb_4769_13072023034108.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Model City-II Chak No. 238/RB','FDA list: Approved; 474 plots','f6af4f8a-f3d0-5bb0-bdaf-df4010ef408c','https://fda.gov.pk/uploads/society/society_map_model-city-ii-chak-no-238rb_3067_17072023101944.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Jameel Farm Housing Scheme, Chak No. 217/RB, Faisalabad','FDA list: Approved; 190 plots','658f1e7b-dc49-5de8-9632-abef5875aa9f','https://fda.gov.pk/uploads/society/society_map_al-jameel-farm-housing-scheme-chak-no-217rb_5281_08052024013135.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Defense Fort Chak No. 223 RB','FDA list: Approved; 169 plots','4ae01828-4037-5948-b669-bcc9cc3709f9','https://fda.gov.pk/uploads/society/society_map_defense-fort-chak-no-223-rb_6571_13072023033931.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Green Town Chak No.122/JB','FDA list: Approved; 250 plots','c597c976-7586-59bd-93d4-08519b485978','https://fda.gov.pk/uploads/society/society_map_green-town-chak-no-122jb_7721_13072023030525.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Bilal Orchard, Chak No.196/RB, Ghona Road, Faisalabad','FDA list: Approved','6a003d98-9048-5063-9004-6089ca02bb14','https://fda.gov.pk/uploads/society/society_map_bilal-orchard-chak-no-196rb-ghona-road-faisalabad_2399_14112024031631.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Tech Town, Phase-V, Chak No. 225/RB, Malkhan wala, Faisalabad','FDA list: Approved; 462 plots','2bc22885-2d9f-5ce3-8cbb-428df5fb61bd','https://fda.gov.pk/uploads/society/society_map_tech-town-phase-v-chak-no-225rb-malkhan-wala-faisalabad_7186_14112024031658.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Iqbal Town Chak No.124/JB','FDA list: Approved; 634 plots','46c4a44c-b490-50fb-92e8-86659707b2c1','https://fda.gov.pk/uploads/society/society_map_iqbal-town-chak-no-124jb_3923_13072023024334.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Madina Green Valley, Chak No. 214/RB, Faisalabad','FDA list: Approved; 108 plots','8d7078e5-4e83-51b0-abc0-cde6d9cf8d8b','https://fda.gov.pk/uploads/society/society_map_madina-green-valley-chak-no-214rb-faisalabad_9212_14112024023925.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Niaz Garden Chak No.242/RB','FDA list: Approved; 187 plots','f649287b-4440-5594-85eb-f1291794f13c','https://fda.gov.pk/uploads/society/society_map_niaz-garden-chak-no-242rb_4487_13072023032521.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Rehmat Town Chak No.124/JB','FDA list: Approved; 747 plots','18a5ed31-0b36-5e7b-acad-bb1b88cbfd2c','https://fda.gov.pk/uploads/society/society_map_rehmat-town-chak-no-124jb_4897_13072023024723.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Supreme City Chak No.119/JB, Faisalabad','FDA list: Approved; 603 plots','fd955512-8c46-58a6-9257-ceb94ab67a68','https://fda.gov.pk/uploads/society/society_map_sitara-supreme-city-chak-no-119jb-faisalabad_6388_14112024024004.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sehgal City Chak No. 234/RB (Approved by TMA)','FDA list: Approved; 824 plots','76eaf979-a32d-56d5-b2bf-5ecc9e8207f0','https://fda.gov.pk/uploads/society/society_map_sehgal-city-chak-no-234rb-approved-by-tma_5172_17072023104757.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Mahboob Garden Chak No. 223/RB','FDA list: Approved; 209 plots','fc9031f2-1a49-5b65-ac6a-ce746ed57022','https://fda.gov.pk/uploads/society/society_map_al-mahboob-garden-chak-no-223rb_9667_14112024024742.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Park View Homes Chak No.5/JB, Sargodha Road Faisalabad','FDA list: Approved; 36 plots','547bb290-ab76-5e13-88e6-2cfa49e19d21','https://fda.gov.pk/uploads/society/society_map_park-view-homes-chak-no-5jb-sargodha-road-faisalabad_2805_14112024031847.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30')
), t AS (
SELECT s.id AS sid, v.claim, v.eid::uuid AS eid, v.url, v.src FROM v JOIN property_intelligence.societies s ON s.city = 'Faisalabad' AND lower(regexp_replace(s.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g'))
WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')
), ev AS (
INSERT INTO trust.evidence (id, type, file_ref, source_ref, document_type, record_type)
SELECT eid, 'document', url, src, 'OTHER', 'FACT' FROM t
ON CONFLICT (id) DO NOTHING
RETURNING id
)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs)
SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;

WITH v(name, claim, eid, url, src) AS (VALUES
('Model City Chak No. 465/GB','FDA list: Approved; 299 plots','4ac6299c-0bb1-50b0-9dd9-f6a9d239e2cb','https://fda.gov.pk/uploads/society/society_map_model-city-chak-no-465gb_5684_28112024093904.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Doctor City Chak No 238/RB Faisalabad','FDA list: Approved; 480 plots','48a210cc-f616-5a48-9f23-e73be52523a0','https://fda.gov.pk/uploads/society/society_map_doctor-city-chak-no-238rb-faisalabad_6168_17072023103411.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('100 Homes Chak No. 204/RB','FDA list: Approved; 56 plots','85364700-ead6-5260-a2ca-2c81f9fcdbd0','https://fda.gov.pk/uploads/society/100_Home.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Canal Park Chak No.204/RB Faisalabad','FDA list: Approved; 40 plots','dbf5c842-8e05-5cf2-8c4d-8803b491319a','https://fda.gov.pk/uploads/society/society_map_canal-park-chak-no-204rb-faisalabad_4290_13072023030721.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Green Valley Chak No. 234/RB','FDA list: Approved; 798 plots','d89ec6ae-e358-5b7e-bdfb-a0941421ab0c','https://fda.gov.pk/uploads/society/society_map_green-valley-chak-no-234rb_1076_17072023103922.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Ismael Green, Chak No. 196/RB, Millat Road, Faisalabad','FDA list: Approved; 702 plots','07861a3a-1bc0-5ca2-880f-2389514ddc54','https://fda.gov.pk/uploads/society/society_map_ismael-green-chak-no-196rb-millat-road-faisalabad_5846_14112024024902.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Oasis Orchard Chak No.223/RB, Faisalabad','FDA list: Approved; 363 plots','d8b01a33-46b9-5703-a185-b54e55d4b679','https://fda.gov.pk/uploads/society/society_map_oasis-orchard-chak-no-223rb-faisalabad_1355_14112024025015.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Riaz-ul-Jinnah Umar Block Chak No. 7/JB','FDA list: Approved; 581 plots','0d1a6c84-b5af-510a-b2b8-833502cd5d24','https://fda.gov.pk/uploads/society/society_map_riaz-ul-jinnah-umar-block-chak-no-7jb_6849_17072023101145.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Valley Chak No. 197/RB & 198/RB','FDA list: Approved; 381 plots','16daac72-4627-5caf-ac9c-6dc6cb1b7fb9','https://fda.gov.pk/uploads/society/society_map_sitara-valley-chak-no-197rb-198rb_2403_17122024022458.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Qasim Blossom View Chak No.121/JB, Faisalabad','FDA list: Approved; 140 plots','680802fa-db90-5faf-9e17-15bb3e99f527','https://fda.gov.pk/uploads/society/society_map_al-qasim-blossom-view-chak-no-121jb-faisalabad_2225_14112024025659.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Eden Garden Chak No. 208/RB','FDA list: Approved; 438 plots','51a3a0ab-fd8a-5711-bfb0-c5ee43a24378','https://fda.gov.pk/uploads/society/society_map_eden-garden-chak-no-208rb_3166_13072023032919.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Green View Colony Chak No.123/RB','FDA list: Approved; 285 plots','9f4022ba-301c-54bd-932d-429d94f2a135','https://fda.gov.pk/uploads/society/society_map_green-view-colony-chak-no-123rb_6237_13072023024056.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Gulshan-e-Iqbal Chak No.222/RB','FDA list: Approved; 1012 plots','dbd71324-c9f4-50df-9fc6-cb0f5b29eb1e','https://fda.gov.pk/uploads/society/society_map_gulshan-e-iqbal-chak-no-222rb_2399_17072023103717.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Muhammad Ali Housing Scheme Chak No. 222/RB','FDA list: Approved; 443 plots','4e38ceb4-dda7-5c92-8fe7-2edc86519493','https://fda.gov.pk/uploads/society/society_map_muhammad-ali-housing-scheme-chak-no-222rb_8297_13072023035108.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Jalal Town Chak No.196/RB','FDA list: Approved; 135 plots','cb894a2b-01c4-572c-8633-bd70b9d7e43e','https://fda.gov.pk/uploads/society/society_map_jalal-town-chak-no-196rb_9791_13072023031157.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Executive Block Chak No. 204/RB Faisalabad','FDA list: Approved; 55 plots','f1a0baf4-069e-5b4d-84b3-bdb05b84d985','https://fda.gov.pk/uploads/society/society_map_executive-block-chak-no-204rb-faisalabad_5778_17072023103602.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Manan Town Chak No. 121/JB','FDA list: Approved; 399 plots','08fc3273-0567-58b5-928e-ca34da1c4160','https://fda.gov.pk/uploads/society/society_map_manan-town-chak-no-121jb_6042_13072023035207.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Omega Residencia chak no.3/JB, FSD','FDA list: Approved; 640 plots','9daa6bf2-2c24-5a72-81fb-8d997c921f72','https://fda.gov.pk/uploads/society/omega%20residentia.jpeg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Saeed Colony, 213/RB','FDA list: Approved; 177 plots','14c855ab-8e5a-5b49-825a-31aa2e295e7c','https://fda.gov.pk/uploads/society/society_map_saeed-colony-213rb_8535_17072023104702.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sitara Villas Chak No. 197/RB, 198/RB Faisalabad','FDA list: Approved; 82 plots','2d4a2756-f57c-51eb-bc66-1f83b82f9fcb','https://fda.gov.pk/uploads/society/society_map_sitara-villas-chak-no-197rb-198rb-faisalabad_4024_14112024025928.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Al-Raheem Valley Chak No. 215/RB','FDA list: Approved; 308 plots','208635ea-0447-565a-a112-bf4463de177c','https://fda.gov.pk/uploads/society/society_map_al-raheem-valley-chak-no-215rb_7101_14112024030118.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Eden Garden Executive Block Chak No. 208/RB','FDA list: Approved; 809 plots','337910fd-0e79-5127-874f-179f02b02fe3','https://fda.gov.pk/uploads/society/society_map_eden-garden-executive-block-chak-no-208rb_8509_13072023040341.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Gulberg Valley Chak No. 215/RB','FDA list: Approved; 525 plots','96d70345-2a78-5814-9655-d33bf96f7482','https://fda.gov.pk/uploads/society/society_map_gulberg-valley-chak-no-215rb_6459_17072023104013.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Jamil Town Chak No.124/JB','FDA list: Approved; 716 plots','ed355415-69f9-57a6-bd49-f97b6e0bc166','https://fda.gov.pk/uploads/society/society_map_jamil-town-chak-no-124jb_5481_13072023024628.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Eden Orchard Chak No. 121/JB','FDA list: Approved; 1723 plots','f0cbf3c1-36f6-5a6b-9e8a-039a8f901d59','https://fda.gov.pk/uploads/society/society_map_eden-orchard-chak-no-121jb_8034_17072023103504.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Bilal Garden 196 RB, Faisalabad','FDA list: Approved; 240 plots','c5f4b91f-92eb-5804-a8aa-7e7d6325da4d','https://fda.gov.pk/uploads/society/society_map_bilal-garden-196-rb-faisalabad_8167_17072023103133.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Syed Block Chak No. 207/RB','FDA list: Approved; 127 plots','ea3736c5-e670-55bc-8ca9-8c06966b6ebd','https://fda.gov.pk/uploads/society/society_map_syed-block-chak-no-207rb_6872_17072023101426.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('MID City Chak No.207/RB, Faisalabad','FDA list: Approved; 342 plots','d78ae43e-802a-50b6-9313-f7df867fd7df','https://fda.gov.pk/uploads/society/society_map_mid-city-chak-no-207rb-faisalabad_5597_14112024030848.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Sareena Town Chak No.200/RB','FDA list: Approved','20ff6d50-bea9-5526-b19a-451aab1b56ca','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Park View Colony Chak No.200/RB','FDA list: Approved; 73 plots','2bacd812-f523-5057-8027-9a7cc050fe33','https://fda.gov.pk/uploads/society/society_map_park-view-colony-chak-no-200rb_7071_13072023030959.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Millat Town-III Chak No.196/RB','FDA list: Approved; 500 plots','074c3116-d1c5-5f01-8b7b-510b1061b0fd','https://fda.gov.pk/uploads/society/society_map_millat-town-iii-chak-no-196rb_8840_17072023102534.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Orchard Homes Chak No. 239/RB','FDA list: Approved; 387 plots','61aae290-9e15-5282-929f-6b50908ea9ec','https://fda.gov.pk/uploads/society/society_map_orchard-homes-chak-no-239rb_3805_13072023035551.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Johar Town, Chak No. 243/RB, Faisalabad','FDA list: Approved; 241 plots','78ec063f-4455-5b8d-80f8-d0e8a214b1ee','https://fda.gov.pk/uploads/society/society_map_johar-town-chak-no-243rb-faisalabad_9959_14112024030727.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Haider Valley Chak No. 225/RB Faisalabad','FDA list: Approved; 372 plots','995e19a8-10d8-5880-af19-1023202e63b0','https://fda.gov.pk/uploads/society/society_map_haider-valley-chak-no-225rb-faisalabad_4771_14112024030913.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Gulshan-e-Hayat Chak No.220/RB','FDA list: Approved; 385 plots','ffe7a1a3-d938-5a2a-a3d6-7904366a5e17','https://fda.gov.pk/uploads/society/society_map_gulshan-e-hayat-chak-no-220rb_1239_13072023030638.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Alpha Housing Chak No. 296/RB','FDA list: Approved; 407 plots','d2218b01-7045-564b-94fc-233a31497a47','https://fda.gov.pk/uploads/society/Eden_Life_Alpha_Housing.PDF','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Bilal City Chak No. 197/RB','FDA list: Approved; 161 plots','10e27c82-8584-5d08-b2ca-2f470a620f8e','https://fda.gov.pk/uploads/society/society_map_bilal-city-chak-no-197rb_4916_13072023040138.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Khayaban e Manzoor Chak No. 209/RB Faisalabad','FDA list: Approved; 450 plots','899dba22-a23e-552d-b778-ea311cf2acd7','https://fda.gov.pk/uploads/society/society_map_khayaban-e-manzoor-chak-no-209rb-faisalabad_2754_17072023104308.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Safeena Town Chak No.200/RB','FDA list: Approved','76ad473b-47cf-5c94-837c-a824529da5ef','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Sultan Town Chak No.217/RB','FDA list: Approved; 374 plots','ea5300fa-d784-5b45-bef6-8fcdce3ddf18','https://fda.gov.pk/uploads/society/society_map_sultan-town-chak-no-217rb_6059_13072023025608.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Salma Town Chak No.224/RB','FDA list: Approved; 100 plots','b556022e-f7e4-5dd0-9748-d5cdc5b77396','https://fda.gov.pk/uploads/society/society_map_salma-town-chak-no-224rb_3001_13072023025334.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('SMD City Chak No. 196/RB, 202/RB Faisalabad','FDA list: Approved; 1183 plots','93e4ddbb-07e9-597a-8518-097f82de356b','https://fda.gov.pk/uploads/society/society_map_smd-city-chak-no-196rb-202rb-faisalabad_6397_14112024031026.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Palm Villas Chak No. 217/RB','FDA list: Approved; 178 plots','67daa579-8cab-517f-b2ec-9c1e9748446e','https://fda.gov.pk/uploads/society/society_map_palm-villas-chak-no-217rb_1318_17072023101252.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Millat Colony Chak Chak No.223/RB','FDA list: Approved','489f955e-a5ca-5568-8c69-a18a51a5b820','https://fda.gov.pk/schemes_private','FDA approved private housing schemes list, fda.gov.pk/schemes_private, read 2026-10-30'),
('Jawad Town, Chak No. 223/RB, Faisalabad','FDA list: Approved; 517 plots','b4061eba-1b85-5e04-a1cd-afbfa35dcc21','https://fda.gov.pk/uploads/society/society_map_jawad-town-chak-no-223rb-faisalabad_9077_14112024031312.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('GULBERG VILLAS Chak No. 219/RB Faisalabad','FDA list: Approved; 235 plots','92d94612-c024-5385-b34e-e60b373d3fbb','https://fda.gov.pk/uploads/society/society_map_gulberg-villas-chak-no-219rb-faisalabad_1144_14112024031053.pdf','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Amin Town Chak No. 207/RB','FDA list: Approved; 974 plots','e608b0b0-9fa5-5abc-9b11-d097e8a41497','https://fda.gov.pk/uploads/society/society_map_amin-town-chak-no-207rb_2421_13072023025653.JPG','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30'),
('Eden Garden Phase-II Chak No. 208/RB','FDA list: Approved; 476 plots','ab4b9468-5469-56d2-93fb-6f1daff4c175','https://fda.gov.pk/uploads/society/society_map_eden-garden-phase-ii-chak-no-208rb_5149_13072023033509.jpg','FDA approved scheme map, published at fda.gov.pk/schemes_private, read 2026-10-30')
), t AS (
SELECT s.id AS sid, v.claim, v.eid::uuid AS eid, v.url, v.src FROM v JOIN property_intelligence.societies s ON s.city = 'Faisalabad' AND lower(regexp_replace(s.name,'[^a-zA-Z0-9]','','g')) = lower(regexp_replace(v.name,'[^a-zA-Z0-9]','','g'))
WHERE NOT EXISTS (SELECT 1 FROM trust.verifications x WHERE x.subject_type = 'SOCIETY' AND x.subject_id = s.id AND x.claim_type = 'NOC')
), ev AS (
INSERT INTO trust.evidence (id, type, file_ref, source_ref, document_type, record_type)
SELECT eid, 'document', url, src, 'OTHER', 'FACT' FROM t
ON CONFLICT (id) DO NOTHING
RETURNING id
)
INSERT INTO trust.verifications (id, subject_type, subject_id, claim, claim_type, status, evidence_refs)
SELECT gen_random_uuid(), 'SOCIETY', sid, claim, 'NOC', 'PENDING', ARRAY[eid::text] FROM t;
