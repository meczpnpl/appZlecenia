import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Upewniamy się, że React jest dostępny globalnie dla diagnostyki
(window as any).React = React;

// Ustaw zmienną do kontroli instalacji PWA
let deferredPrompt: any;

// Funkcja do odpalenia instalacji PWA bez pokazywania przycisku
function triggerInstallPrompt() {
  console.log("Próba automatycznej instalacji aplikacji");
  
  if (!deferredPrompt) {
    console.log("Brak zapisanego eventu deferredPrompt - instalacja niemożliwa");
    return;
  }
  
  // Pokaż prompt instalacji
  deferredPrompt.prompt();
  
  // Obsługa wyniku
  deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
    console.log(`Użytkownik wybrał: ${choiceResult.outcome}`);
    
    // Zresetuj zmienną, niezależnie od wyniku
    deferredPrompt = null;
  });
}

// Sprawdzamy dostępność PWA przy załadowaniu
window.addEventListener('load', () => {
  // Sprawdź, czy aplikacja już nie jest zainstalowana
  if (window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as any).standalone === true) {
    console.log('Aplikacja jest już zainstalowana w trybie standalone/PWA');
    return;
  }
  
  // Logujemy jedynie informację o możliwości instalacji
  console.log("Aplikacja może być zainstalowana jako PWA");
});

// Obsługuj zdarzenie beforeinstallprompt
window.addEventListener('beforeinstallprompt', (e) => {
  console.log("Przechwycono zdarzenie beforeinstallprompt", e);
  
  // Zapobiegaj automatycznemu pokazywaniu promptu
  e.preventDefault();
  
  // Zapisz zdarzenie aby móc je później wywołać
  deferredPrompt = e;
  
  // Automatyczna instalacja nie będzie inicjowana - użytkownik
  // skorzysta z wbudowanych mechanizmów przeglądarki jak ikona w pasku adresu
});

// Nasłuchuj na zdarzenie "appinstalled"
window.addEventListener('appinstalled', (e) => {
  console.log('Aplikacja została pomyślnie zainstalowana');
});

// Wykrywanie wersji aplikacji i czyszczenie cache

// Funkcja do czyszczenia wszystkich cache i ciasteczek
const clearCacheAndCookies = async () => {
  console.log("Wykryto nową wersję aplikacji. Czyszczę pamięć podręczną i dane sesji.");
  
  // Zapisz wartości które chcemy zachować
  const tempVersion = localStorage.getItem('app_version');
  const serverInstanceId = localStorage.getItem('server_instance_id');
  
  // 1. Wyczyść localStorage (z wyjątkiem kluczy które chcemy zatrzymać)
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key !== 'app_version' && key !== 'server_instance_id') {
        localStorage.removeItem(key);
      }
    });
    console.log("localStorage wyczyszczony (z zachowaniem kluczy wersji)");
  } catch (e) {
    console.error("Błąd podczas czyszczenia localStorage:", e);
  }
  
  // 2. Wyczyść sessionStorage
  try {
    sessionStorage.clear();
    console.log("sessionStorage wyczyszczony");
  } catch (e) {
    console.error("Błąd podczas czyszczenia sessionStorage:", e);
  }
  
  // 3. Usuń ciasteczka standardowe
  try {
    const cookies = document.cookie.split(";");
    cookies.forEach(cookie => {
      const name = cookie.split("=")[0].trim();
      if (name) {
        // Usuń ciasteczko używając różnych kombinacji ścieżek/domen
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
        console.log(`Próba usunięcia ciasteczka: ${name}`);
      }
    });
    console.log("Standardowe ciasteczka usunięte");
  } catch (e) {
    console.error("Błąd podczas usuwania ciasteczek:", e);
  }
  
  // 4. Wyczyść cache przeglądarki
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      if (cacheNames.length > 0) {
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log(`Wyczyszczono ${cacheNames.length} cache'ów przeglądarki`);
      } else {
        console.log("Brak cache'ów do wyczyszczenia");
      }
    } catch (e) {
      console.error("Błąd podczas czyszczenia cache:", e);
    }
  }
  
  // 5. Wyślij żądanie wylogowania na serwer (dla ciasteczek HTTP-only)
  try {
    console.log("Wysyłam żądanie wylogowania do serwera...");
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.ok) {
      console.log("Sesja serwera została wyczyszczona pomyślnie");
    } else {
      console.warn("Serwer zwrócił błąd podczas wylogowywania:", response.status);
    }
  } catch (e) {
    console.error("Błąd podczas wylogowywania:", e);
  }
  
  // 6. Wyrejestruj service workery
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log(`Wyrejestrowano ${registrations.length} service workerów`);
      } else {
        console.log("Brak service workerów do wyrejestrowania");
      }
    } catch (e) {
      console.error("Błąd podczas wyrejestrowywania service workerów:", e);
    }
  }
  
  // 7. Przywróć zapisane wartości
  localStorage.setItem('app_version', tempVersion || '');
  localStorage.setItem('server_instance_id', serverInstanceId || '');
  
  // 8. Poczekaj 500ms aby wszystkie operacje mogły się zakończyć
  return new Promise(resolve => setTimeout(resolve, 500));
};

// Zmienna do śledzenia aktualnie trwającego sprawdzenia
let isCheckingVersion = false;

