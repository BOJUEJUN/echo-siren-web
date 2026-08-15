// ECHO-SIREN 国内加速 Service Worker
// - index.wasm：从 jsDelivr 拉 gzip 包，在 SW 里解压成标准 wasm 再交给引擎
// - index.pck：直接走 jsDelivr CDN（国内比 GitHub 快）
const CDN_HOSTS = ['https://fastly.jsdelivr.net', 'https://cdn.jsdelivr.net'];
const CDN_PATH = '/gh/BOJUEJUN/echo-siren-web@gh-pages';
const CACHE = 'echo-siren-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cdnFetch(path, hostOrder) {
  let lastError;
  for (const host of hostOrder) {
    try {
      const response = await fetch(host + CDN_PATH + path);
      if (!response.ok) throw new Error('CDN status ' + response.status);
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('CDN fetch failed');
}

async function cachedWasm() {
  const cache = await caches.open(CACHE);
  const cached = await cache.match('wasm');
  if (cached) return cached;

  const gz = await cdnFetch('/index.wasm.gz', CDN_HOSTS);
  const decompressed = gz.body.pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(decompressed, {
    status: 200,
    headers: {
      'Content-Type': 'application/wasm',
      'Cache-Control': 'max-age=31536000',
    },
  });
  await cache.put('wasm', response.clone());
  return response;
}

async function cachedPck() {
  const cache = await caches.open(CACHE);
  const cached = await cache.match('pck');
  if (cached) return cached;
  const fetched = await cdnFetch('/index.pck', ['https://cdn.jsdelivr.net', 'https://fastly.jsdelivr.net']);
  const response = new Response(fetched.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'max-age=31536000',
    },
  });
  await cache.put('pck', response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/index.wasm')) {
    event.respondWith(cachedWasm());
  } else if (url.pathname.endsWith('/index.pck')) {
    event.respondWith(cachedPck());
  }
});
