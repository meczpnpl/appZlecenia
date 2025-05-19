import { useState, useEffect } from 'react';
import { version } from '../../shared/config';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { RefreshCw } from 'lucide-react';

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
      console.log('Wykryto nową wersję aplikacji.');
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
      window.location.reload();
    });
  } else {
    // Jeśli API cache nie jest dostępne, spróbuj zwykłego przeładowania
    window.location.reload();
  }
}

// Komponent do wyświetlania powiadomienia o nowej wersji
export function VersionUpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  
  useEffect(() => {
    // Sprawdź wersję przy starcie
    const checkVersion = async () => {
      const isNewVersion = await checkForNewVersion();
      setShowNotification(isNewVersion);
    };
    
    // Wywołaj sprawdzenie od razu
    checkVersion();
    
    // Ustaw interwał sprawdzania - co 30 sekund
    const intervalId = setInterval(checkVersion, 30000);
    
    // Wyczyść interwał przy odmontowaniu komponentu
    return () => clearInterval(intervalId);
  }, []);
  
  if (!showNotification) {
    return null;
  }
  
  return (
    <div className="fixed bottom-10 right-10 z-50">
      <Card className="w-72 shadow-lg border-2 border-blue-500 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-md">Dostępna nowa wersja</CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
          <p className="text-sm">
            Dostępna jest nowa wersja aplikacji. Odśwież stronę, aby korzystać z najnowszych funkcji i poprawek.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={clearCacheAndReload} 
            className="w-full flex items-center justify-center"
            variant="default"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Odśwież aplikację
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}