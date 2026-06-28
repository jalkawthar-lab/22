const CACHE_NAME = 'admin-panel-v7-force-update';

// 1. Install and instantly take over the browser
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 2. Activate and wipe out EVERY old cache from the previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[Service Worker] Wiping old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Network-Only strategy: Always fetch the freshest files from the server
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
