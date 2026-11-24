// Offline support for "Add to Home Screen".
//  - Same-origin files (html/js/css): network-first (updates show up right away online), cache as the offline fallback.
//  - three.js from the CDN: cache-first, since the URL is pinned to one version.
const CODE = 'zombie-defense-code-v6', LIB = 'zombie-defense-lib-v1';
const CORE = ['./', 'index.html', 'style.css', 'manifest.json', 'icons/icon-180.png', 'icons/icon-192.png',
  'src/main.js', 'src/util.js', 'src/state.js', 'src/defs.js', 'src/models.js', 'src/fences.js', 'src/heavy.js', 'src/audio.js', 'src/input.js', 'src/fx.js', 'src/world.js',
  'src/items.js', 'src/projectiles.js', 'src/player.js', 'src/zombies.js', 'src/buildings.js'];
const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(CODE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))),
    caches.open(LIB).then(c => c.add(THREE_URL).catch(() => {})),
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CODE && k !== LIB).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(fetch(req.url, { cache: 'no-cache' })
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CODE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
  } else if (url.href === THREE_URL) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(LIB).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
