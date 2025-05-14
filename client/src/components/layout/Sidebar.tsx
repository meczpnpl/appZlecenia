import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { LogOut, X, Home, ClipboardList, BarChart2, Users, Settings, CalendarDays, Truck, Store, Building, LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  setOpen: (open: boolean) => void;
}

function NavItem({ href, icon, children, active, setOpen }: NavItemProps) {
  // Zamykamy menu po kliknięciu w link, ale tylko na urządzeniach mobilnych
  const handleClick = () => {
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  };

  return (
    <Link href={href}>
      <div 
        className={`block py-2.5 px-4 rounded transition duration-200 cursor-pointer ${active ? 'bg-blue-700 text-white' : 'text-gray-300 hover:bg-blue-600 hover:text-white'}`}
        onClick={handleClick}
      >
        <div className="flex items-center">
          {icon}
          <span className="ml-2">{children}</span>
        </div>
      </div>
    </Link>
  );
}

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  
  // Określenie, czy zalogowany użytkownik jest transporterem
  const isTransporter = 
    user?.role === 'installer' && 
    user?.services?.some(s => s.toLowerCase().includes('transport'));
  
  // Dodanie info o stanie administratora
  console.log("Sidebar - user:", user);
  console.log("Sidebar - isAdmin:", isAdmin);
  console.log("Sidebar - user?.role:", user?.role);
  console.log("Sidebar - isTransporter:", isTransporter);
  
  const handleLogout = async () => {
    await logout();
  };
  
  return (
    <div 
      className={`bg-blue-800 text-white w-64 space-y-6 py-4 fixed inset-y-0 left-0 transform transition duration-200 ease-in-out z-30 md:relative ${
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="px-4 flex items-center justify-between">
        <Link href="/">
          <div
            className="text-white font-bold text-2xl flex items-center space-x-2 cursor-pointer"
            onClick={() => {
              if (window.innerWidth < 768) {
                setOpen(false);
              }
            }}
          >
            <span className="bg-white text-blue-800 p-1 rounded">BP</span>
            <span>Bel-Pol</span>
          </div>
        </Link>
        <button 
          className="md:hidden focus:outline-none"
          onClick={() => setOpen(false)}
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      
      {/* Current User Info */}
      {user && (
        <div className="px-4 py-3 border-t border-b border-blue-700 mt-2">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-600 rounded-full h-10 w-10 flex items-center justify-center">
              <span className="text-lg font-medium">{user.name?.substring(0, 2) || 'BP'}</span>
            </div>
            <div>
              <div className="font-medium">{user.name || 'Użytkownik Bel-Pol'}</div>
              <div className="text-xs text-gray-300">
                {user.role === 'admin' && 'Administrator'}
                {user.role === 'worker' && 'Pracownik'}
                {user.role === 'company' && 'Firma montażowa'}
                {user.role === 'installer' && 'Montażysta'}
              </div>
            </div>
          </div>
          {user.store && (
            <div className="text-sm text-gray-300 mt-1">
              Sklep: {user.store}
            </div>
          )}
          {user.companyName && (
            <div className="text-sm text-gray-300 mt-1">
              Firma: {user.companyName}
            </div>
          )}
        </div>
      )}
      
      {/* Navigation */}
      <nav className="px-4 py-2">
        <h3 className="uppercase tracking-wider text-xs font-semibold text-gray-300 mb-2">Menu główne</h3>
        
        {/* Specyficzne menu w zależności od roli */}
        {(user?.role === 'installer' || user?.role === 'company') ? (
          <>
            {/* Firmy montażowe i montażyści - bez panelu głównego */}
            <NavItem href="/orders" icon={<ClipboardList className="h-5 w-5" />} active={location.startsWith('/orders')} setOpen={setOpen}>
              Zlecenia
            </NavItem>
          </>
        ) : (
          <>
            {/* Pracownicy sklepu i administratorzy */}
            <NavItem href="/" icon={<Home className="h-5 w-5" />} active={location === '/'} setOpen={setOpen}>
              Panel główny
            </NavItem>
            
            <NavItem href="/orders" icon={<ClipboardList className="h-5 w-5" />} active={location.startsWith('/orders')} setOpen={setOpen}>
              Zlecenia
            </NavItem>
            
            {(user?.role === 'admin' || user?.role === 'worker') && (
              <NavItem href="/salesplan" icon={<BarChart2 className="h-5 w-5" />} active={location === '/salesplan'} setOpen={setOpen}>
                Plan sprzedaży
              </NavItem>
            )}
          </>
        )}
        
        {/* Dodajemy opcję wylogowania w głównym menu dla urządzeń mobilnych */}
        <div className="md:hidden mt-3">
          <div 
            className="block py-2.5 px-4 rounded transition duration-200 cursor-pointer text-gray-300 hover:bg-blue-600 hover:text-white"
            onClick={handleLogout}
          >
            <div className="flex items-center">
              <LogOut className="h-5 w-5" />
              <span className="ml-2">Wyloguj</span>
            </div>
          </div>
        </div>
        
        {/* Role-specific navigation */}
        {user?.role === 'company' && (
          <>
            <h3 className="uppercase tracking-wider text-xs font-semibold text-gray-300 mt-4 mb-2">Zarządzanie</h3>
            
            <NavItem href="/company/installers" icon={<Users className="h-5 w-5" />} active={location === '/company/installers'} setOpen={setOpen}>
              Montażyści
            </NavItem>
            
            <NavItem href="/company/stores" icon={<Building className="h-5 w-5" />} active={location === '/company/stores'} setOpen={setOpen}>
              Sklepy
            </NavItem>
            
            <NavItem href="/company/schedule" icon={<CalendarDays className="h-5 w-5" />} active={location === '/company/schedule'} setOpen={setOpen}>
              Grafik prac
            </NavItem>
          </>
        )}
        
        {user?.role === 'installer' && (
          <>
            <h3 className="uppercase tracking-wider text-xs font-semibold text-gray-300 mt-4 mb-2">Moje prace</h3>
            
            <NavItem href="/installer/schedule" icon={<CalendarDays className="h-5 w-5" />} active={location === '/installer/schedule'} setOpen={setOpen}>
              Harmonogram
            </NavItem>
          </>
        )}
        
        {/* Admin Only Navigation */}
        {isAdmin && (
          <>
            <h3 className="uppercase tracking-wider text-xs font-semibold text-gray-300 mt-4 mb-2">Administracja</h3>
            
            <NavItem href="/users" icon={<Users className="h-5 w-5" />} active={location === '/users'} setOpen={setOpen}>
              Użytkownicy
            </NavItem>
            
            <NavItem href="/companies" icon={<Truck className="h-5 w-5" />} active={location === '/companies'} setOpen={setOpen}>
              Firmy montażowe
            </NavItem>
            
            <NavItem href="/stores" icon={<Store className="h-5 w-5" />} active={location === '/stores'} setOpen={setOpen}>
              Sklepy
            </NavItem>
            
            <NavItem href="/settings" icon={<Settings className="h-5 w-5" />} active={location === '/settings'} setOpen={setOpen}>
              Ustawienia
            </NavItem>
          </>
        )}
      </nav>
      
      {/* Pusty div na dole, aby zapewnić odstęp pod menu na urządzeniach mobilnych */}
      <div className="px-4 mt-auto pt-6 pb-24 md:pb-2 absolute bottom-0 w-full">
        <div className="md:block hidden">
          <Button 
            className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 px-4 rounded flex items-center justify-center transition duration-200"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Wyloguj
          </Button>
        </div>
      </div>
    </div>
  );
}
