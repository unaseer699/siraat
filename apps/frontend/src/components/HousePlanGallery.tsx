'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Lock, ImageOff, FileText, X, ExternalLink } from 'lucide-react';
import { fetchHousePlanImages, fetchHousePlanImageFileUrl, type HousePlanImage } from '@/lib/api';
import { HOUSE_PLAN_IMAGE_TYPE_OPTIONS } from '@/lib/housePlanImageTypes';
import { RADIUS, TRUST_GREEN } from '@/styles/tokens';

function typeLabel(value: string): string {
  return HOUSE_PLAN_IMAGE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function formatPrice(price: number): string {
  return price > 0 ? `Rs. ${price.toLocaleString('en-PK')}` : 'Free';
}

// wa.me links need a bare digit string — no "+", spaces, or dashes. Same
// helper as house-plan/[id]/page.tsx (and supplier/contractor profile pages).
function toWaMeNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// HOUSE PLAN GALLERY — elevations + 3D render, shown below the floor-plan
// cover image on the profile page. Every tile carries a price tag (Step 0
// "no bait and switch" rule), free or gated. A GATED tile never resolves a
// file URL — the backend refuses that (403) until an unlock flow exists —
// so clicking one opens a message pointing at the WhatsApp unlock path
// instead of an image. A FREE tile with a file opens a simple lightbox for
// a closer look.
function GalleryTile({
  housePlanId,
  image,
  onOpenImage,
  onOpenLocked,
}: {
  housePlanId: string;
  image: HousePlanImage;
  onOpenImage: (url: string, label: string, isPdf: boolean) => void;
  onOpenLocked: (image: HousePlanImage) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isPdf = image.content_type === 'application/pdf';
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

  // A PDF (common for a 3D-render walkthrough with several camera angles in
  // one file) never renders as the tile thumbnail — <img> can't show it —
  // but it's still "unlockable": the tile opens it in the PDF viewer below.
  const showImage = unlockable && url && !failed && !isPdf;
  const showPdfTile = unlockable && url && !failed && isPdf;
  const clickable = showImage || showPdfTile || image.access_tier === 'GATED';

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
    border: 'none',
    padding: 0,
    cursor: clickable ? 'pointer' : 'default',
    font: 'inherit',
    textAlign: 'center',
  };

  function handleClick() {
    if ((showImage || showPdfTile) && url) {
      onOpenImage(url, typeLabel(image.image_type), isPdf);
    } else if (image.access_tier === 'GATED') {
      onOpenLocked(image);
    }
  }

  // UI REVIEW finding — this button's accessible name previously depended
  // on which branch rendered (the <img alt> in the image case, a visible
  // text span in the others), which is fragile rather than deliberate.
  // An explicit aria-label makes the intent (open vs. locked vs.
  // unavailable) unambiguous for every branch.
  const ariaLabel =
    showImage || showPdfTile
      ? `View ${typeLabel(image.image_type)}${isPdf ? ' (PDF)' : ''}`
      : image.access_tier === 'GATED'
        ? `${typeLabel(image.image_type)} — locked, unlock to view`
        : `${typeLabel(image.image_type)} — image unavailable`;

  return (
    <button type="button" onClick={handleClick} disabled={!clickable} style={tileStyle} aria-label={ariaLabel}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL, not a static asset next/image can optimize
        <img src={url} alt={typeLabel(image.image_type)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          {image.access_tier === 'GATED' ? (
            <Lock size={22} color="var(--muted)" aria-hidden="true" />
          ) : showPdfTile ? (
            <FileText size={22} color="var(--muted)" aria-hidden="true" />
          ) : (
            <ImageOff size={22} color="var(--muted)" aria-hidden="true" />
          )}
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
            {typeLabel(image.image_type)}
          </span>
          {showPdfTile && (
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Tap to view</span>
          )}
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
    </button>
  );
}

// Fullscreen viewer for a FREE image or PDF — tap/click the backdrop or the
// X to close. An image gets the plain lightbox treatment (no zoom/pan, just
// a bigger look); a PDF (a multi-page 3D-render walkthrough, say) gets an
// embedded viewer so it can be scrolled/paged through right here, plus an
// "Open in new tab" fallback since in-iframe PDF rendering is inconsistent
// on mobile browsers.
function Lightbox({
  url,
  label,
  isPdf,
  onClose,
}: {
  url: string;
  label: string;
  isPdf: boolean;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'rgba(255,255,255,0.15)',
          border: 'none',
          borderRadius: '999px',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <X size={20} color="#fff" />
      </button>
      {isPdf ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          <iframe
            src={url}
            title={label}
            style={{ width: '100%', flex: 1, border: 'none', borderRadius: RADIUS.md, background: '#fff' }}
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ExternalLink size={14} /> Open in new tab
          </a>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL
        <img
          src={url}
          alt={label}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: RADIUS.md, objectFit: 'contain' }}
        />
      )}
      <p style={{ color: '#fff', fontSize: '13px', fontWeight: 600, marginTop: '12px' }}>{label}</p>
    </div>
  );
}

