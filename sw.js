const CACHE_NAME = 'admin-panel-v8-force-update';

// تخطي الانتظار وتفعيل نفسه فوراً
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// تدمير أي كاش قديم
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

// الاعتماد كلياً على الشبكة لضمان جلب التحديثات فوراً
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
