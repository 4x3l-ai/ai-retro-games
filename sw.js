const CACHE_NAME = 'retro-arcade-v17';
const EMULATOR_CACHE = 'retro-arcade-emulator-v17';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './rom-index.json'
];

const EMULATOR_RESOURCES = [
  'https://cdn.emulatorjs.org/stable/data/loader.js',
  'https://cdn.emulatorjs.org/stable/data/emulator.js'
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch((err) => {
        console.log('Cache addAll failed, some resources may not be available:', err);
        return Promise.resolve();
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== EMULATOR_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Handle EmulatorJS CDN requests with cache-first strategy
  if (url.includes('cdn.emulatorjs.org')) {
    event.respondWith(
      caches.open(EMULATOR_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Return offline fallback if available
            return cache.match('/index.html');
          });
        });
      })
    );
    return;
  }

  // Handle app files with network-first strategy
  if (url.includes('.html') || url.includes('manifest.json')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Handle ROM file requests with cache-first
  if (url.includes('/ROM/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) return response;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Handle Google Fonts with cache-first strategy
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(EMULATOR_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return response || new Response('Font not available offline', { status: 404 });
          });
        });
      })
    );
    return;
  }

  // For all other requests, use network-first strategy with cache fallback
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const cache = caches.open(CACHE_NAME);
        cache.then((c) => c.put(event.request, networkResponse.clone()));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || new Response('Network request failed', { status: 503 });
      });
    })
  );
});