// Message shown when a GATED tile is tapped — explains why it's locked and
// hands off to WhatsApp, same unlock path as the page's main CTA, with a
// message naming which image was requested.
function LockedImageModal({
  image,
  planTitle,
  contactWhatsapp,
  onClose,
}: {
  image: HousePlanImage;
  planTitle: string;
  contactWhatsapp: string;
  onClose: () => void;
}) {
  const message = `Hi, I'd like to unlock the ${typeLabel(image.image_type)} (${formatPrice(image.price)}) for the "${planTitle}" house plan on Siraat.`;
  const whatsappHref = `https://wa.me/${toWaMeNumber(contactWhatsapp)}?text=${encodeURIComponent(message)}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 'var(--radius)',
          padding: '24px',
          maxWidth: '360px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          textAlign: 'center',
        }}
      >
        <Lock size={28} color="var(--muted)" style={{ margin: '0 auto' }} aria-hidden="true" />
        <div>
          <p style={{ fontSize: '15px', fontWeight: 700 }}>{typeLabel(image.image_type)} is locked</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
            This is a real render from the plan&apos;s architect, priced at {formatPrice(image.price)}. Contact us on
            WhatsApp to unlock it.
          </p>
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            background: TRUST_GREEN,
            color: '#fff',
            borderRadius: 'var(--radius)',
            fontSize: '14px',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Contact us on WhatsApp →
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontWeight: 600,
            // MOBILE REVIEW finding — plain text with no padding was a thin
            // horizontal tap strip, under the ~32px touch-target guideline.
            padding: '10px 14px',
            margin: '-10px -14px',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function HousePlanGallery({
  housePlanId,
  planTitle,
  contactWhatsapp,
}: {
  housePlanId: string;
  planTitle: string;
  contactWhatsapp: string;
}) {
  const [images, setImages] = useState<HousePlanImage[] | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string; isPdf: boolean } | null>(null);
  const [lockedImage, setLockedImage] = useState<HousePlanImage | null>(null);

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
          <GalleryTile
            key={img.id}
            housePlanId={housePlanId}
            image={img}
            onOpenImage={(url, label, isPdf) => setLightbox({ url, label, isPdf })}
            onOpenLocked={setLockedImage}
          />
        ))}
      </div>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
        Locked images are real renders from the plan&apos;s architect — contact us on WhatsApp to unlock.
      </p>

      {lightbox && (
        <Lightbox url={lightbox.url} label={lightbox.label} isPdf={lightbox.isPdf} onClose={() => setLightbox(null)} />
      )}
      {lockedImage && (
        <LockedImageModal
          image={lockedImage}
          planTitle={planTitle}
          contactWhatsapp={contactWhatsapp}
          onClose={() => setLockedImage(null)}
        />
      )}
    </div>
  );
}
