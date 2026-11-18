// Offline support. The page itself is fetched network-first so a new build
// shows up on the next visit; everything else (hashed assets, icons) is
// immutable and served cache-first.
const CACHE = 'yarntrace-v1';
// Hosts often add `Vary: Origin` or `Vary: Accept-Encoding`; for our own static
// files the URL alone identifies the response, so lookups ignore it.
const LOOKUP = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('./', { cache: 'no-cache' });
      await cache.put('./', page.clone());
      // The first visit loads its assets before this worker is in control, so
      // read them out of the page and cache them now: offline works right away.
      const html = await page.text();
      const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(request);
          if (fresh.ok) await cache.put('./', fresh.clone());
          return fresh;
        } catch {
          return (await cache.match('./', LOOKUP)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, LOOKUP);
      if (hit) return hit;
      const fresh = await fetch(request);
      if (fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    })(),
  );
});
