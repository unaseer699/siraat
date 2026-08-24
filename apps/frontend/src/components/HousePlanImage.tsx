'use client';

import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { fetchHousePlanImageUrl } from '@/lib/api';
import { RADIUS } from '@/styles/tokens';

// HOUSE PLANS DIRECTORY Chunk 2 — house_plans.preview_image_ref is a private
// bucket-relative storage key, never a directly-servable URL, so this fetches
// a short-lived presigned URL client-side (same reasoning as fetchEvidenceDownloadUrl
// elsewhere). `hasImage` is a plain prop, not derived here, because the caller
// already knows preview_image_ref off the summary it fetched and this
// component has no need for the raw key itself. Shared between the catalog
// grid (house-plans/page.tsx) and the profile page (house-plan/[id]/page.tsx)
// so the "no image yet" placeholder stays visually identical in both places.
export function HousePlanImage({
  housePlanId,
  hasImage,
  alt,
  aspectRatio = '4 / 3',
}: {
  housePlanId: string;
  hasImage: boolean;
  alt: string;
  aspectRatio?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasImage) return;
    let cancelled = false;
    fetchHousePlanImageUrl(housePlanId)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [housePlanId, hasImage]);

  const showPlaceholder = !hasImage || failed || !url;

  return (
    <div
      style={{
        width: '100%',
        aspectRatio,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {showPlaceholder ? (
        <Home size={32} color="var(--muted)" aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL, not a static asset next/image can optimize
        <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  );
}
