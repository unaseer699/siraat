import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationDetail,
  VerificationResponse,
  PropertyDetail,
  DeveloperProfile,
} from '@siraat/shared-types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer anonymous',
      'X-Siraat-Country-Code': 'PK',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchRecommendations(
  req: RecommendationRequest,
): Promise<RecommendationResponse> {
  return apiFetch('/v1/market-intelligence/recommendations', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function fetchRecommendationDetail(id: string): Promise<RecommendationDetail> {
  return apiFetch(`/v1/market-intelligence/recommendations/${id}`);
}

export async function fetchSocietyNocStatus(societyId: string): Promise<VerificationResponse> {
  return apiFetch(`/v1/trust/societies/${societyId}/noc-status`);
}

export async function fetchDeveloperVerification(developerId: string): Promise<VerificationResponse> {
  return apiFetch(`/v1/trust/developers/${developerId}/verification`);
}

export async function fetchPropertyDetail(propertyId: string): Promise<PropertyDetail> {
  return apiFetch(`/v1/property-intelligence/properties/${propertyId}`);
}
