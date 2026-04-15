/**
 * sw.js — Ghrava Service Worker
 * Network-first strategy: always try network, cache static assets as fallback.
 */
const CACHE = 'ghrava-v1';
const STATIC = ['/shared.css', '/theme.js', '/nav.js', '/offline.html',
  '/js/lt-core.js', '/js/lt-messages.js', '/js/global-search.js',
  '/js/keyboard-shortcuts.js', '/js/quick-capture.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // API calls: network only, return offline JSON on failure
  if (request.url.includes('/api/v1/')) {
    e.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }
  // Static assets: network first, cache fallback
  e.respondWith(
    fetch(request)
      .then(r => {
        if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(request, c)); }
        return r;
      })
      .catch(() => caches.match(request).then(r => r || caches.match('/offline.html')))
  );
});
