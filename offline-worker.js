// Scoped offline copy. Climate requests are deliberately excluded: climate.js
// caches only validated, compact normals, never an error page or raw response.
const SCOPE = self.registration.scope;
const CACHE = `fly-with-me-offline-v1:${SCOPE}`;
const HOME = new URL('./', SCOPE).href;
function assetURL(value) {
  try {
    const url = new URL(value);
    return (url.href.startsWith(SCOPE) && /\.(?:js|css|woff2?)$/.test(url.pathname))
      || (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.startsWith('/npm/three@0.185.1/'));
  } catch { return false; }
}
async function remember(request, response, home = false) {
  if (response.ok && !response.redirected && response.type !== 'opaque') {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(home ? HOME : request, response.clone());
    } catch { /* unavailable or full storage must not break a successful online load */ }
  }
  return response;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try { await remember(HOME, await fetch(HOME, { cache: 'reload' }), true); } catch { /* an existing copy remains useful */ }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const home = request.mode === 'navigate' && request.url.startsWith(SCOPE);
  if (!home && !assetURL(request.url)) return;
  event.respondWith((async () => {
    try { return await remember(request, await fetch(request), home); }
    catch {
      const cached = await caches.open(CACHE).then(cache => cache.match(home ? HOME : request)).catch(() => null);
      return cached ?? Response.error();
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'cache-flight' || !event.source?.url?.startsWith(SCOPE)) return;
  const urls = [...new Set(Array.isArray(event.data.urls) ? event.data.urls.filter(assetURL) : [])].slice(0, 120);
  event.waitUntil((async () => {
    let failed = 0;
    for (let i = 0; i < urls.length; i += 4) {
      await Promise.all(urls.slice(i, i + 4).map(async url => {
        try {
          const response = await fetch(url);
          if (!response.ok || response.type === 'opaque') throw new Error('Asset unavailable');
          await remember(url, response);
          if (!await (await caches.open(CACHE)).match(url)) throw new Error('Asset not cached');
        } catch { failed++; }
      }));
    }
    const cachedHome = await caches.open(CACHE).then(cache => cache.match(HOME)).catch(() => null);
    event.source.postMessage({ type: 'flight-cached', ready: failed === 0 && Boolean(cachedHome) && urls.length > 0 });
  })());
});
