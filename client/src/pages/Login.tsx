import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LockKeyhole, Building2, Store, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { version as configVersion } from '@shared/config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminName, setAdminName] = useState('Tomek Arso');
  const [adminEmail, setAdminEmail] = useState('tomekarso@gmail.com');
  const [adminPassword, setAdminPassword] = useState('ToM01111965');
  const [adminSetupError, setAdminSetupError] = useState('');
  const [isAdminSetupLoading, setIsAdminSetupLoading] = useState(false);
  
  // Stan wersji aplikacji - używamy configVersion jako wartości początkowej
  const [appVersion, setAppVersion] = useState(configVersion.toString());
  const [isLoadingVersion, setIsLoadingVersion] = useState(false);
  const [versionError, setVersionError] = useState(false);
  
  // Funkcja do wykonania automatycznego odświeżenia strony
  const forceRefresh = () => {
    console.log("[Login] Wymuszam odświeżenie strony...");
    
    // Wyświetl krótkie powiadomienie
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #2563eb;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: Arial, sans-serif;
    `;
    notification.innerHTML = `Wykryto nową wersję aplikacji. Odświeżanie...`;
    document.body.appendChild(notification);
    
    // Wyczyść localStorage dla app_version
    localStorage.removeItem('app_version');
    
    // Odśwież stronę po krótkim opóźnieniu (1 sekunda)
    setTimeout(() => {
      window.location.href = `/?force_reload=${Date.now()}`;
    }, 1000);
  };
  
  // Funkcja do pobierania aktualnej wersji z serwera
  const fetchCurrentVersion = async () => {
    setIsLoadingVersion(true);
    setVersionError(false);
    
    try {
      // Dodaj unikalny parametr czasowy, aby zawsze uniknąć cache
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 12);
      const response = await fetch(`/api/version?t=${timestamp}&r=${random}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.version) {
          // Sprawdź czy wersja się zmieniła
          const oldVersion = localStorage.getItem('app_version');
          const newVersion = data.version;
          
          console.log(`[Login] Pobrano wersję z serwera: ${newVersion}, zapisana wersja w localStorage: ${oldVersion || 'brak'}`);
          
          // Sprawdź, czy wersja na serwerze różni się od konfiguracji klienta
          if (configVersion.toString() !== newVersion) {
            console.log(`[Login] Wykryto różnicę między wersją klienta (${configVersion.toString()}) a serwera (${newVersion})`);
            
            // Automatyczne odświeżenie przy różnicy wersji
            forceRefresh();
            return;
          }
          
          // Sprawdź, czy wersja w localStorage się zmieniła
          if (oldVersion && oldVersion !== newVersion) {
            console.log(`[Login] Wykryto zmianę wersji: ${oldVersion} -> ${newVersion}.`);
            
            // Automatyczne odświeżenie przy zmianie wersji
            forceRefresh();
            return;
          }
          
          // Zapisz nową wersję do localStorage
          localStorage.setItem('app_version', newVersion);
          
          // Zaktualizuj stan
          setAppVersion(newVersion);
        }
      } else {
        setVersionError(true);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania wersji:", error);
      setVersionError(true);
    } finally {
      setIsLoadingVersion(false);
    }
  };
  
  // Sprawdź, czy ładujemy stronę z parametrem force_reload
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('force_reload')) {
      console.log('[Login] Wykryto parametr force_reload, czyszczę cache...');
      
      // Wyczyść cache przeglądarki
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
            console.log(`[Login] Wyczyszczono cache: ${cacheName}`);
          });
        });
      }
      
      // Usuń parametr z URL
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);
  
  // Pobierz wersję przy montowaniu komponentu
  useEffect(() => {
    // Natychmiast sprawdź wersję
    fetchCurrentVersion();
    
    // Ustaw interwał do okresowego sprawdzania wersji (co 5 sekund)
    const intervalId = setInterval(fetchCurrentVersion, 5000);
    
    // Dodaj jeszcze jedno sprawdzenie z opóźnieniem 1 sekunda (duże szanse na odświeżenie)
    const timeoutId = setTimeout(() => {
      console.log("[Login] Dodatkowe sprawdzenie wersji po opóźnieniu...");
      fetchCurrentVersion();
    }, 1000);
    
    // Wyczyść interwał i timeout przy odmontowaniu komponentu
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);
  
  // Obsługa formularza logowania
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (!email || !password) {
      setError('Wprowadź email i hasło');
      setIsLoading(false);
      return;
    }
    
    try {
      console.log("Próba logowania dla:", email);
      
      // Spróbuj zalogować się
      await login(email, password);
      
      // Przekieruj użytkownika do głównej strony
      toast({
        title: "Zalogowano pomyślnie",
        description: "Witamy w systemie zarządzania zleceniami Bel-Pol",
      });
      
      // Krótkie opóźnienie, aby toast zdążył się pokazać
      setTimeout(() => {
        setLocation('/');
      }, 500);
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Niepoprawny email lub hasło. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Obsługa formularza konfiguracji administratora
  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSetupError('');
    setIsAdminSetupLoading(true);
    
    if (!adminName || !adminEmail || !adminPassword) {
      setAdminSetupError('Wszystkie pola są wymagane');
      setIsAdminSetupLoading(false);
      return;
    }
    
    if (adminPassword.length < 6) {
      setAdminSetupError('Hasło musi mieć co najmniej 6 znaków');
      setIsAdminSetupLoading(false);
      return;
    }
    
    try {
      console.log("Tworzenie konta administratora:", { name: adminName, email: adminEmail });
      
      const response = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword
        }),
      });
      
      const responseText = await response.text();
      console.log("Status odpowiedzi:", response.status);
      console.log("Odpowiedź serwera:", responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Response was:", responseText);
        throw new Error('Nieprawidłowa odpowiedź serwera. Spróbuj ponownie później.');
      }
      
      if (!response.ok) {
        console.error("Server error response:", data);
        throw new Error(data.message || 'Błąd podczas tworzenia konta administratora');
      }
      
      // Automatycznie zaloguj na utworzone konto
      console.log("Konto administratora utworzone, próba logowania...");
      await login(adminEmail, adminPassword);
      
      setLocation('/');
      
      toast({
        title: "Konto administratora utworzone",
        description: "Twoje konto administratora zostało utworzone pomyślnie. Witamy w systemie Bel-Pol.",
      });
    } catch (err: any) {
      console.error('Admin setup error:', err);
      setAdminSetupError(err.message || 'Błąd podczas tworzenia konta administratora. Spróbuj ponownie.');
    } finally {
      setIsAdminSetupLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 px-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-800 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              BP
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Bel-Pol</CardTitle>
          <CardDescription className="text-lg">
            System zarządzania zleceniami
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="flex justify-center space-x-6 mb-6 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Store size={24} className="text-blue-800" />
              </div>
              <span className="text-sm">Santocka 39</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Store size={24} className="text-blue-800" />
              </div>
              <span className="text-sm">Struga 31A</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Building2 size={24} className="text-blue-800" />
              </div>
              <span className="text-sm">Montaż</span>
            </div>
          </div>
          
          {showAdminSetup ? (
            // Formularz konfiguracji administratora
            <div>
              <h3 className="font-medium text-lg mb-4">Konfiguracja konta administratora</h3>
              <form onSubmit={handleAdminSetup} className="space-y-4">
                {adminSetupError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
                    {adminSetupError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-name">
                    Imię i nazwisko
                  </label>
                  <Input 
                    id="admin-name"
                    type="text" 
                    placeholder="Jan Kowalski" 
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)} 
                    disabled={isAdminSetupLoading}
                    className="py-5"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-email">
                    Email
                  </label>
                  <Input 
                    id="admin-email"
                    type="email" 
                    placeholder="admin@belpol.pl" 
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)} 
                    disabled={isAdminSetupLoading}
                    className="py-5"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-password">
                    Hasło
                  </label>
                  <Input 
                    id="admin-password"
                    type="password" 
                    placeholder="••••••••" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)} 
                    disabled={isAdminSetupLoading}
                    className="py-5"
                  />
                </div>
                
                <div className="flex space-x-2 pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    className="flex-1" 
                    onClick={() => setShowAdminSetup(false)}
                    disabled={isAdminSetupLoading}
                  >
                    Powrót
                  </Button>
                  
                  <Button 
                    type="submit" 
                    className="flex-1 bg-blue-700 hover:bg-blue-800" 
                    disabled={isAdminSetupLoading}
                  >
                    {isAdminSetupLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                        Tworzenie...
                      </div>
                    ) : "Utwórz administratora"}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            // Standardowy formularz logowania
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="twoj@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} 
                  disabled={isLoading}
                  className="py-5"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Hasło
                </label>
                <Input 
                  id="password"
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} 
                  disabled={isLoading}
                  className="py-5"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full py-5 text-base bg-blue-700 hover:bg-blue-800" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                    Logowanie...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <LockKeyhole className="h-5 w-5 mr-2" />
                    Zaloguj się
                  </div>
                )}
              </Button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdminSetup(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Pierwsze uruchomienie? Kliknij, aby skonfigurować konto administratora
                </button>
              </div>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="border-t pt-4">
          <p className="text-xs text-center w-full text-gray-500">
            Dostęp do systemu możliwy tylko dla uprawnionych użytkowników Bel-Pol.<br/>
            Skontaktuj się z administratorem w sprawie dostępu.<br/>
            <span className="mt-2 inline-block">
              Wersja aplikacji: {appVersion}
              {isLoadingVersion && <RefreshCw className="inline ml-1 h-3 w-3 animate-spin" />}
              {versionError && <span className="text-red-500 ml-1">!</span>}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-gray-500 hover:text-gray-700"
                onClick={() => {
                  // Wymuś odświeżenie wersji
                  localStorage.removeItem('app_version');
                  window.location.href = `/?force_reload=${Date.now()}`;
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Odśwież
              </Button>
            </span>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
