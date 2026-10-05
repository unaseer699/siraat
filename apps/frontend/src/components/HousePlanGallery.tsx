'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Lock, ImageOff } from 'lucide-react';
import { fetchHousePlanImages, fetchHousePlanImageFileUrl, type HousePlanImage } from '@/lib/api';
import { HOUSE_PLAN_IMAGE_TYPE_OPTIONS } from '@/lib/housePlanImageTypes';
import { RADIUS } from '@/styles/tokens';

function typeLabel(value: string): string {
  return HOUSE_PLAN_IMAGE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatPrice(price: number): string {
  return price > 0 ? `Rs. ${price.toLocaleString('en-PK')}` : 'Free';
}

// HOUSE PLAN GALLERY — elevations + 3D render, shown below the floor-plan
// cover image on the profile page. Every tile carries a price tag (Step 0
// "no bait and switch" rule), free or gated. A GATED tile never resolves a
// file URL — the backend refuses that (403) until an unlock flow exists —
// so it always renders as a locked placeholder with its type and price;
// there is nothing to click yet.
function GalleryTile({ housePlanId, image }: { housePlanId: string; image: HousePlanImage }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const unlockable = image.access_tier === 'FREE' && image.has_file;

  useEffect(() => {
    if (!unlockable) return;
    let cancelled = false;
    fetchHousePlanImageFileUrl(housePlanId, image.id)
      .then((res) => {
        if (!cancelled) setUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [housePlanId, image.id, unlockable]);

  const tileStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    background: '#f3f4f6',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  };

  const showImage = unlockable && url && !failed;

  return (
    <div style={tileStyle}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL, not a static asset next/image can optimize
        <img src={url} alt={typeLabel(image.image_type)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          {image.access_tier === 'GATED' ? (
            <Lock size={22} color="var(--muted)" aria-hidden="true" />
          ) : (
            <ImageOff size={22} color="var(--muted)" aria-hidden="true" />
          )}
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
            {typeLabel(image.image_type)}
          </span>
        </>
      )}
      <span
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          padding: '3px 8px',
          borderRadius: '999px',
          fontSize: '11px',
          fontWeight: 700,
          background: showImage ? 'rgba(0,0,0,0.6)' : '#111',
          color: '#fff',
        }}
      >
        {formatPrice(image.price)}
      </span>
      {!showImage && (
        <span
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          {typeLabel(image.image_type)}
        </span>
      )}
    </div>
  );
}

export function HousePlanGallery({ housePlanId }: { housePlanId: string }) {
  const [images, setImages] = useState<HousePlanImage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHousePlanImages(housePlanId)
      .then((res) => {
        if (!cancelled) setImages(res.images);
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [housePlanId]);

  if (!images || images.length === 0) return null;

  return (
    <div>
      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginBottom: '10px' }}>
        ELEVATIONS &amp; 3D VIEWS
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
        {images.map((img) => (
          <GalleryTile key={img.id} housePlanId={housePlanId} image={img} />
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
        Locked images are real renders from the plan&apos;s architect — contact us on WhatsApp to unlock.
      </p>
    </div>
  );
}