// Funkcja sprawdzająca wersję aplikacji na serwerze
const checkServerVersion = async () => {
  // Zapobiegaj równoczesnym wywołaniom
  if (isCheckingVersion) {
    console.log("Sprawdzanie wersji jest już w toku, pomijam...");
    return true;
  }
  
  try {
    isCheckingVersion = true;
    
    // Sprawdź, czy nie jesteśmy w trakcie odświeżania z parametrem force
    if (window.location.search.includes('force')) {
      console.log("Wykryto parametr force, pomijam sprawdzanie wersji...");
      isCheckingVersion = false;
      return true;
    }
    
    console.log("Sprawdzam wersję aplikacji na serwerze...");
    
    const response = await fetch('/api/version', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      // Dodaj losowy parametr dla uniknięcia cache
      credentials: 'same-origin'
    });
    
    if (response.ok) {
      const data = await response.json();
      const serverVersion = data.version;
      const serviceWorkerVersion = data.serviceWorkerVersion;
      const serverInstanceId = data.serverInstanceId;
      
      // Pobierz zapisane wartości
      const savedVersion = localStorage.getItem('app_version');
      const savedInstanceId = localStorage.getItem('server_instance_id');
      
      console.log(`Wersja na serwerze: ${serverVersion} (SW: ${serviceWorkerVersion}), zapisana wersja: ${savedVersion || 'brak'}`);
      console.log(`ID instancji serwera: ${serverInstanceId}, zapisane ID: ${savedInstanceId || 'brak'}`);
      
      // Sprawdź czy serwer został zrestartowany (nowa instancja)
      const serverRestarted = savedInstanceId && savedInstanceId !== serverInstanceId;
      
      // Jeśli nie ma zapisanej wersji, zapisz ją
      if (!savedVersion || !savedInstanceId) {
        localStorage.setItem('app_version', serverVersion);
        localStorage.setItem('server_instance_id', serverInstanceId);
      } 
      // Jeśli wersje się różnią lub serwer został zrestartowany
      else if (savedVersion !== serverVersion || serverRestarted) {
        console.log(`Wykryto zmianę: ${serverRestarted ? 'restart serwera' : 'nowa wersja aplikacji'}`);
        console.log(`Wykryto nową wersję aplikacji: ${serverVersion} (obecna: ${savedVersion})`);
        
        // Wyczyść wszystkie dane przeglądarki i odśwież stronę
        await clearCacheAndCookies();
        
        // Zaktualizuj wersję w localStorage przed odświeżeniem
        localStorage.setItem('app_version', serverVersion);
        
        // Użyj iframe z wymuszonym odświeżeniem
        console.log("Przekierowuję do nowej wersji aplikacji używając metody radykalnej...");
        
        // Tworzymy tymczasową stronę HTML z automatycznym odświeżeniem
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Odświeżanie aplikacji</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background-color: #f5f5f5;
                  color: #333;
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 2rem;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                  max-width: 400px;
                }
                h1 {
                  margin-top: 0;
                  color: #2563eb;
                }
                .spinner {
                  margin: 20px auto;
                  width: 40px;
                  height: 40px;
                  border: 4px solid rgba(0,0,0,0.1);
                  border-radius: 50%;
                  border-top-color: #2563eb;
                  animation: spin 1s ease-in-out infinite;
                }
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              </style>
              <script>
                // Poczekaj na załadowanie strony, wyczyść cache i odśwież
                window.onload = function() {
                  setTimeout(function() {
                    // Przekieruj do głównej strony
                    window.location.href = "/?v=" + Date.now();
                  }, 2000);
                };
              </script>
            </head>
            <body>
              <div class="container">
                <h1>Wykryto nową wersję</h1>
                <p>Trwa aktualizacja aplikacji. Proszę czekać...</p>
                <div class="spinner"></div>
              </div>
            </body>
          </html>
        `;
        
        // Zastąp całą stronę tymczasową stroną odświeżającą
        document.open();
        document.write(html);
        document.close();
        
        isCheckingVersion = false;
        return false; // Przerwij dalsze wykonanie
      }
      
      isCheckingVersion = false;
      return true; // Kontynuuj normalnie
    }
    
    isCheckingVersion = false;
    return true;
  } catch (error) {
    console.error("Błąd podczas sprawdzania wersji:", error);
    isCheckingVersion = false;
    return true; // Kontynuuj normalnie mimo błędu
  }
};

// Rejestracja Service Workera dla PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Najpierw sprawdź wersję aplikacji - jeśli funkcja zwróci false, nie kontynuuj
    const shouldContinue = await checkServerVersion();
    if (!shouldContinue) return;
    
    // Usuń parametr force, jeśli istnieje w URL
    if (window.location.search.includes('force')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Dodaj obsługę controllerchange, aby automatycznie odświeżyć stronę
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log("Service Worker uaktualniony. Odświeżam stronę.");
      window.location.reload();
    });
    
    // Rejestruj service worker
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker zarejestrowany pomyślnie:', registration);
        
        // Dodaj cykliczne sprawdzanie wersji co 5 minut (300000 ms)
        setInterval(checkServerVersion, 300000);
      })
      .catch(error => {
        console.error('Błąd podczas rejestracji Service Workera:', error);
      });
  });
}

// Prosty render bez StrictMode i innych potencjalnie problematycznych komponentów
const root = createRoot(document.getElementById("root")!);
console.log("React root został utworzony");
root.render(<App />);
console.log("App został renderowany");