// Projects published by official regulators. Reference only: Siraat has NOT yet
// reviewed these unless siraatReview is REVIEWED. Every entry cites its
// official source, and buyers verify it themselves. Add new entries only from an official page.
export interface NewProject {
  name: string;
  place: string;
  region: string;
  kind: 'Private scheme' | 'Government';
  authority: string;
  areaKanal: number;
  affordablePlots: number;
  apartments?: number;
  plotSizes: string;
  status: string;
  caution?: string;
  // REVIEWED only after Siraat has completed its own checks on the project.
  siraatReview: 'REVIEWED' | 'NOT_REVIEWED';
  sourceUrl: string;
  listedAsOf: string;
}

const PHATA_URL = 'https://phata.punjab.gov.pk/affordable-private-housing-schemes';
const base = { kind: 'Private scheme' as const, authority: 'PHATA', status: 'Form-F issued', siraatReview: 'NOT_REVIEWED' as const, sourceUrl: PHATA_URL, listedAsOf: '2026-10-30' };

export const NEW_PROJECTS: NewProject[] = [
  { ...base, name: 'National Aerospace City', place: 'Pind Suleman Makkan, Attock', region: 'Rawalpindi region', areaKanal: 7440.42, affordablePlots: 2060, apartments: 17, plotSizes: '4.13 – 4.98 marla' },
  { ...base, name: 'New City Paradise', place: 'Hasan Abdal, Attock', region: 'Rawalpindi region', areaKanal: 4251.4, affordablePlots: 1232, plotSizes: '3.01 – 4.59 marla' },
  { ...base, name: 'Nova City Housing Scheme', place: 'Fateh Jang, Attock', region: 'Rawalpindi region', areaKanal: 970.49, affordablePlots: 550, plotSizes: '2.87 – 4.59 marla' },
  { ...base, name: 'Tariq Sharif Smart City', place: 'Gujar Khan, Rawalpindi', region: 'Rawalpindi region', areaKanal: 746.1, affordablePlots: 231, plotSizes: '2.8 – 4.5 marla' },
  { ...base, name: 'Akbar Housing Scheme', place: 'GT Road, Attock', region: 'Rawalpindi region', areaKanal: 351.8, affordablePlots: 204, apartments: 150, plotSizes: '3.5 marla' },
  { ...base, name: 'Campbellpur Green', place: 'Hazro, Attock', region: 'Rawalpindi region', areaKanal: 405.7, affordablePlots: 178, plotSizes: '3.23 – 4.5 marla' },
  { ...base, name: 'Royal Garden Housing Scheme', place: 'Kharian, Gujrat', region: 'Rawalpindi region', areaKanal: 237.18, affordablePlots: 159, plotSizes: '3 – 4.13 marla' },
  { ...base, name: 'Garden Square Villas', place: 'Eminabad, Gujranwala', region: 'Lahore region', areaKanal: 134.9, affordablePlots: 103, plotSizes: '2.49 marla' },
  { ...base, name: 'Safia Homes', place: 'Budhla Sant Road, Multan', region: 'Multan region', areaKanal: 143, affordablePlots: 97, plotSizes: '3 marla', caution: "MDA's illegal list also names a \"Safia Homes Housing Scheme\" on Budhla Sant Road. Confirm with MDA and PHATA before buying." },
  { ...base, name: 'Kingdom Valley', place: 'Chakri interchange, Rawalpindi', region: 'Rawalpindi region', areaKanal: 103, affordablePlots: 48, plotSizes: '3.5 – 5 marla' },
  { ...base, name: 'Green Wood Housing Scheme', place: 'Mari Jabbar Road, Rawalpindi', region: 'Rawalpindi region', areaKanal: 156, affordablePlots: 64, plotSizes: '4.59 marla' },
];

// Official pages where new or approved projects are published. Links only.
export interface ProjectSource {
  short: string;
  name: string;
  covers: string;
  url: string;
}

export const PROJECT_SOURCES: ProjectSource[] = [
  { short: 'PHATA', name: 'Punjab Housing and Town Planning Agency', covers: 'Affordable private schemes across Punjab', url: 'https://phata.punjab.gov.pk/schemes' },
  { short: 'CDA', name: 'Capital Development Authority', covers: 'Islamabad', url: 'https://www.cda.gov.pk/' },
  { short: 'RDA', name: 'Rawalpindi Development Authority', covers: 'Rawalpindi', url: 'https://rda.gop.pk/' },
  { short: 'LDA', name: 'Lahore Development Authority', covers: 'Lahore: approved private schemes', url: 'https://lda.gop.pk/approved-schemes' },
  { short: 'FDA', name: 'Faisalabad Development Authority', covers: 'Faisalabad: private schemes', url: 'https://fda.gov.pk/schemes_private' },
  { short: 'MDA', name: 'Multan Development Authority', covers: 'Multan: private housing and land sub-divisions', url: 'https://mda.punjab.gov.pk/private-housing-and-land-sub-division' },
  { short: 'PDA', name: 'Peshawar Development Authority', covers: 'Peshawar', url: 'https://pda.kp.gov.pk/' },
];
