/* Service Worker. Wird beim Build zu dist/sw.js; die Platzhalter in den beiden Konstanten unten ersetzt das Build-Plugin. */
const VERSION = '__VERSION__';
const CACHE = `magic-sort-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  const scope = self.registration.scope;
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((f) => new URL(f, scope).toString()))),
  );
  // Absichtlich kein skipWaiting(): eine neue Version wird erst beim nächsten Start der App aktiv,
  // damit eine laufende Sitzung nie Dateien aus zwei Versionen mischt.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('magic-sort-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === 'navigate') {
          const shell = (await cache.match(new URL('index.html', self.registration.scope).toString())) || (await cache.match(new URL('./', self.registration.scope).toString()));
          if (shell) return shell;
        }
        throw err;
      }
    }),
  );
});
