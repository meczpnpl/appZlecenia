import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import { Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { Route, Switch, useLocation } from "wouter";
import AppShell from "@/components/layout/AppShell";

// Import pages - changing from lazy loading to direct imports to prevent loading issues
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import CreateOrder from "./pages/CreateOrder";
import OrderDetails from "./pages/OrderDetails";
import SalesPlan from "./pages/SalesPlan";
import Users from "./pages/Users";
import Stores from "./pages/Stores";
import NotFound from "./pages/not-found";
import Companies from "./pages/Companies";
import CompanyInstallers from "./pages/CompanyInstallers";
import CompanyStores from "./pages/CompanyStores";
import CompanySchedule from "./pages/CompanySchedule";
import InstallerSchedule from "./pages/InstallerSchedule";
import Settings from "./pages/Settings";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// App component with AuthProvider
const App = () => {
  console.log("App.tsx został załadowany - v1.5");
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [newVersion, setNewVersion] = useState("");
  
  // Sprawdzanie nowej wersji aplikacji
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    const checkForNewVersion = async () => {
      try {
        // Pobieramy wersję z pamięci podręcznej przeglądarki
        const cachedVersion = localStorage.getItem('app_version');
        
        // Pobieramy aktualną wersję z serwera
        const response = await fetch('/api/version', {
          cache: 'no-store', // Wymuszamy pobranie świeżych danych
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (response.ok) {
          const data = await response.json();
          const serverVersion = data.version;
          
          console.log(`Wersja z cache: ${cachedVersion}, wersja z serwera: ${serverVersion}`);
          
          // Jeśli wersje się różnią i nie jest to pierwsze uruchomienie
          if (cachedVersion && cachedVersion !== serverVersion) {
            setNewVersion(serverVersion);
            setShowUpdateNotification(true);
          }
          
          // Zapisujemy aktualną wersję w pamięci podręcznej
          localStorage.setItem('app_version', serverVersion);
        }
      } catch (error) {
        console.error("Błąd podczas sprawdzania wersji:", error);
      }
    };
    
    // Sprawdzamy wersję przy uruchomieniu aplikacji
    checkForNewVersion();
    
    // Następnie sprawdzamy co 5 minut (300000 ms)
    intervalId = setInterval(checkForNewVersion, 300000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
  
  // Funkcja do czyszczenia pamięci podręcznej, ciasteczek i odświeżania aplikacji
  const clearCacheAndReload = () => {
    // Usuń wszystkie ciasteczka (łącznie z tymi z flagą httpOnly)
    const clearCookies = async () => {
      console.log("Rozpoczynam agresywne czyszczenie ciasteczek...");
      
      // 1. Próba ręcznego usunięcia ciasteczek - najsilniejsze podejście
      const cookieNames = document.cookie.split(";").map(cookie => {
        const parts = cookie.split("=");
        return parts[0].trim();
      }).filter(name => name); // Filtrowanie pustych nazw
      
      // Nazwy znanych ciasteczek, które mogą być używane przez aplikację
      const knownCookies = [
        'belpol_session', 'connect.sid', 'sid', 'session', 'user_session', 'auth',
        'JSESSIONID', 'PHPSESSID', 'SESSID', 'SESS', 'remember_token'
      ];
      
      // Połącz rzeczywiste ciasteczka ze znanymi ciasteczkami
      const allCookieNames = [...new Set([...cookieNames, ...knownCookies])];
      
      // Lista wszystkich możliwych ścieżek
      const paths = ['/', '/api', '/api/', '', '/login', '/auth'];
      
      // Lista wszystkich możliwych domen
      const domainParts = window.location.hostname.split('.');
      const domains = [];
      
      // Dodaj samą domenę
      domains.push(window.location.hostname);
      
      // Dodaj domeny z kropką na początku
      domains.push('.' + window.location.hostname);
      
      // Jeśli mamy więcej niż 2 części (np. app.example.com), dodaj także główną domenę (example.com)
      if (domainParts.length > 2) {
        const mainDomain = domainParts.slice(1).join('.');
        domains.push(mainDomain);
        domains.push('.' + mainDomain);
      }
      
      // Agresywne usuwanie wszystkich ciasteczek dla wszystkich możliwych kombinacji ścieżek i domen
      console.log(`Usuwam ${allCookieNames.length} ciasteczek dla ${paths.length} ścieżek i ${domains.length} domen...`);
      
      allCookieNames.forEach(name => {
        // Usuwanie bez podawania ścieżki i domeny
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        
        // Usuwanie dla wszystkich ścieżek i domen
        paths.forEach(path => {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`;
          
          // Bez domeny
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};max-age=0`;
          
          // Z domenami
          domains.forEach(domain => {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};max-age=0`;
            
            // Z różnymi flagami
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};secure`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};secure;max-age=0`;
            
            // Z SameSite
            ['strict', 'lax', 'none'].forEach(sameSite => {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};samesite=${sameSite}`;
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain};samesite=${sameSite};secure`;
            });
          });
        });
      });
      
      // 2. Wyczyść sessionStorage i localStorage (zachowując tylko app_version)
      console.log("Czyszczenie localStorage i sessionStorage...");
      const appVersion = localStorage.getItem('app_version');
      const serverVersion = localStorage.getItem('server_version') || newVersion;
      
      // Wyczyść wszystko
      sessionStorage.clear();
      localStorage.clear();
      
      // Przywróć tylko wersję
      if (serverVersion) localStorage.setItem('app_version', serverVersion);
      else if (appVersion) localStorage.setItem('app_version', appVersion);
      else if (newVersion) localStorage.setItem('app_version', newVersion);
      
      // 3. Wylogowanie po API - najpewniejszy sposób usunięcia ciasteczek HTTP-only
      console.log("Wylogowywanie przez API...");
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });
        console.log("Sesja na serwerze zakończona pomyślnie");
      } catch (error) {
        console.error("Błąd podczas kończenia sesji:", error);
      }
      
      // 4. Jeszcze jedna próba - z użyciem iframe
      try {
        console.log("Próba usunięcia ciasteczek przez iframe...");
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (iframeDoc) {
          allCookieNames.forEach(name => {
            iframeDoc.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          });
        }
        
        // Usuń iframe
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 100);
      } catch (e) {
        console.error("Błąd iframe:", e);
      }
      
      console.log("Operacja czyszczenia ciasteczek i lokalnych danych zakończona");
    };
    
    // Wyloguj użytkownika przed odświeżeniem (opcjonalne, możesz to usunąć, jeśli chcesz zachować sesję)
    const logout = async () => {
      try {
        // Wylogowujemy użytkownika przez API
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log("Użytkownik wylogowany pomyślnie");
        }
      } catch (error) {
        console.error("Błąd podczas wylogowywania:", error);
      }
    };
    
    // Używamy async/await dla lepszej czytelności i obsługi błędów
    const performFullCleanupAndReload = async () => {
      try {
        console.log("Rozpoczynam pełną procedurę czyszczenia i odświeżania...");
        
        // 1. Wyczyść ciasteczka i sesję
        await clearCookies();
        
        // 2. Odrejestruj Service Workery (jeśli są dostępne)
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          
          if (registrations.length > 0) {
            console.log(`Znaleziono ${registrations.length} service worker(ów) do wyrejestrowania`);
            
            const unregisterPromises = registrations.map(registration => {
              console.log("Wyrejestrowuję Service Worker...");
              return registration.unregister();
            });
            
            await Promise.all(unregisterPromises);
            console.log("Wszystkie Service Workery zostały wyrejestrowane");
          } else {
            console.log("Nie znaleziono aktywnych Service Workerów");
          }
        }
        
        // 3. Wyczyść cache (jeśli API cache jest dostępne)
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          
          if (cacheKeys.length > 0) {
            console.log(`Znaleziono ${cacheKeys.length} cache do wyczyszczenia`);
            
            const deletePromises = cacheKeys.map(name => {
              console.log("Usuwam cache:", name);
              return caches.delete(name);
            });
            
            await Promise.all(deletePromises);
            console.log("Wszystkie cache zostały wyczyszczone");
          } else {
            console.log("Nie znaleziono cache do wyczyszczenia");
          }
        }
        
        // 4. Stwórz ekran przejściowy
        const transitionScreen = document.createElement('div');
        transitionScreen.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.85);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          font-family: Arial, sans-serif;
        `;
        
        transitionScreen.innerHTML = `
          <div style="text-align: center; max-width: 80%;">
            <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">Wdrażanie nowej wersji</h2>
            <p style="margin-bottom: 0.5rem;">Trwa czyszczenie danych i ładowanie nowej wersji aplikacji.</p>
            <p style="margin-bottom: 0.5rem;">Proszę nie zamykać strony...</p>
            <div style="display: inline-block; margin: 1.5rem 0; width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.2); border-radius: 50%; border-top-color: white; animation: spin 1s linear infinite;"></div>
            <p style="font-size: 0.8rem; opacity: 0.7;">Wersja ${newVersion}</p>
            <style>
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          </div>
        `;
        
        document.body.appendChild(transitionScreen);
        
        // 5. Poczekaj 1.5 sekundy, aby pokazać ekran przejściowy
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 6. Finalne otwarcie nowego okna z wymuszoną nową wersją
        console.log("Wszystkie operacje czyszczenia zakończone, otwieram nowe okno...");
        
        try {
          // Otwórz w nowym oknie (to bardziej radykalny sposób niż location.href)
          const forcedUrl = window.location.origin + "/?hardreload=" + Date.now();
          window.open(forcedUrl, "_self");
          
          // Awaryjne odświeżenie po 1 sekundzie, jeśli window.open nie zadziała
          setTimeout(() => {
            window.location.reload(true);
          }, 1000);
        } catch (e) {
          console.error("Błąd podczas otwierania nowego okna:", e);
          // Standardowe odświeżenie jako awaryjne
          window.location.href = "/?forcereload=" + Date.now();
        }
        
      } catch (error) {
        console.error("Wystąpił błąd podczas czyszczenia:", error);
        // Nawet jeśli wystąpi błąd, próbujemy odświeżyć stronę
        window.location.href = "/?forcereload=" + Date.now();
      }
    };
    
    // Uruchom procedurę czyszczenia
    performFullCleanupAndReload();
  };
  
  // Obsługa błędów i odświeżania Service Workera
  useEffect(() => {
    // Sprawdź, czy jesteśmy po wymuszonym odświeżeniu
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('forcereload')) {
      // Jesteśmy po wymuszonym odświeżeniu, więc usuwamy parametr z URL
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log("Zakończono odświeżanie aplikacji");
    }
    
    // Obserwuj zmiany w Service Workerze
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log("Service Worker został zaktualizowany, odświeżam stronę...");
        clearCacheAndReload();
      });
    }
    
    // Obsługa błędów (np. biały ekran)
    window.addEventListener('error', (event) => {
      console.error("Złapano błąd:", event.error);
      // Jeśli aplikacja nie załadowała się poprawnie, wymuszamy reset
      if (document.body.childElementCount <= 1) {
        clearCacheAndReload();
      }
    });
  }, []);
  
  // Komponent powiadomienia o aktualizacji - ulepszona wersja
  const VersionUpdateNotification = () => {
    if (!showUpdateNotification) return null;
    
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-bounce-slow">
        <div className="bg-white border border-blue-200 rounded-lg shadow-xl p-4 flex flex-col items-center max-w-md">
          <div className="text-center mb-3">
            <h3 className="text-lg font-semibold mb-1 text-blue-600">Dostępna nowa wersja!</h3>
            <p className="text-sm text-gray-600">
              Wykryto nową wersję aplikacji <span className="font-bold">{newVersion}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Aby korzystać z nowych funkcji i poprawek, odśwież stronę.
            </p>
          </div>
          <Button 
            onClick={clearCacheAndReload}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
          >
            <RefreshCw className="mr-2 h-4 w-4 animate-spin-slow" />
            Odśwież teraz
          </Button>
        </div>
      </div>
    );
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <VersionUpdateNotification />
          <Suspense fallback={<Loading />}>
            <AppRoutes />
          </Suspense>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

// Separate component for routes to use the auth hook
function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth();
  const [location, setLocation] = useLocation();
  
  useEffect(() => {
    // Przekierowanie niezalogowanych użytkowników na stronę logowania
    if (!loading && !isAuthenticated && location !== "/login") {
      console.log("Przekierowuję niezalogowanego użytkownika do /login");
      setLocation("/login");
      return;
    }
    
    // Przekierowanie firm i montażystów bezpośrednio na stronę zleceń
    if (!loading && isAuthenticated && location === "/" && 
        (user?.role === 'installer' || user?.role === 'company')) {
      console.log(`Przekierowuję użytkownika (${user.role}) bezpośrednio na stronę zleceń`);
      setLocation("/orders");
    }
  }, [isAuthenticated, loading, location, setLocation, user]);
  
  // Pokaż ładowanie podczas sprawdzania autoryzacji
  if (loading) {
    return <Loading />;
  }

  // Gdy na stronie logowania, nie pokazuj AppShell
  if (location === "/login") {
    return (
      <Switch>
        <Route path="/login">
          <Login />
        </Route>
      </Switch>
    );
  }
  
  // All authenticated routes with AppShell
  return (
    <AppShell>
      <Switch>
        <Route path="/">
          <Dashboard />
        </Route>
        
        {/* Orders routes */}
        <Route path="/orders">
          <Orders />
        </Route>
        <Route path="/orders/create">
          <CreateOrder />
        </Route>
        <Route path="/orders/:id">
          {(params) => <OrderDetails orderId={params.id} />}
        </Route>
        
        {/* Sales plan */}
        <Route path="/salesplan">
          <SalesPlan />
        </Route>
        
        {/* Admin routes */}
        <Route path="/users">
          <Users />
        </Route>
        
        {/* Stores routes */}
        <Route path="/stores">
          <Stores />
        </Route>
        <Route path="/stores/add">
          <Stores />
        </Route>
        <Route path="/stores/edit/:id">
          <Stores />
        </Route>
        
        <Route path="/companies">
          <Companies />
        </Route>
        
        {/* Company management routes */}
        <Route path="/company/installers">
          <CompanyInstallers />
        </Route>
        
        <Route path="/company/stores">
          <CompanyStores />
        </Route>
        
        {/* Wszystkie firmy (również z pracownikami) używają teraz jednego widoku harmonogramu,
            identycznego jak firmy jednoosobowe */}
        <Route path="/company/schedule">
          <InstallerSchedule />
        </Route>
        
        {/* Installer routes */}
        <Route path="/installer/schedule">
          <InstallerSchedule />
        </Route>
        
        {/* Settings route */}
        <Route path="/settings">
          <Settings />
        </Route>
        
        {/* Catch all */}
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </AppShell>
  );
}

// Simple loading component
function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Bel-Pol System</h1>
        <p className="mb-4">Ładowanie...</p>
      </div>
    </div>
  );
}

export default App;