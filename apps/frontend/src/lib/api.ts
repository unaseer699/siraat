import type { RecommendationRequest, RecommendationResponse } from '@siraat/shared-types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function fetchRecommendations(
  req: RecommendationRequest,
): Promise<RecommendationResponse> {
  const res = await fetch(`${BASE_URL}/v1/market-intelligence/recommendations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer anonymous',
      'X-Siraat-Country-Code': 'PK',
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<RecommendationResponse>;
}
