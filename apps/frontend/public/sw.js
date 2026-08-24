// Minimal hand-rolled service worker — offline-shell caching only.
//
// Next.js doesn't ship PWA tooling out of the box, and this app's build emits
// content-hashed chunks under /_next/static that change every deploy, so a
// hand-rolled worker can't safely precache them by name (a plugin like
// next-pwa/workbox would be needed for that, and wasn't added here — flag
// this if full offline asset caching is wanted later). What this worker does
// instead: cache the app shell ('/', manifest, icons) so the site has
// something to show instead of the browser's default offline page, and
// otherwise stay out of the way — every other request (including all API
// calls to the backend origin) passes straight through to the network.
const SHELL_CACHE = 'siraat-shell-v1';
const SHELL_URLS = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests — everything else (backend API
  // calls on a different origin, POST/PUT submissions, etc.) is left alone.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    // Network-first for page navigations, falling back to the cached shell
    // ('/') when offline so the app still opens to something.
    event.respondWith(
      fetch(request).catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (SHELL_URLS.includes(new URL(request.url).pathname)) {
    // Cache-first for the small fixed set of shell assets.
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }
});
