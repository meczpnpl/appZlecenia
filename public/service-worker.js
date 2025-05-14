const CACHE_NAME = 'bel-pol-cache-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Instalacja service workera
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalowanie...');
  // Wymuszamy aktywację bez czekania na zamknięcie poprzedniej wersji
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache został otwarty');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Wszystkie zasoby w cache');
      })
  );
});

// Obsługa zapytań
self.addEventListener('fetch', (event) => {
  // Nie przechwytujemy zapytań do API
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Zwróć odpowiedź z cache jeśli istnieje
        if (response) {
          return response;
        }
        
        // Jeśli nie ma w cache, pobierz z sieci
        return fetch(event.request).then(
          (response) => {
            // Sprawdź czy odpowiedź jest poprawna
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Sklonuj odpowiedź, ponieważ jest strumieniem
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          }
        );
      })
  );
});

// Aktywacja i czyszczenie starych cache
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Aktywowanie...');
  
  const cacheWhitelist = [CACHE_NAME];
  
  // Przejmij kontrolę natychmiast
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Usuń stare cache
            console.log('Service Worker: Usuwanie starego cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Aktywny i przejmuje kontrolę nad klientami');
      return self.clients.claim();
    })
  );
});

// Obsługa powiadomień push
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Nowe powiadomienie',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Bel-Pol', options)
    );
  }
});

// Obsługa kliknięcia w powiadomienie
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});