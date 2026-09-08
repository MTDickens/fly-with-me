import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const scope = 'https://example.com/fly-with-me/', handlers = {}, copies = new Map();
let network = true, quota = false, ready;
const key = request => typeof request === 'string' ? request : request.url;
const cache = {
  async put(request, response) { if (quota) throw new Error('Quota exceeded'); copies.set(key(request), response.clone()); },
  async match(request) { return copies.get(key(request))?.clone(); },
};
vm.runInNewContext(await readFile(new URL('../offline-worker.js', import.meta.url), 'utf8'), {
  URL, Response, caches: { open: async () => cache },
  fetch: async request => { if (!network) throw new TypeError('Offline'); return new Response('network: ' + key(request)); },
  self: { registration: { scope }, addEventListener: (type, handler) => { handlers[type] = handler; },
    skipWaiting: async () => {}, clients: { claim: async () => {} } },
});
async function lifecycle(type) { let pending; handlers[type]({ waitUntil: promise => { pending = promise; } }); await pending; }
async function warm(urls) {
  let pending;
  handlers.message({ data: { type: 'cache-flight', urls }, source: { url: scope, postMessage: data => { ready = data.ready; } },
    waitUntil: promise => { pending = promise; } });
  await pending;
}
async function load(url, mode = 'cors') {
  let pending;
  handlers.fetch({ request: { url, method: 'GET', mode }, respondWith: promise => { pending = promise; } });
  return pending;
}
const three = 'https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.webgpu.js';
await lifecycle('install'); await lifecycle('activate');
await warm([three]); assert.equal(ready, true);
network = false;
assert.equal(await (await load(scope + '?seed=7', 'navigate')).text(), 'network: ' + scope);
assert.equal(await (await load(three)).text(), 'network: ' + three);
assert.equal(await load('https://archive-api.open-meteo.com/v1/archive?latitude=1'), undefined, 'climate bypasses the service worker');
network = true; quota = true;
const newAsset = scope + 'src/new.js';
assert.equal(await (await load(newAsset)).text(), 'network: ' + newAsset, 'full storage must not break online loading');
await warm([newAsset]); assert.equal(ready, false, 'offline readiness requires a stored asset');
await warm(['https://unrelated.example/private.js']); assert.equal(ready, false);
assert.equal(copies.size, 2, 'only the scoped home and pinned Three asset are stored');
console.log('Offline checks passed: project subpath, reload, CDN modules, quota failures and climate isolation.');
