/* Gridlock service worker — makes the game installable and offline-capable.
   Strategy:
   - Precache the app shell (same-origin HTML, manifest, icons) on install.
   - Navigations: network-first, falling back to the cached shell when offline.
   - Other GETs (the React/Babel/Firebase CDN bundles, fonts, etc.):
     stale-while-revalidate, so a second visit works without a network.
   - Firebase Realtime Database traffic is always passed straight through —
     it must never be served from cache. */

const VERSION = 'gridlock-v1';
const SHELL_CACHE = VERSION + '-shell';
const RUNTIME_CACHE = VERSION + '-runtime';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Hosts whose responses must always come from the network (live game data).
function isLiveData(url) {
  return /firebaseio\.com$/.test(url.hostname) ||
         /\.firebaseio\.com$/.test(url.hostname) ||
         /googleapis\.com$/.test(url.hostname) && url.pathname.indexOf('/identitytoolkit') !== -1;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isLiveData(url)) return; // let the network handle realtime DB traffic

  // Navigation requests: try the network, fall back to the cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Everything else: stale-while-revalidate from the runtime cache.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
