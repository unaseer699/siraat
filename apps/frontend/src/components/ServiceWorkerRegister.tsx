'use client';

import { useEffect } from 'react';

// Registers the hand-rolled offline-shell worker (public/sw.js). A no-op
// component — renders nothing — mounted once from the root layout so every
// page picks up the registration without each page having to remember to.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failing (unsupported browser, blocked storage, etc.)
        // shouldn't break the app — the site works fine without it.
      });
    }
  }, []);

  return null;
}
