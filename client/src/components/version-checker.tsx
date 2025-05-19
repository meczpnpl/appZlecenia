import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

/**
 * Komponent sprawdzający wersję aplikacji i wyświetlający powiadomienie gdy jest dostępna nowa wersja.
 * Używa prostego przycisku do odświeżenia strony zamiast automatycznego mechanizmu.
 */
const VersionChecker = () => {
  const [newVersionAvailable, setNewVersionAvailable] = useState<boolean>(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [serverVersion, setServerVersion] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);

  // Funkcja sprawdzająca wersję
  const checkVersion = async () => {
    if (checking) return;
    
    try {
      setChecking(true);
      
      // Dodaj timestamp do zapytania aby uniknąć cache
      const timestamp = Date.now();
      const response = await fetch(`/api/version?nocache=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        const newVersion = data.version;
        
        // Pobierz zapisaną wersję z localStorage
        const savedVersion = localStorage.getItem('app_version');
        
        setServerVersion(newVersion);
        setCurrentVersion(savedVersion || '');
        
        // Sprawdź czy wersje są różne
        if (savedVersion && savedVersion !== newVersion) {
          setNewVersionAvailable(true);
          setVisible(true);
        } else {
          // Zapisz aktualną wersję, jeśli nie ma zapisanej
          if (!savedVersion) {
            localStorage.setItem('app_version', newVersion);
          }
          setNewVersionAvailable(false);
        }
      }
    } catch (error) {
      console.error('Błąd podczas sprawdzania wersji:', error);
    } finally {
      setChecking(false);
    }
  };

  // Funkcja odświeżająca stronę
  const refreshPage = () => {
    // Zapisz nową wersję przed odświeżeniem
    if (serverVersion) {
      localStorage.setItem('app_version', serverVersion);
    }
    
    // Wymuś pełne odświeżenie strony z serwera
    window.location.href = `/?refresh=${Date.now()}`;
  };

  // Funkcja zamykająca powiadomienie
  const dismissNotification = () => {
    setVisible(false);
  };

  // Sprawdź wersję przy montowaniu komponentu i co 5 minut
  useEffect(() => {
    // Pierwsze sprawdzenie
    checkVersion();
    
    // Ustawienie cyklicznego sprawdzania
    const interval = setInterval(checkVersion, 5 * 60 * 1000); // co 5 minut
    
    return () => clearInterval(interval);
  }, []);

  // Jeśli nie ma nowej wersji lub powiadomienie zostało zamknięte, nie pokazuj niczego
  if (!visible || !newVersionAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white shadow-lg rounded-lg p-4 max-w-xs border border-gray-200 flex flex-col">
      <div className="flex items-start justify-between">
        <div className="flex items-center text-blue-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          <h3 className="font-medium">Nowa wersja dostępna!</h3>
        </div>
        <button 
          onClick={dismissNotification}
          className="text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>
      </div>
      
      <div className="mt-2 text-sm text-gray-700">
        <p>Dostępna jest nowa wersja aplikacji.</p>
        <p className="mt-1">
          <span className="font-medium">Obecna wersja:</span> {currentVersion}
        </p>
        <p className="mt-1">
          <span className="font-medium">Nowa wersja:</span> {serverVersion}
        </p>
      </div>
      
      <Button 
        onClick={refreshPage} 
        className="mt-3 w-full"
        variant="default"
      >
        Odśwież stronę
      </Button>
    </div>
  );
};

export default VersionChecker;