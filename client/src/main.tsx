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

// Funkcja sprawdzająca wersję aplikacji na serwerze - MAKSYMALNIE PROSTA WERSJA
const checkServerVersion = async () => {
  // Zapobiegaj równoczesnym wywołaniom
  if (isCheckingVersion) {
    console.log("Sprawdzanie wersji jest już w toku, pomijam...");
    return true;
  }
  
  try {
    isCheckingVersion = true;
    console.log("Sprawdzam wersję aplikacji na serwerze...");
    
    // W przypadku wersji testowej, dodaj flagę do URL
    if (window.location.search.includes('test_version')) {
      console.log("Wykryto tryb testowy wersji");
      isCheckingVersion = false;
      return true;
    }
    
    // Użyj zwykłego fetch z parametrami zapobiegającymi cache
    const timestamp = Date.now();
    const response = await fetch(`/api/version?t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Requested-Time': String(timestamp)
      },
      cache: 'no-store'
    });
    
    if (response.ok) {
      const data = await response.json();
      const serverVersion = data.version;
      
      // Pobierz zapisaną wersję z localStorage
      const savedVersion = localStorage.getItem('app_version');
      
      console.log(`Wersja na serwerze: ${serverVersion}, zapisana wersja: ${savedVersion || 'brak'}`);
      
      // Jeśli nie ma zapisanej wersji, zapisz ją
      if (!savedVersion) {
        localStorage.setItem('app_version', serverVersion);
        isCheckingVersion = false;
        return true;
      }
      
      // Jeśli wersje się różnią, odśwież stronę
      if (savedVersion !== serverVersion) {
        console.log(`Wykryto nową wersję aplikacji: ${serverVersion} (obecna: ${savedVersion})`);
        
        // Zapisz nową wersję w localStorage
        localStorage.setItem('app_version', serverVersion);
        
        // Stwórz interfejs informujący o aktualizacji
        const updateNotification = document.createElement('div');
        updateNotification.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: Arial, sans-serif;
        `;
        
        updateNotification.innerHTML = `
          <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; text-align: center;">
            <h2 style="color: #2563eb; margin-top: 0;">Nowa wersja dostępna!</h2>
            <p style="color: #333;">Wykryto nową wersję aplikacji (${serverVersion}).</p>
            <p style="color: #333;">Twoja obecna wersja: ${savedVersion}</p>
            <p style="color: #333;">Strona zostanie odświeżona za 3 sekundy.</p>
            <div style="margin: 20px auto; width: 40px; height: 40px; border: 4px solid rgba(0,0,0,0.1); border-radius: 50%; border-top-color: #2563eb; animation: spin 1s linear infinite;"></div>
            <style>
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          </div>
        `;
        
        document.body.appendChild(updateNotification);
        
        // Poczekaj 3 sekundy i odśwież stronę
        setTimeout(() => {
          console.log("Odświeżam stronę do nowej wersji...");
          window.location.href = `/?force_reload=${Date.now()}`;
        }, 3000);
        
        isCheckingVersion = false;
        return false; // Przerwij dalsze wykonanie
      }
      
      isCheckingVersion = false;
      return true; // Kontynuuj normalnie
    } else {
      console.error("Błąd podczas pobierania wersji:", response.statusText);
      isCheckingVersion = false;
      return true; // Kontynuuj mimo błędu
    }
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
    
    // Usuń parametr force lub refresh, jeśli istnieje w URL
    if (window.location.search.includes('force') || window.location.search.includes('refresh')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Nasłuchuj na wiadomości od Service Workera
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'VERSION_UPDATE') {
        const { oldVersion, newVersion } = event.data;
        console.log(`Otrzymano informację o nowej wersji: ${oldVersion} -> ${newVersion}`);
        
        // Zaktualizuj wersję w localStorage
        localStorage.setItem('app_version', newVersion);
        
        // Wyświetl informację użytkownikowi
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #2563eb;
          color: white;
          padding: 10px 15px;
          border-radius: 4px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          z-index: 9999;
          font-family: Arial, sans-serif;
          transition: opacity 0.3s;
        `;
        notification.innerHTML = `
          <div>Wykryto nową wersję aplikacji. Odświeżanie...</div>
        `;
        document.body.appendChild(notification);
      }
    });
    
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