// Używamy wersji aplikacji w nazwie cache, aby wymusić odświeżenie po zmianie wersji
const APP_VERSION = '2.1.23';  // Ta wartość będzie aktualizowana automatycznie przez skrypt wersjonowania
const CACHE_NAME = `bel-pol-cache-${APP_VERSION}`;

// Zwiększamy liczbę cachowanych plików dla lepszej pracy offline
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/assets/logo.svg',
  '/assets/logo-dark.svg'
];

// Sprawdzanie wersji aplikacji co 15 sekund dla szybszego testowania
const VERSION_CHECK_INTERVAL = 15 * 1000; // 15 sekund

// Flaga kontrolująca, czy sprawdzanie jest w toku
let isCheckingVersion = false;

// Zapisana wersja aplikacji - do porównywania
let lastKnownVersion = APP_VERSION;

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
    Promise.all([
      // Usuń stare cache
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('Service Worker: Usuwanie starego cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Przejmij kontrolę nad wszystkimi klientami
      self.clients.claim(),
      // Sprawdź aktualizację od razu
      checkAppVersion()
    ]).then(() => {
      console.log('Service Worker: Aktywny i przejmuje kontrolę nad klientami');
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

// Bardzo prosta funkcja sprawdzająca wersję aplikacji
async function checkAppVersion() {
  if (isCheckingVersion) return;
  
  try {
    isCheckingVersion = true;
    console.log('[Service Worker] Sprawdzanie wersji aplikacji...');
    
    // Dodaj losowy parametr, aby zapobiec cachowaniu
    const timestamp = Date.now();
    const requestUrl = `/api/version?nocache=${timestamp}`;
    console.log(`[Service Worker] Wysyłam żądanie do: ${requestUrl}`);
    
    const response = await fetch(requestUrl, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      },
      cache: 'no-store'
    });
    
    console.log('[Service Worker] Otrzymano odpowiedź od serwera:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      const serverVersion = data.version;
      const versionString = `v.${APP_VERSION}`;
      
      console.log(`[Service Worker] Wersja serwera: ${serverVersion}, wersja service workera: ${versionString}`);
      
      // Jeśli wersje się różnią - odśwież wszystkie okna
      if (serverVersion !== versionString) {
        console.log('[Service Worker] Wykryto nową wersję!', {
          server: serverVersion,
          serviceWorker: versionString,
          lastKnown: lastKnownVersion
        });
        
        // Aktualizuj zapisaną wersję
        lastKnownVersion = APP_VERSION;
        
        try {
          // Znajdź wszystkie otwarte okna
          const windowClients = await clients.matchAll({ 
            type: 'window',
            includeUncontrolled: true
          });
          
          console.log(`[Service Worker] Znaleziono ${windowClients.length} otwartych okien`);
          
          // Dla każdego okna
          for (const client of windowClients) {
            try {
              console.log(`[Service Worker] Wysyłam komunikat i odświeżam okno: ${client.url}`);
              
              // 1. Najpierw wyślij wiadomość do klienta
              await client.postMessage({
                type: 'VERSION_UPDATE',
                oldVersion: APP_VERSION,
                newVersion: serverVersion,
                timestamp: Date.now()
              });
              
              // 2. Poczekaj moment
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // 3. Odśwież stronę
              await client.navigate(client.url);
              
              console.log('[Service Worker] Okno odświeżone pomyślnie');
            } catch (clientError) {
              console.error('[Service Worker] Błąd podczas odświeżania okna:', clientError);
            }
          }
        } catch (clientsError) {
          console.error('[Service Worker] Błąd podczas pobierania klientów:', clientsError);
        }
      } else {
        console.log('[Service Worker] Wersja aplikacji jest aktualna');
      }
    } else {
      console.error('[Service Worker] Błędna odpowiedź z serwera:', response.status);
    }
  } catch (error) {
    console.error('[Service Worker] Błąd podczas sprawdzania wersji:', error);
  } finally {
    isCheckingVersion = false;
  }
}

// Uruchamiaj sprawdzanie wersji co określony interwał
setInterval(checkAppVersion, VERSION_CHECK_INTERVAL);

// Uruchom sprawdzanie przy aktywacji
self.addEventListener('activate', event => {
  event.waitUntil(checkAppVersion());
});