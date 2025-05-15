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
const APP_VERSION = "2.0.1"; // zwiększaj wersję przy każdej publikacji

// Funkcja do czyszczenia cache
const clearCache = () => {
  console.log("Wykryto nową wersję aplikacji. Czyszczę pamięć podręczną.");
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
};

// Rejestracja Service Workera dla PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Sprawdź zapisaną wersję aplikacji
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion !== APP_VERSION) {
      console.log("Wykryto nową wersję aplikacji. Wymuszam odświeżenie cache.");
      // Wyczyść cache przy wykryciu nowej wersji
      clearCache();
      // Zapisz nową wersję w localStorage
      localStorage.setItem('app_version', APP_VERSION);
    }

    // Dodaj obsługę controllerchange, aby automatycznie odświeżyć stronę
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log("Service Worker uaktualniony. Odświeżam stronę.");
      window.location.reload();
    });

    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker zarejestrowany pomyślnie:', registration);
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