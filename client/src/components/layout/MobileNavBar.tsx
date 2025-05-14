import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { Home, ClipboardList, Menu, CalendarDays, User, Settings, Wrench, Truck } from 'lucide-react';

interface MobileNavBarProps {
  setSidebarOpen?: (open: boolean) => void;
  sidebarOpen?: boolean;
}

export default function MobileNavBar({ setSidebarOpen, sidebarOpen }: MobileNavBarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Określenie, czy zalogowany użytkownik jest transporterem
  const isTransporter = 
    user?.role === 'installer' && 
    user?.services?.some(s => s.toLowerCase().includes('transport'));
  
  // Sprawdzanie, czy użytkownik jest zalogowany
  if (!user) return null;

  // Funkcja przełączająca stan menu bocznego
  const toggleSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    if (setSidebarOpen) {
      setSidebarOpen(!sidebarOpen);
    }
  };
  
  // Funkcja zamykająca menu boczne przy kliknięciu dowolnej ikony nawigacyjnej
  const closeMenu = () => {
    if (setSidebarOpen && sidebarOpen) {
      setSidebarOpen(false);
    }
  };
  
  return (
    <div className="md:hidden bg-white border-t border-gray-200 opacity-0 h-2" style={{boxShadow: 'none'}}>
      <div className="hidden flex-wrap justify-around items-center h-2 px-1">
        {/* Dla transporterów - priorytetem jest transport */}
        {isTransporter ? (
          <>
            <Link href="/orders" onClick={closeMenu}>
              <div className={`mobile-nav-item ${location.startsWith('/orders') ? 'text-blue-600' : 'text-gray-500'}`}>
                <Truck className="h-6 w-6" />
                <span className="text-xs mt-1">Transport</span>
              </div>
            </Link>
            
            <Link href="/" onClick={closeMenu}>
              <div className={`mobile-nav-item ${location === '/' ? 'text-blue-600' : 'text-gray-500'}`}>
                <Home className="h-6 w-6" />
                <span className="text-xs mt-1">Główna</span>
              </div>
            </Link>
          </>
        ) : (
          <>
            <Link href="/" onClick={closeMenu}>
              <div className={`mobile-nav-item ${location === '/' ? 'text-blue-600' : 'text-gray-500'}`}>
                <Home className="h-6 w-6" />
                <span className="text-xs mt-1">Główna</span>
              </div>
            </Link>
            
            <Link href="/orders" onClick={closeMenu}>
              <div className={`mobile-nav-item ${location.startsWith('/orders') ? 'text-blue-600' : 'text-gray-500'}`}>
                <ClipboardList className="h-6 w-6" />
                <span className="text-xs mt-1">Zlecenia</span>
              </div>
            </Link>
            
            {(user.role === 'installer' || user.role === 'company') && (
              <Link href={user.role === 'installer' ? "/installer/schedule" : "/company/schedule"} onClick={closeMenu}>
                <div className={`mobile-nav-item ${location === (user.role === 'installer' ? '/installer/schedule' : '/company/schedule') ? 'text-blue-600' : 'text-gray-500'}`}>
                  <CalendarDays className="h-6 w-6" />
                  <span className="text-xs mt-1">Grafik</span>
                </div>
              </Link>
            )}
            
            {(user.role === 'admin' || user.role === 'worker') && (
              <Link href="/salesplan" onClick={closeMenu}>
                <div className={`mobile-nav-item ${location === '/salesplan' ? 'text-blue-600' : 'text-gray-500'}`}>
                  <CalendarDays className="h-6 w-6" />
                  <span className="text-xs mt-1">Plan</span>
                </div>
              </Link>
            )}
          </>
        )}
        
        <a href="#" onClick={toggleSidebar}>
          <div className={`mobile-nav-item ${sidebarOpen ? 'text-blue-600' : 'text-gray-500'}`}>
            <Menu className="h-6 w-6" id="mobile-menu-toggle" />
            <span className="text-xs mt-1">Menu</span>
          </div>
        </a>
        
        {user.role === 'company' && (
          <Link href="/company/installers" onClick={closeMenu}>
            <div className={`mobile-nav-item ${location === '/company/installers' ? 'text-blue-600' : 'text-gray-500'}`}>
              <User className="h-6 w-6" />
              <span className="text-xs mt-1">Montażyści</span>
            </div>
          </Link>
        )}
        
        {user.role === 'admin' && (
          <Link href="/users" onClick={closeMenu}>
            <div className={`mobile-nav-item ${location === '/users' ? 'text-blue-600' : 'text-gray-500'}`}>
              <User className="h-6 w-6" />
              <span className="text-xs mt-1">Użytkownicy</span>
            </div>
          </Link>
        )}
        

      </div>
    </div>
  );
}