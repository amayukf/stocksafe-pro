const CACHE_NAME = 'stocksafe-v3';
const urlsToCache = [
    './',
    './index.html',
    './add-product.html',
    './sell.html',
    './sales-history.html',
    './low-stock.html',
    './settings.html',
    './css/style.css',
    './js/db.js',
    './js/app.js',
    './js/sync.js',
    './js/scanner.js',
    './js/export.js',
    './js/receipt.js',
    './libs/dexie.min.js',
    './libs/quagga.min.js',
    './libs/jspdf.min.js',
    './libs/jspdf-autotable.min.js',
    './libs/chart.min.js',
    './manifest.json',
    './icon-512.png'
];

// Service Worker Installation & Asset Caching
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching offline application assets...');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('[Service Worker] Cache install failed:', err))
    );
});

// Service Worker Activation & Cache Cleanup
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('[Service Worker] Removing legacy cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Cache First Strategy with Network Fallback
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached asset immediately
                    return cachedResponse;
                }
                // Try network if not cached
                return fetch(event.request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline navigation fallback
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});
