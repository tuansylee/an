const CACHE = 'fam-v1';
const urlsToCache = ['./', './index.html', './manifest.webmanifest', './sw.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  try {
    if (event.request.mode === 'navigate') {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            caches.open(CACHE).then((cache) => {
              cache.put(event.request, response.clone());
            });
            return response;
          })
          .catch(() => caches.match('./index.html'))
      );
    } else {
      event.respondWith(
        caches.match(event.request)
          .then((response) => {
            if (response) return response;
            return fetch(event.request)
              .then((response) => {
                if (response.ok && event.request.method === 'GET') {
                  caches.open(CACHE).then((cache) => {
                    cache.put(event.request, response.clone());
                  });
                }
                return response;
              });
          })
          .catch(() => new Response('Offline', { status: 503 }))
      );
    }
  } catch (error) {
    return new Response('Error', { status: 500 });
  }
});
