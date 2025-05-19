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
  
  // 1. Wyczyść localStorage (z wyjątkiem app_version)
  const tempVersion = localStorage.getItem('app_version');
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key !== 'app_version') localStorage.removeItem(key);
  });
  
  // 2. Wyczyść sessionStorage
  sessionStorage.clear();
  
  // 3. Usuń ciasteczka
  document.cookie.split(";").forEach(cookie => {
    const name = cookie.split("=")[0].trim();
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
  });
  
  // 4. Wyczyść cache
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log("Wszystkie cache zostały wyczyszczone");
    } catch (e) {
      console.error("Błąd podczas czyszczenia cache:", e);
    }
  }
  
  // 5. Wyślij żądanie wylogowania na serwer (dla ciasteczek HTTP-only)
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log("Sesja serwera została wyczyszczona");
  } catch (e) {
    console.error("Błąd podczas wylogowywania:", e);
  }
  
  // 6. Wyrejestruj service workery
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log("Service Workery zostały wyrejestrowane");
    } catch (e) {
      console.error("Błąd podczas wyrejestrowywania service workerów:", e);
    }
  }
  
  // Poczekaj 500ms aby wszystkie operacje mogły się zakończyć
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
      const savedVersion = localStorage.getItem('app_version');
      
      console.log(`Wersja na serwerze: ${serverVersion}, zapisana wersja: ${savedVersion || 'brak'}`);
      
      // Jeśli nie ma zapisanej wersji lub wersje się różnią
      if (!savedVersion) {
        localStorage.setItem('app_version', serverVersion);
      } else if (savedVersion !== serverVersion) {
        console.log(`Wykryto nową wersję aplikacji: ${serverVersion} (obecna: ${savedVersion})`);
        
        // Wyczyść wszystkie dane przeglądarki i odśwież stronę
        await clearCacheAndCookies();
        
        // Zaktualizuj wersję w localStorage przed odświeżeniem
        localStorage.setItem('app_version', serverVersion);
        
        // Odśwież stronę z parametrem zapobiegającym cachowaniu
        console.log("Przekierowuję do nowej wersji aplikacji...");
        window.location.href = `/?force=${Date.now()}`;
        
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