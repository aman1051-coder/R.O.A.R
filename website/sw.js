// ROAR service worker: lets members install the site as an app and open it without a connection.
// Pages and files always come fresh from the network when online (so updates show at once);
// the last copy is kept only as an offline fallback. The database and photo storage are never cached.
const CACHE = 'roar-v1';
const CORE = ['./', './index.html', './styles.css', './favicon.svg', './js/layout.js', './js/theme.js', './js/config.js',
  './main.js', './shader.js', './assets/icons/icon-192.png', './404.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => { })).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$|cdn\.jsdelivr\.net$/.test(url.hostname)) return;   // never touch Supabase
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && (res.type === 'basic' || res.type === 'cors')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
      throw err;
    }
  })());
});
