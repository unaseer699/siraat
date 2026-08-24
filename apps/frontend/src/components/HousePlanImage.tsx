'use client';

import { useEffect, useState, type CSSProperties } from 'react';
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
//
// Two layout modes, picked by which sizing prop the caller passes:
//   - `aspectRatio` (grid cards): fixed-shape tile, `object-fit: cover` crops
//     to fill it — correct for a uniform thumbnail grid.
//   - `maxHeight` (profile page): fixed-height box, `object-fit: contain`
//     shows the whole image letterboxed rather than cropping it — a real
//     house plan (often a tall floor-plan diagram) was being cut off at the
//     bottom under the cover/aspect-ratio treatment.
export function HousePlanImage({
  housePlanId,
  hasImage,
  alt,
  aspectRatio = '4 / 3',
  maxHeight,
}: {
  housePlanId: string;
  hasImage: boolean;
  alt: string;
  aspectRatio?: string;
  maxHeight?: number;
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
  const fit: CSSProperties['objectFit'] = maxHeight ? 'contain' : 'cover';

  const containerStyle: CSSProperties = {
    width: '100%',
    ...(maxHeight ? { height: `${maxHeight}px` } : { aspectRatio }),
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    // Neutral surface color — doubles as the placeholder-icon background and,
    // in `contain` mode, fills the letterboxing gap around an image that
    // doesn't match the container's aspect ratio.
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      {showPlaceholder ? (
        <Home size={32} color="var(--muted)" aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL, not a static asset next/image can optimize
        <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: fit }} />
      )}
    </div>
  );
}
