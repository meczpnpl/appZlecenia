import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNavBar from './MobileNavBar';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const { loading, isAuthenticated, user, isAdmin } = useAuth();
  const [location, setLocation] = useLocation();
  
  // Debug log dla komponentu AppShell
  useEffect(() => {
    console.log("AppShell - Auth State:", { 
      isAuthenticated, 
      isAdmin, 
      userPresent: !!user,
      userRole: user?.role 
    });
  }, [isAuthenticated, isAdmin, user]);
  
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth >= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Efekt usunięty, ponieważ obsługujemy kliknięcie bezpośrednio w komponencie MobileNavBar
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated && location !== '/login') {
      setLocation('/login');
    }
  }, [loading, isAuthenticated, setLocation, location]);
  
  // If on login page, don't show sidebar/header
  if (location === '/login') {
    return <>{children}</>;
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="p-8 bg-white rounded-lg shadow-md text-center">
          <div className="w-12 h-12 border-t-4 border-b-4 border-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700">Ładowanie aplikacji...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
          <div className="pb-2">
            {children}
          </div>
        </main>
        
        {/* Menu mobilne całkowicie ukryte - usunięte na prośbę użytkownika */}
        <div className="hidden">
          <MobileNavBar setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
        </div>
      </div>
    </div>
  );
}
