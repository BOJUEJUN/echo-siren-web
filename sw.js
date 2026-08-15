// ECHO-SIREN 国内加速 Service Worker
// wasm/js 从 jsDelivr CDN 拉取 gzip 版本，pck 走 CDN 原始文件。
const CDN_HOSTS = ['https://fastly.jsdelivr.net', 'https://cdn.jsdelivr.net'];
const CDN_PATH = '/gh/BOJUEJUN/echo-siren-web@gh-pages';
const CACHE = 'echo-siren-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function fromCacheOrFetch(cacheKey, path, makeResponse, hostOrder = CDN_HOSTS) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  let lastError;
  for (const host of hostOrder) {
    try {
      const fetched = await fetch(host + CDN_PATH + path);
      if (!fetched.ok) throw new Error('CDN fetch failed: ' + fetched.status);
      const response = makeResponse(fetched);
      await cache.put(cacheKey, response.clone());
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('CDN fetch failed');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/index.wasm')) {
    event.respondWith(fromCacheOrFetch(
      'wasm-gz',
      '/index.wasm.gz',
      (fetched) => new Response(fetched.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/wasm',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'max-age=31536000',
        },
      }),
    ));
  } else if (url.pathname.endsWith('/index.js')) {
    event.respondWith(fromCacheOrFetch(
      'js-gz',
      '/index.js.gz',
      (fetched) => new Response(fetched.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'max-age=31536000',
        },
      }),
    ));
  } else if (url.pathname.endsWith('/index.pck')) {
    event.respondWith(fromCacheOrFetch(
      'pck',
      '/index.pck',
      (fetched) => new Response(fetched.body, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'max-age=31536000',
        },
      }),
      ['https://cdn.jsdelivr.net', 'https://fastly.jsdelivr.net'],
    ));
  }
});
