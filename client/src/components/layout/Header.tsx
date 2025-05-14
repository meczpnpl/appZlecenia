import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Menu } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from 'react';
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ sidebarOpen, setSidebarOpen }: HeaderProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [selectedStore, setSelectedStore] = useState(user?.store || 'Santocka 39');
  
  const getPageTitle = () => {
    switch (true) {
      case location === '/':
        return 'Pulpit';
      case location.startsWith('/orders/create'):
        return 'Nowe zlecenie';
      case location.startsWith('/orders/'):
        return 'Szczegóły zlecenia';
      case location.startsWith('/orders'):
        return 'Zlecenia';
      case location === '/salesplan':
        return 'Plan sprzedaży';
      case location === '/users':
        return 'Użytkownicy';
      case location === '/settings':
        return 'Ustawienia';
      default:
        return 'Bel-Pol';
    }
  };
  
  const getPageSubtitle = () => {
    switch (true) {
      case location === '/':
        return 'Przegląd zleceń i realizacji planu';
      case location.startsWith('/orders/create'):
        return 'Wprowadź dane nowego zlecenia';
      case location.startsWith('/orders/'):
        return 'Informacje o zleceniu i status';
      case location.startsWith('/orders'):
        return 'Lista wszystkich zleceń';
      case location === '/salesplan':
        return 'Analiza realizacji planu sprzedaży';
      case location === '/users':
        return 'Zarządzanie użytkownikami systemu';
      case location === '/settings':
        return 'Konfiguracja aplikacji';
      default:
        return '';
    }
  };
  
  return (
    <header className="bg-white shadow-sm z-10">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center">
          <button 
            className="text-gray-600 focus:outline-none md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-4 md:ml-0">
            <h1 className="text-lg font-semibold">{getPageTitle()}</h1>
            <p className="text-sm text-gray-500">{getPageSubtitle()}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* Store Selector - Only for workers and admins */}
          {(user?.role === 'admin' || user?.role === 'worker') && (
            <div className="hidden md:block">
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="bg-gray-100 border border-gray-300 rounded-md py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 w-[140px]">
                  <SelectValue placeholder="Wybierz sklep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Santocka 39">Santocka 39</SelectItem>
                  <SelectItem value="Struga 31A">Struga 31A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Notifications */}
          <NotificationsPanel />
        </div>
      </div>
    </header>
  );
}
