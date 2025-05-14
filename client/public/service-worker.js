const CACHE_NAME = 'belpol-app-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/service-worker.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, then network
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    // For API requests, we want fresh data, so we don't cache them
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If network request fails, try to return a basic response for the API
          return new Response(JSON.stringify({ error: 'You are offline. Please check your internet connection.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503
          });
        })
    );
  } else {
    // For non-API requests, use a cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Return cached response if available
          if (response) {
            return response;
          }
          // Clone the request because it's a one-time use stream
          const fetchRequest = event.request.clone();
          
          return fetch(fetchRequest)
            .then(response => {
              // Check for a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response because it's a one-time use stream
              const responseToCache = response.clone();
              
              // Cache the fetched resource
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(() => {
              // When offline and no cache hit, try to serve the offline page for navigation requests
              if (event.request.mode === 'navigate') {
                return caches.match('/');
              }
              
              return new Response('You are offline. Please check your internet connection.', {
                headers: { 'Content-Type': 'text/plain' },
                status: 503
              });
            });
        })
    );
  }
});

// Push notification event handler
self.addEventListener('push', event => {
  let data = { title: 'Nowe powiadomienie', body: 'Sprawdź aplikację, aby zobaczyć szczegóły' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('Error parsing push notification data:', e);
  }
  
  const options = {
    body: data.body || 'Sprawdź aplikację, aby zobaczyć szczegóły',
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563eb"%3E%3Cpath d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"%3E%3C/path%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563eb"%3E%3Cpath d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"%3E%3C/path%3E%3C/svg%3E',
    vibrate: [100, 50, 100],
    data: data.data || {}
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Handle notification click - open relevant page
  const urlToOpen = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // If a window client already exists, focus it
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  } else if (event.tag === 'sync-status-update') {
    event.waitUntil(syncStatusUpdates());
  }
});

// Function to sync pending orders when back online
async function syncOrders() {
  try {
    const db = await openDB();
    const pendingOrders = await db.getAll('pendingOrders');
    
    for (const order of pendingOrders) {
      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order.data)
        });
        
        if (response.ok) {
          await db.delete('pendingOrders', order.id);
        }
      } catch (err) {
        console.error('Failed to sync order:', err);
      }
    }
  } catch (err) {
    console.error('Error in syncOrders:', err);
  }
}

// Function to sync pending status updates when back online
async function syncStatusUpdates() {
  try {
    const db = await openDB();
    const pendingUpdates = await db.getAll('pendingStatusUpdates');
    
    for (const update of pendingUpdates) {
      try {
        const response = await fetch(`/api/orders/${update.orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          await db.delete('pendingStatusUpdates', update.id);
        }
      } catch (err) {
        console.error('Failed to sync status update:', err);
      }
    }
  } catch (err) {
    console.error('Error in syncStatusUpdates:', err);
  }
}

// Mock IndexedDB for this example (in a real app, use idb or another library)
function openDB() {
  return {
    getAll: (store) => Promise.resolve([]),
    delete: (store, id) => Promise.resolve()
  };
}
