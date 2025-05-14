import React from 'react';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Upewniamy się, że React jest dostępny globalnie dla diagnostyki
(window as any).React = React;

// Rejestracja Service Workera dla PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker zarejestrowany pomyślnie:', registration);
      })
      .catch(error => {
        console.error('Błąd podczas rejestracji Service Workera:', error);
      });
  });
}

// Debugujemy wersję React
console.log("React version:", React.version);
console.log("React jest dostępny globalnie:", (window as any).React ? "TAK" : "NIE");

// Przeprowadzamy test hooków
try {
  // @ts-ignore - test dostępu do wewnętrznych struktur React
  console.log("ReactCurrentOwner:", React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner ? "istnieje" : "nie istnieje");
  // @ts-ignore - test dostępu do wewnętrznych struktur React
  console.log("ReactCurrentDispatcher:", React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher ? "istnieje" : "nie istnieje");
} catch(err) {
  console.error("Błąd podczas sprawdzania React internals:", err);
}

// Prosty render bez StrictMode i innych potencjalnie problematycznych komponentów
const root = createRoot(document.getElementById("root")!);
console.log("React root został utworzony");
root.render(<App />);
console.log("App został renderowany");
