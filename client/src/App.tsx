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
  
  // Funkcja do czyszczenia pamięci podręcznej i odświeżania aplikacji
  const clearCacheAndReload = () => {
    if ('serviceWorker' in navigator) {
      // Odrejestruj wszystkie Service Workery
      navigator.serviceWorker.getRegistrations().then(registrations => {
        const unregisterPromises = registrations.map(registration => {
          console.log("Wyrejestrowuję Service Worker...");
          return registration.unregister();
        });
        
        Promise.all(unregisterPromises).then(() => {
          // Wyczyść wszystkie cache
          if ('caches' in window) {
            caches.keys().then(names => {
              const deletePromises = names.map(name => {
                console.log("Usuwam cache:", name);
                return caches.delete(name);
              });
              
              Promise.all(deletePromises).then(() => {
                console.log("Wszystkie cache wyczyszczone, odświeżam stronę...");
                window.location.reload();
              });
            });
          } else {
            window.location.reload();
          }
        });
      });
    } else {
      window.location.reload();
    }
  };
  
  // Obsługa błędów i odświeżania Service Workera
  useEffect(() => {
    function handleServiceWorkerFailure() {
      clearCacheAndReload();
    }
    
    // Obserwuj zmiany w Service Workerze
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log("Service Worker został zaktualizowany, odświeżam stronę...");
        window.location.reload();
      });
    }
    
    // Obsługa błędów (np. biały ekran)
    window.addEventListener('error', (event) => {
      console.error("Złapano błąd:", event.error);
      // Jeśli aplikacja nie załadowała się poprawnie, wymuszamy reset
      if (document.body.childElementCount <= 1) {
        handleServiceWorkerFailure();
      }
    });
  }, []);
  
  // Komponent powiadomienia o aktualizacji
  const VersionUpdateNotification = () => {
    if (!showUpdateNotification) return null;
    
    return (
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center items-start p-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 flex flex-col items-center max-w-md">
          <div className="text-center mb-3">
            <h3 className="text-lg font-semibold mb-1">Dostępna nowa wersja</h3>
            <p className="text-sm text-gray-600">
              Wykryto nową wersję aplikacji ({newVersion}). Odśwież stronę, aby zainstalować aktualizację.
            </p>
          </div>
          <Button 
            onClick={clearCacheAndReload}
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Odśwież stronę
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