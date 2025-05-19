import { version } from '@shared/config';

// Funkcja do sprawdzania czy pojawiła się nowa wersja aplikacji
export async function checkForNewVersion() {
  try {
    const response = await fetch('/api/version');
    if (!response.ok) {
      console.warn('Nie można sprawdzić wersji aplikacji');
      return false;
    }

    const data = await response.json();
    const serverVersion = data.version;
    const currentVersion = version.toString();

    console.log(`Sprawdzanie wersji | Lokalna: ${currentVersion} | Serwer: ${serverVersion}`);

    // Jeśli wersja serwerowa jest różna od wersji klienta, to mamy nową wersję
    if (serverVersion !== currentVersion) {
      console.log('Wykryto nową wersję aplikacji. Czyszczę pamięć podręczną...');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Błąd podczas sprawdzania wersji:', error);
    return false;
  }
}

// Funkcja do czyszczenia pamięci podręcznej i odświeżania strony
export function clearCacheAndReload() {
  if ('caches' in window) {
    // Czyszczenie pamięci podręcznej
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName).then(() => {
          console.log(`Cache ${cacheName} usunięty.`);
        });
      });
    }).catch(error => {
      console.error('Błąd podczas czyszczenia cache:', error);
    }).finally(() => {
      // Odświeżenie strony bez użycia pamięci podręcznej
      window.location.reload(true);
    });
  } else {
    // Jeśli API cache nie jest dostępne, spróbuj zwykłego przeładowania
    window.location.reload(true);
  }
}

// Funkcja, która sprawdza wersję co określony czas
export function startVersionChecker(intervalMs = 30000) {
  setInterval(async () => {
    const isNewVersion = await checkForNewVersion();
    if (isNewVersion) {
      // Wyświetl użytkownikowi informację o nowej wersji
      const confirmReload = window.confirm(
        'Wykryto nową wersję aplikacji. Czy chcesz odświeżyć stronę, aby korzystać z najnowszej wersji?'
      );
      
      if (confirmReload) {
        clearCacheAndReload();
      }
    }
  }, intervalMs);
}