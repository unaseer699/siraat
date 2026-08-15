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

// Overall claim-derived status for Browse Societies — distinct from the per-claim
// VERIFIED | DISPUTED | PENDING status stored on a single Verification record.
export type SocietyVerificationStatus = 'VERIFIED' | 'PARTIAL' | 'PENDING' | 'DISPUTED';

export interface SocietyBrowseSummary {
  id: string;
  name: string;
  city: string;
  price_range: { min: number | null; max: number | null };
  area_range: { min: number | null; max: number | null };
  property_types: string[];
  verification_status: SocietyVerificationStatus;
}

export interface SocietyListResponse {
  societies: SocietyBrowseSummary[];
  total_count: number;
  page: number;
  total_pages: number;
}
