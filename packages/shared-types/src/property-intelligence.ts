export interface SocietySummary {
  id: string;
  name: string;
  city: string;
  noc_approved: boolean;
}

export interface PropertyDetail {
  id: string;
  society_id: string;
  society: SocietySummary | null;
  owner_ref: string | null;
  address: string;
  price: number;
  listing_source: string;
  status: 'LISTED' | 'ACTIVE' | 'ARCHIVED';
  property_type: string;
  area_marla: number;
}

export interface DeveloperProfile {
  id: string;
  name: string;
  project_history: string[];
  is_siraat_affiliated: boolean;
}
