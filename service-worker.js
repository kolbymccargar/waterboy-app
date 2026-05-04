/* ============================================================
   WATERBOY DELIVERY — SERVICE WORKER
   Cache-first for assets, network-first for HTML pages
   ============================================================ */

const CACHE_NAME   = 'waterboy-v1';
const STATIC_CACHE = 'waterboy-static-v1';
const DATA_CACHE   = 'waterboy-data-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/customer.html',
  '/driver.html',
  '/admin.html',
  '/manifest.json',
  '/css/global.css',
  '/css/customer.css',
  '/css/driver.css',
  '/css/admin.css',
  '/js/global.js',
  '/js/customer.js',
  '/js/driver.js',
  '/js/admin.js',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
];

// ── Install: pre-cache all shell assets ──────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // Cache what we can; skip assets that 404 (e.g. logo.png not yet added)
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => { /* skip missing assets */ })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DATA_CACHE)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategy by request type ─────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // HTML pages → network-first, fall back to cache
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CSS / JS / images / fonts → cache-first
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Ultimate fallback: return offline page skeleton
    return new Response(offlinePage(), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('', { status: 503 });
  }
}

function offlinePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Waterboy — Offline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #0A1628;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 16px;
      text-align: center;
      padding: 24px;
    }
    .drop {
      width: 64px; height: 64px;
      background: #00D4FF;
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      transform: rotate(-45deg);
      margin: 0 auto;
      box-shadow: 0 0 32px rgba(0,212,255,0.4);
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float { 0%,100%{transform:rotate(-45deg) translateY(0)}50%{transform:rotate(-45deg) translateY(-10px)} }
    h1 { font-size: 1.5rem; font-weight: 700; margin-top: 8px; }
    p  { color: rgba(255,255,255,0.5); font-size: .9375rem; max-width: 300px; line-height: 1.5; }
    button {
      margin-top: 8px;
      padding: 12px 28px;
      background: #00D4FF;
      color: #0A1628;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="drop"></div>
  <h1>You're Offline</h1>
  <p>No internet connection. Previously loaded pages are still available.</p>
  <button onclick="location.reload()">Try Again</button>
</body>
</html>`;
}

// ── Background sync placeholder ──────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    // Future: push queued orders when connection restored
  }
});

// ── Push notifications placeholder ──────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title   = data.title   ?? 'Waterboy Delivery';
  const options = {
    body: data.body ?? 'You have a new notification.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag ?? 'waterboy-notif',
    data: { url: data.url ?? '/customer.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/customer.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find(c => c.url.includes(url) && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
