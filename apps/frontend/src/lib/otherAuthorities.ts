// Authorities whose approved / unapproved scheme lists Siraat does not hold yet.
// Reference only: no scheme data and no claim about any scheme. A link is shown
// only for an official website the founder supplied; SBCA has none yet.
export interface OtherAuthority {
  short: string;
  name: string;
  area: string;
  url: string | null;
  note?: string;
}

export const OTHER_AUTHORITIES: OtherAuthority[] = [
  { short: 'PHATA', name: 'Punjab Housing and Town Planning Agency', area: 'Punjab (outside the development authorities)', url: 'https://phata.punjab.gov.pk/' },
  { short: 'MDA', name: 'Multan Development Authority', area: 'Multan', url: 'https://mda.punjab.gov.pk/private-housing-and-land-sub-division', note: 'We hold its approved list. Its illegal list is a scanned Urdu PDF on the official page; read it there.' },
  { short: 'KDA', name: 'Karachi Development Authority', area: 'Karachi', url: 'https://www.kda.gos.pk/' },
  { short: 'SBCA', name: 'Sindh Building Control Authority', area: 'Karachi and Sindh', url: null },
];
