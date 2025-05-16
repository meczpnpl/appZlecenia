import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Input } from '@/components/ui/input';
import { SavedFilters } from '@/components/SavedFilters';

// Faktyczne statusy z systemu
const INSTALLATION_STATUSES = [
  { value: 'nowe', label: 'Nowe' },
  { value: 'zaplanowany', label: 'Zaplanowany' },
  { value: 'w trakcie', label: 'W trakcie' },
  { value: 'zakończony', label: 'Zakończony' },
  { value: 'reklamacja', label: 'Reklamacja' }
];

const TRANSPORT_STATUSES = [
  { value: 'skompletowany', label: 'Skompletowany' },
  { value: 'zaplanowany', label: 'Zaplanowany' },
  { value: 'dostarczony', label: 'Dostarczony' }
];
import { 
  Eye, Plus, Search, Filter, X, CalendarClock, Phone, MapPin, 
  Navigation, Calendar, Loader2, Pencil, Truck, Hammer, 
  Check, CheckCircle, CalendarDays, Clock, Calendar as CalendarIcon,
  SlidersHorizontal, Tag, XCircle, Home, DoorOpen, Download, ArrowRight,
  Bookmark, Save
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Order } from '@shared/schema';
import { formatDate, addDays, startOfDay, endOfDay, isSameDay, isWithinInterval } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Interfejsy do filtrowania
interface ActiveFilter {
  id: string;
  type: 'status' | 'transportStatus' | 'installationDate' | 'transportDate' | 'dateRange' | 'serviceType' | 'settlement' | 'transport' | 'store';
  label: string;
  value: string | { from?: Date, to?: Date } | boolean | number;
}

interface FilterGroup {
  type: string;
  title: string;
  items: {
    id: string;
    label: string;
    value: string | { from?: Date, to?: Date } | boolean;
  }[];
}

// Helper to get badge color based on status
function getStatusBadgeVariant(status: string | null | undefined) {
  if (!status) return 'bg-gray-100 text-gray-800 border-gray-200';
  
  // Przekształć status na małe litery dla spójności
  const normalizedStatus = status.toLowerCase();
  
  switch (normalizedStatus) {
    // Statusy montażu
    case 'nowe':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'w trakcie':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'zakończony':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'reklamacja':
      return 'bg-red-100 text-red-800 border-red-200';
    
    // Status 'zaplanowany' - używany zarówno dla montażu jak i transportu
    case 'zaplanowany':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    
    // Ujednolicone statusy transportu
    case 'skompletowany':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'dostarczony':
      return 'bg-green-100 text-green-800 border-green-200';
      
    // Stare statusy transportu dla kompatybilności
    case 'gotowe do transportu':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'transport zaplanowany':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'w drodze':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'dostarczono':
    case 'transport dostarczony':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'problem z transportem':
      return 'bg-red-100 text-red-800 border-red-200';
      
    // Pozostałe statusy
    case 'złożone':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'transport wykonany':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'w realizacji':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'zakończone':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'zafakturowane':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    
    // Obsługa starych formatów
    case 'zlecenie złożone':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'montaż zaplanowany':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'w trakcie montażu':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'montaż wykonany':
      return 'bg-green-100 text-green-800 border-green-200';
    
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Funkcja do formatowania statusów transportu na bardziej zwięzłe
function formatTransportStatus(status: string | null | undefined): string {
  if (!status) return 'Brak';
  switch (status) {
    // Ujednolicone nazwy statusów
    case 'skompletowany':
      return 'Skompletowany';
    case 'zaplanowany':
      return 'Zaplanowany';
    case 'dostarczony':
      return 'Dostarczony';
    
    // Stare formaty statusów transportu dla kompatybilności
    case 'gotowe do transportu':
      return 'Skompletowany';
    case 'transport zaplanowany':
      return 'Zaplanowany';
    case 'w drodze':
      return 'W drodze';
    case 'dostarczono':
    case 'transport dostarczony':
      return 'Dostarczony';
    case 'problem z transportem':
      return 'Problem';
    default:
      return status;
  }
}

// Funkcja do formatowania statusów montażu na bardziej zwięzłe
function formatInstallationStatus(status: string | null | undefined): string {
  if (!status) return 'Nowe';
  switch (status) {
    // Ujednolicone nazwy statusów:
    case 'nowe':
      return 'Nowe';
    case 'zaplanowany':
      return 'Zaplanowany';
    case 'w trakcie':
      return 'W trakcie';
    case 'zakończony':
      return 'Zakończony';
    case 'reklamacja':
      return 'Reklamacja';
    
    // Stare formaty dla kompatybilności:
    case 'montaż zaplanowany':
      return 'Zaplanowany';
    case 'w trakcie montażu':
      return 'W trakcie';
    case 'montaż wykonany':
      return 'Zakończony';
    case 'zlecenie złożone':
      return 'Nowe';
      
    // Potencjalnie inne statusy, które mogą wystąpić w bazie:
    default:
      return status;
  }
}

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState(user?.storeId ? user.storeId.toString() : 'all');
  
  // Stan dla kalendarzy i popoverów
  const [editingTransportDateOrderId, setEditingTransportDateOrderId] = useState<number | null>(null);
  const [editingInstallationDateOrderId, setEditingInstallationDateOrderId] = useState<number | null>(null);
  const [transportDate, setTransportDate] = useState<Date | undefined>(undefined);
  const [installationDate, setInstallationDate] = useState<Date | undefined>(undefined);
  const [selectedTransportStatus, setSelectedTransportStatus] = useState<string>('');
  const [selectedInstallationStatus, setSelectedInstallationStatus] = useState<string>('');
  const [selectedInstallerId, setSelectedInstallerId] = useState<number | undefined>();
  const [selectedTransporterId, setSelectedTransporterId] = useState<number | undefined>();
  
  // Stan do przechowywania listy dostępnych montażystów i transporterów
  const [availableInstallers, setAvailableInstallers] = useState<any[]>([]);
  const [availableTransporters, setAvailableTransporters] = useState<any[]>([]);
  
  // Stan dla zaawansowanego filtrowania
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  
  // Dodatkowy stan dla filtrowania mobilnego
  const [settlementFilter, setSettlementFilter] = useState<boolean | null>(null);
  
  // Funkcja otwierająca dialog filtrowania (dla desktopa)
  const openFilterDialog = () => {
    console.log("Otwieranie dialogu filtrowania");
    setIsFilterDialogOpen(true);
  };
  
  // Usunięte - już zdefiniowane niżej

  // Funkcja otwierająca drawer filtrowania (dla mobile)
  const openFilterDrawer = () => {
    console.log("Otwieranie drawera filtrowania z ulepszonymi kontrolkami");
    console.log("Aktualny stan filtrów: ", {
      dateOffset: currentDateOffset,
      activeFilters
    });
    setIsFilterDrawerOpen(true);
  };
  
  // Pomocnicza funkcja dla testów
  const testFilterDialog = () => {
    console.log("Stan dialogu:", isFilterDialogOpen);
    console.log("Stan drawera:", isFilterDrawerOpen);
    setIsFilterDialogOpen(!isFilterDialogOpen);
  };
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [dateFilterStart, setDateFilterStartOriginal] = useState<Date | undefined>(undefined);
  const [dateFilterEnd, setDateFilterEndOriginal] = useState<Date | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<'installationDate' | 'transportDate'>('installationDate');
  
  // Dodajemy własną funkcję do ustawiania daty początkowej z automatycznym zamykaniem kalendarza
  const setDateFilterStart = (date: Date | undefined) => {
    setDateFilterStartOriginal(date);
    
    // Automatycznie zamknij kalendarz po wyborze daty
    if (date) {
      // Symulujemy naciśnięcie klawisza Escape, co zawsze zamyka otwarty dialog
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
  };
  
  // Dodajemy własną funkcję do ustawiania daty końcowej z automatycznym zamykaniem kalendarza
  const setDateFilterEnd = (date: Date | undefined) => {
    setDateFilterEndOriginal(date);
    
    // Automatycznie zamknij kalendarz po wyborze daty
    if (date) {
      // Symulujemy naciśnięcie klawisza Escape, co zawsze zamyka otwarty dialog
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
  };
  const [currentDateOffset, setCurrentDateOffset] = useState<number>(0); // 0 = dzisiaj, 1 = jutro, -1 = wczoraj
  
  // Funkcja do ładowania domyślnego filtra
  const loadDefaultFilter = async () => {
    try {
      // Pytanie do API o domyślny filtr użytkownika
      const response = await fetch('/api/filters/default');
      
      // Jeśli znaleziono domyślny filtr, użyj go
      if (response.ok) {
        const defaultFilter = await response.json();
        console.log('Znaleziono domyślny filtr:', defaultFilter);
        
        if (defaultFilter && defaultFilter.filtersData) {
          // Aplikuj zapisane filtry z konwersją dat
          const filters = defaultFilter.filtersData;
          
          // Deduplikacja filtrów - używamy obiektu, żeby zapewnić unikalność typów
          const uniqueFilters = {} as Record<string, any>;
          
          // Konwertujemy daty i jednocześnie deduplikujemy
          filters.forEach((filter: any) => {
            if (filter.type === 'dateRange' && typeof filter.value === 'object') {
              uniqueFilters[filter.type] = {
                ...filter,
                value: {
                  from: filter.value.from ? new Date(filter.value.from) : undefined,
                  to: filter.value.to ? new Date(filter.value.to) : undefined
                }
              };
            } else {
              uniqueFilters[filter.type] = filter;
            }
          });
          
          // Konwersja z powrotem do tablicy
          const parsedFilters = Object.values(uniqueFilters);
          setActiveFilters(parsedFilters);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Błąd podczas ładowania domyślnego filtra:', error);
      return false;
    }
  };
  
  // Zapis/odczyt filtrów
  useEffect(() => {
    // Funkcja do inicjalizacji filtrów
    const initFilters = async () => {
      try {
        // Najpierw próbujemy załadować domyślny filtr
        const hasDefaultFilter = await loadDefaultFilter();
        
        // Jeśli nie ma domyślnego, próbujemy z localStorage
        if (!hasDefaultFilter) {
          const savedFilters = localStorage.getItem('orderFilters');
          if (savedFilters) {
            const filters = JSON.parse(savedFilters);
            
            // Deduplikacja filtrów - używamy obiektu, żeby zapewnić unikalność typów
            const uniqueFilters = {} as Record<string, any>;
            
            // Konwertujemy daty i jednocześnie deduplikujemy
            filters.forEach((filter: any) => {
              if (filter.type === 'dateRange' && typeof filter.value === 'object') {
                uniqueFilters[filter.type] = {
                  ...filter,
                  value: {
                    from: filter.value.from ? new Date(filter.value.from) : undefined,
                    to: filter.value.to ? new Date(filter.value.to) : undefined
                  }
                };
              } else {
                uniqueFilters[filter.type] = filter;
              }
            });
            
            // Konwersja z powrotem do tablicy
            const parsedFilters = Object.values(uniqueFilters);
            setActiveFilters(parsedFilters);
          }
        }
      } catch (error) {
        console.error('Error loading filters:', error);
        // Jeśli wystąpi błąd, wyczyść localStorage i zresetuj filtry
        localStorage.removeItem('orderFilters');
        setActiveFilters([]);
      }
    };
    
    // Wywołaj funkcję inicjalizującą filtry
    initFilters();
  }, []);
  
  // Automatyczne zapisywanie filtrów do localStorage zostało przeniesione
  // bezpośrednio do metod addFilter/removeFilter/clearAllFilters
  
  // Kiedy użytkownik otwiera kalendarz transportu, zamykamy kalendarz montażu i odwrotnie

  const openTransportDateEditor = (orderId: number, date?: Date | null) => {
    setEditingInstallationDateOrderId(null);
    setEditingTransportDateOrderId(orderId);
    
    // Znajdź aktualny status transportu dla tego zlecenia
    const order = ordersQuery.data?.find(o => o.id === orderId);
    if (order?.transportStatus) {
      setSelectedTransportStatus(order.transportStatus);
    } else {
      setSelectedTransportStatus('transport zaplanowany');
    }
    
    // Ustaw wybranego transportera jeśli jest przypisany do zlecenia
    if (order?.transporterId) {
      setSelectedTransporterId(order.transporterId);
    } else {
      setSelectedTransporterId(undefined);
    }
    
    if (date) {
      setTransportDate(new Date(date));
    } else {
      setTransportDate(undefined);
    }
    
    // Pobierz listę dostępnych transporterów dla firm z pracownikami
    if (user?.role === 'company' && user?.companyOwnerOnly === false) {
      // Funkcja do pobierania dostępnych transporterów
      const fetchTransporters = async () => {
        try {
          const response = await fetch('/api/transporters');
          
          if (response.ok) {
            const transporters = await response.json();
            // Filtrowanie transporterów po usłudze transportu
            const filteredTransporters = transporters.filter((transporter: any) => 
              transporter.services?.some((s: string) => s === 'Transport')
            );
            setAvailableTransporters(filteredTransporters);
          } else {
            console.error('Błąd podczas pobierania transporterów:', await response.text());
            setAvailableTransporters([]);
          }
        } catch (error) {
          console.error('Błąd podczas pobierania transporterów:', error);
          setAvailableTransporters([]);
        }
      };
      
      fetchTransporters();
    }
  };
  
  // Funkcja do pobierania dostępnych montażystów dla firmy
  const fetchAvailableInstallers = async (serviceType: string) => {
    try {
      // Określamy typ usługi do filtrowania montażystów
      const serviceFilter = serviceType === 'montaż drzwi' ? 'Montaż drzwi' : 'Montaż podłogi';
      const response = await fetch('/api/installers');
      
      if (response.ok) {
        const installers = await response.json();
        // Filtrowanie montażystów po odpowiedniej specjalizacji
        const filteredInstallers = installers.filter((installer: any) => 
          installer.services?.some((s: string) => s === serviceFilter)
        );
        setAvailableInstallers(filteredInstallers);
      } else {
        console.error('Błąd podczas pobierania montażystów:', await response.text());
        setAvailableInstallers([]);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania montażystów:', error);
      setAvailableInstallers([]);
    }
  };
  


  const openInstallationDateEditor = (orderId: number, date?: Date | null) => {
    setEditingTransportDateOrderId(null);
    setEditingInstallationDateOrderId(orderId);
    
    // Znajdź aktualny status montażu dla tego zlecenia
    const order = ordersQuery.data?.find(o => o.id === orderId);
    if (order?.installationStatus) {
      setSelectedInstallationStatus(order.installationStatus);
    } else {
      setSelectedInstallationStatus('montaż zaplanowany');
    }
    
    // Ustaw wybranego instalatora jeśli jest przypisany do zlecenia
    if (order?.installerId) {
      setSelectedInstallerId(order.installerId);
    } else {
      setSelectedInstallerId(undefined);
    }
    
    if (date) {
      setInstallationDate(new Date(date));
    } else {
      setInstallationDate(undefined);
    }
    
    // Pobierz listę dostępnych montażystów dla firm z pracownikami
    if (user?.role === 'company' && user?.companyOwnerOnly === false && order) {
      // Wywołaj funkcję pobierania montażystów z odpowiednią specjalizacją
      fetchAvailableInstallers(order.serviceType);
    }
  };
  
  // Określenie, czy zalogowany użytkownik jest transporterem
  const isTransporter = 
    user?.role === 'installer' && 
    user?.services?.some(s => s.toLowerCase().includes('transport'));
    
  // Określenie, czy zalogowany użytkownik jest montażystą
  const isInstaller = 
    user?.role === 'installer' || 
    user?.services?.some(s => s.toLowerCase().includes('montaż'));
    
  // Sprawdzenie czy to firma jednoosobowa (montażysta z przypisaną firmą)
  // lub zwykła firma - chcemy, żeby widok był identyczny dla obu typów firm.
  // UWAGA: Zawsze zwracamy true dla firm i montażystów firmowych, 
  // aby zapewnić pełną identyczność widoków
  const isOnePersonCompany = 
    (user?.role === 'installer' && 
    user?.companyId !== undefined && 
    user?.companyName) || 
    (user?.role === 'company');
  
  // Uprawnienia do edycji pól finansowych mają mieć:
  // 1. admin
  // 2. kierownicy i zastępcy kierowników w sklepach
  // 3. właściciel firmy montażowej, który NIE jest montażystą (companyOwnerOnly = true)
  // !! Pozostali NIE mają dostępu do edycji pól finansowych:
  // - Zwykli pracownicy sklepu (nie kierownicy)
  // - Montażyści (nawet jeśli są przypisani do firmy, która jest właścicielem zlecenia)
  // - Właściciele firm, którzy są również montażystami (companyOwnerOnly = false)
  const canModifyFinancialStatus = 
    user?.role === 'admin' || 
    (user?.role === 'worker' && (user?.position === 'kierownik' || user?.position === 'zastępca')) ||
    (user?.role === 'company' && user?.companyOwnerOnly === true);
    
  // Prawo do oznaczenia "do rozliczenia" - rozszerzamy o firmy jednoosobowe
  const canMarkForSettlement = canModifyFinancialStatus || isOnePersonCompany;
    
  // UWAGA: W widoku listy pokazujemy przyciski tylko uprawnionym użytkownikom
  // Polegamy również na serwerowym sprawdzeniu uprawnień poprzez middleware canEditFinancialFields
  
  // Only allow admins to change store filter
  const canChangeStore = user?.role === 'admin';
  
  // Funkcja dodająca nowy filtr
  const addFilter = (filter: ActiveFilter) => {
    // Dla statusów montażu i transportu zezwalamy na wiele filtrów tego samego typu
    if (filter.type === 'status' || filter.type === 'transportStatus') {
      // Sprawdź czy identyczny filtr już istnieje
      const filterAlreadyExists = activeFilters.some(
        f => f.type === filter.type && f.value === filter.value
      );
      
      // Jeśli filtr już istnieje, nie dodawaj go ponownie
      if (filterAlreadyExists) {
        return;
      }
      
      // Dodaj nowy filtr do istniejących
      const newFilters = [...activeFilters, filter];
      setActiveFilters(newFilters);
      
      // Zapisz aktualne filtry w localStorage
      try {
        localStorage.setItem('orderFilters', JSON.stringify(newFilters));
      } catch (error) {
        console.error('Error saving filters to localStorage', error);
      }
    } else {
      // Dla pozostałych typów filtrów zachowujemy stare zachowanie - tylko jeden filtr danego typu
      const updatedFilters = activeFilters.filter(f => f.type !== filter.type);
      const newFilters = [...updatedFilters, filter];
      setActiveFilters(newFilters);
      
      // Zapisz aktualne filtry w localStorage
      try {
        localStorage.setItem('orderFilters', JSON.stringify(newFilters));
      } catch (error) {
        console.error('Error saving filters to localStorage', error);
      }
    }
  };
  
  // Funkcja usuwająca filtr
  const removeFilter = (filterId: string) => {
    const updatedFilters = activeFilters.filter(filter => filter.id !== filterId);
    setActiveFilters(updatedFilters);
    
    // Zapisz zaktualizowane filtry w localStorage
    try {
      localStorage.setItem('orderFilters', JSON.stringify(updatedFilters));
    } catch (error) {
      console.error('Error saving filters to localStorage', error);
    }
  };
  
  // Funkcja czyszcząca wszystkie filtry
  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchTerm('');
    setStatusFilter('all');
    setStoreFilter(user?.storeId ? user.storeId.toString() : 'all');
    setCurrentDateOffset(0); // Reset offsetu daty
    
    // Wyczyść również localStorage
    try {
      localStorage.removeItem('orderFilters');
    } catch (error) {
      console.error('Error clearing filters from localStorage', error);
    }
  };
  

  
  // Funkcja dodająca filtr zakresu dat (z kalendarza)
  const addDateRangeFilter = () => {
    if (dateFilterStart) {
      const filterLabel = `${dateFilterType === 'installationDate' ? 'Montaż' : 'Transport'}: ${formatDate(dateFilterStart)}${dateFilterEnd ? ` - ${formatDate(dateFilterEnd)}` : ''}`;
      
      const filter: ActiveFilter = {
        id: `date-range-${dateFilterType}-${Date.now()}`,
        type: 'dateRange',
        label: filterLabel,
        value: {
          from: startOfDay(dateFilterStart),
          to: dateFilterEnd ? endOfDay(dateFilterEnd) : endOfDay(dateFilterStart)
        }
      };
      
      addFilter(filter);
      
      // Resetuj pola kalendarza
      setDateFilterStart(undefined);
      setDateFilterEnd(undefined);
      
      // Zamknij dialog po dodaniu filtra
      setIsFilterDialogOpen(false);
      
      // Odśwież dane
      ordersQuery.refetch();
    }
  };
  
  // Ujednolicona funkcja do dodawania szybkich filtrów datowych
  const addQuickDateFilter = (option: string) => {
    const today = new Date();
    let filter: ActiveFilter;
    let filterLabel = '';
    let fromDate: Date;
    let toDate: Date;
    
    switch (option) {
      case 'today':
        filterLabel = 'Dzisiaj';
        fromDate = startOfDay(today);
        toDate = endOfDay(today);
        break;
      case 'tomorrow':
        const tomorrow = addDays(today, 1);
        filterLabel = 'Jutro';
        fromDate = startOfDay(tomorrow);
        toDate = endOfDay(tomorrow);
        break;
      case 'thisWeek':
        const endOfWeek = addDays(today, 7);
        filterLabel = 'Ten tydzień';
        fromDate = startOfDay(today);
        toDate = endOfDay(endOfWeek);
        break;
      default:
        return;
    }
    
    // Określanie typu filtra (montaż/transport) na podstawie roli użytkownika
    const typePrefix = isInstaller ? 'Montaż' : 'Transport';
    
    filter = {
      id: `date-quick-${option}-${Date.now()}`,
      type: 'dateRange',
      label: `${typePrefix}: ${filterLabel}`,
      value: {
        from: fromDate,
        to: toDate
      }
    };
    
    addFilter(filter);
  };
  
  // Funkcja dodająca filtr statusu montażu
  const addStatusFilter = (status: string, label: string) => {
    const filter: ActiveFilter = {
      id: `status-${status}-${Date.now()}`,
      type: 'status',
      label: label,
      value: status
    };
    addFilter(filter);
    // Odświeżamy dane po dodaniu filtra statusu
    ordersQuery.refetch();
  };
  
  // Funkcja dodająca filtr statusu transportu
  const addTransportStatusFilter = (status: string, label: string) => {
    const filter: ActiveFilter = {
      id: `transport-status-${status}-${Date.now()}`,
      type: 'transportStatus',
      label: label,
      value: status
    };
    addFilter(filter);
    // Odświeżamy dane po dodaniu filtra statusu transportu
    ordersQuery.refetch();
  };
  
  // Funkcja dodająca filtr typu usługi
  const addServiceTypeFilter = (serviceType: string) => {
    const label = serviceType === 'Montaż podłogi' ? 'Usługa: Podłogi' : 'Usługa: Drzwi';
    
    const filter: ActiveFilter = {
      id: `service-type-${Date.now()}`,
      type: 'serviceType',
      label: label,
      value: serviceType
    };
    
    addFilter(filter);
  };
  
  // Funkcja obsługująca filtry z przesunięciem dat (wczoraj, dziś, jutro itd.)
  const addDateOffsetFilter = (offset: number) => {
    // Oblicz nowy offset
    let newOffset: number;
    
    if (offset === -1) {
      // Jeśli offset jest null, ustawiamy na -1, w przeciwnym razie zmniejszamy o 1
      newOffset = currentDateOffset === null ? -1 : currentDateOffset - 1;
    } else if (offset === 1) {
      // Jeśli offset jest null, ustawiamy na 1, w przeciwnym razie zwiększamy o 1
      newOffset = currentDateOffset === null ? 1 : currentDateOffset + 1;
    } else {
      newOffset = offset; // 0 = dziś
    }
    setCurrentDateOffset(newOffset);
    
    // Oblicz konkretną datę
    const today = new Date();
    const targetDate = addDays(today, newOffset);
    
    // Przygotuj etykietę 
    let labelText: string;
    if (newOffset === 0) labelText = 'Dzisiaj';
    else if (newOffset === -1) labelText = 'Wczoraj';
    else if (newOffset === 1) labelText = 'Jutro';
    else if (newOffset < 0) labelText = `${Math.abs(newOffset)} dni temu`;
    else labelText = `Za ${newOffset} dni`;
    
    // Określ typ filtra zależnie od roli
    const filterTypePrefix = isInstaller ? 'Montaż' : 'Transport';
    
    // Utwórz filtr
    const filter: ActiveFilter = {
      id: `date-offset-${Date.now()}`, 
      type: 'dateRange',
      label: `${filterTypePrefix}: ${labelText}`,
      value: {
        from: startOfDay(targetDate),
        to: endOfDay(targetDate)
      }
    };
    
    // Zastosuj filtr
    addFilter(filter);
  };
  
  // Funkcja dodająca filtr do rozliczenia
  const addSettlementFilter = (value: boolean) => {
    const filter: ActiveFilter = {
      id: `settlement-${value ? 'yes' : 'no'}-${Date.now()}`,
      type: 'settlement',
      label: value ? 'Do rozliczenia' : 'Nie do rozliczenia',
      value: value
    };
    addFilter(filter);
    // Po dodaniu filtra odświeżamy dane
    ordersQuery.refetch();
    // Zamknij dialog/drawer po dodaniu filtra
    setIsFilterDialogOpen(false);
    setIsFilterDrawerOpen(false);
  };
  
  // Funkcja dodająca filtr transportu
  const addTransportFilter = (value: boolean) => {
    const filter: ActiveFilter = {
      id: `transport-${value ? 'yes' : 'no'}-${Date.now()}`,
      type: 'transport',
      label: value ? 'Z transportem' : 'Bez transportu',
      value: value
    };
    addFilter(filter);
    // Po dodaniu filtra odświeżamy dane
    ordersQuery.refetch();
  };
  
  // Funkcja dodająca filtr sklepu
  const addStoreFilter = (storeId: number, storeName: string) => {
    const filter: ActiveFilter = {
      id: `store-${storeId}-${Date.now()}`,
      type: 'store',
      label: `Sklep: ${storeName}`,
      value: storeId
    };
    addFilter(filter);
  };
  
  // Przygotowanie URL z parametrami zapytania
  const getOrdersUrl = () => {
    let url = '/api/orders';
    const params = new URLSearchParams();
    
    if (searchTerm) params.append('search', searchTerm);
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (storeFilter !== 'all') params.append('store', storeFilter);
    
    // Dodajemy parametry filtrów zakresu dat
    const dateRangeFilters = activeFilters.filter(f => f.type === 'dateRange');
    
    // Przetwarzaj każdy filtr daty osobno
    dateRangeFilters.forEach(dateRangeFilter => {
      // Sprawdź, czy to filtr daty montażu czy transportu
      const isTransportDate = dateRangeFilter.label.toLowerCase().includes('transport');
      const dateType = isTransportDate ? 'transportDate' : 'installationDate';
      
      // Pobierz wartości dat z filtra
      const dateValue = dateRangeFilter.value as { from?: Date, to?: Date };
      
      // Dodaj daty do parametrów URL
      if (dateValue.from) {
        // Konwertuj obiekt Date na ISO string
        params.append(`${dateType}From`, dateValue.from.toISOString());
        console.log(`Dodaję parametr ${dateType}From:`, dateValue.from.toISOString());
      }
      
      if (dateValue.to) {
        // Konwertuj obiekt Date na ISO string
        params.append(`${dateType}To`, dateValue.to.toISOString());
        console.log(`Dodaję parametr ${dateType}To:`, dateValue.to.toISOString());
      }
    });
    
    // Dodaj zapis filtru w konsoli, żeby łatwiej było debugować
    console.log('Filtry dateRange:', dateRangeFilters);
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    console.log('Pełny URL zapytania:', url);
    return url;
  };
  
  // Pobieranie danych z API z właściwym URL zawierającym parametry
  const ordersQuery = useQuery<Order[]>({
    queryKey: [getOrdersUrl(), searchTerm, statusFilter, storeFilter, ...activeFilters.map(f => f.id)],
  });
  const { data: fetchedOrders, isLoading, error } = ordersQuery;
  
  // Zmodyfikowana funkcja filtrowania zamówień na podstawie aktywnych filtrów
  const filterOrders = (orders: Order[] | undefined) => {
    if (!orders) return [];
    if (activeFilters.length === 0) return orders;
    
    // Grupujemy filtry według typu
    const statusFilters: string[] = [];
    const transportStatusFilters: string[] = [];
    const serviceTypeFilters: string[] = [];
    const settlementFilters: boolean[] = [];
    const transportFilters: boolean[] = [];
    const storeFilters: number[] = [];
    const dateRangeFilters: Array<{label: string, value: {from?: Date, to?: Date}}> = [];
    
    // Organizujemy filtry według typu
    activeFilters.forEach(filter => {
      switch (filter.type) {
        case 'status':
          statusFilters.push(filter.value as string);
          break;
        case 'transportStatus':
          transportStatusFilters.push(filter.value as string);
          break;
        case 'serviceType':
          serviceTypeFilters.push(filter.value as string);
          break;
        case 'settlement':
          settlementFilters.push(filter.value as boolean);
          break;
        case 'transport':
          transportFilters.push(filter.value as boolean);
          break;
        case 'store':
          storeFilters.push(Number(filter.value));
          break;
        case 'dateRange':
          dateRangeFilters.push({
            label: filter.label,
            value: filter.value as {from?: Date, to?: Date}
          });
          break;
      }
    });
    
    // Filtrujemy zamówienia
    return orders.filter(order => {
      // Sprawdzanie statusu montażu (OR)
      if (statusFilters.length > 0) {
        if (!statusFilters.includes(order.installationStatus || '')) {
          return false;
        }
      }
      
      // Sprawdzanie statusu transportu (OR)
      if (transportStatusFilters.length > 0) {
        if (!transportStatusFilters.includes(order.transportStatus || '')) {
          return false;
        }
      }
      
      // Sprawdzanie typu usługi (OR)
      if (serviceTypeFilters.length > 0) {
        if (!serviceTypeFilters.includes(order.serviceType)) {
          return false;
        }
      }
      
      // Sprawdzanie statusu rozliczenia (OR)
      if (settlementFilters.length > 0) {
        if (!settlementFilters.includes(order.willBeSettled || false)) {
          return false;
        }
      }
      
      // Sprawdzanie transportu (OR)
      if (transportFilters.length > 0) {
        // Przekształć null/undefined w false lub zachowaj prawdziwą wartość boolean
        const orderHasTransport = order.withTransport === true;
        if (!transportFilters.includes(orderHasTransport)) {
          return false;
        }
      }
      
      // Sprawdzanie sklepu (OR)
      if (storeFilters.length > 0) {
        if (!storeFilters.includes(order.storeId || 0)) {
          return false;
        }
      }
      
      // Sprawdzanie przedziału dat (AND)
      for (const dateFilter of dateRangeFilters) {
        const dateRange = dateFilter.value;
        if (!dateRange.from) continue;
        
        let dateToCheck: Date | null = null;
        
        if (dateFilter.label.toLowerCase().includes('transport')) {
          if (!order.transportDate) return false;
          dateToCheck = new Date(order.transportDate);
        } else {
          if (!order.installationDate) return false;
          dateToCheck = new Date(order.installationDate);
        }
        
        if (!dateToCheck || isNaN(dateToCheck.getTime())) return false;
        
        if (dateRange.to) {
          if (!isWithinInterval(dateToCheck, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to)
          })) {
            return false;
          }
        } else {
          if (!isSameDay(dateToCheck, dateRange.from)) {
            return false;
          }
        }
      }
      
      // Jeśli zamówienie przeszło wszystkie filtry, zwracamy true
      return true;
    });
  };
  


  // Filtrujemy zamówienia
  const filteredOrders = filterOrders(fetchedOrders);
  
  // Mutation for updating order financial status
  const updateOrderMutation = useMutation({
    mutationFn: async (params: { id: number, field: string, value: boolean }) => {
      const { id, field, value } = params;
      const response = await apiRequest(
        'PATCH', 
        `/api/orders/${id}/financial-status`, 
        { [field]: value }
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować statusu zamówienia');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate orders query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      // Invalidate specific order queries to ensure details page is updated
      if (fetchedOrders) {
        fetchedOrders.forEach((order) => {
          queryClient.invalidateQueries({ queryKey: [`/api/orders/${order.id}`] });
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Dedykowana mutacja do aktualizacji statusu "do rozliczenia" dla firm jednoosobowych
  // Używa specjalnego endpointu, który omija middleware kontroli finansowej
  const updateSettlementStatusMutation = useMutation({
    mutationFn: async (params: { id: number, value: boolean }) => {
      const { id, value } = params;
      const response = await apiRequest(
        'PATCH', 
        `/api/orders/${id}/settlement-status`, 
        { value }
      );
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować statusu rozliczenia');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate orders query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      // Invalidate specific order queries to ensure details page is updated
      if (fetchedOrders) {
        fetchedOrders.forEach((order) => {
          queryClient.invalidateQueries({ queryKey: [`/api/orders/${order.id}`] });
        });
      }
      toast({
        title: 'Status zaktualizowany',
        description: 'Status "do rozliczenia" został zaktualizowany',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  const handleToggleInvoice = (orderId: number, currentValue: boolean) => {
    if (!canModifyFinancialStatus) return;
    
    updateOrderMutation.mutate({ 
      id: orderId, 
      field: 'invoiceIssued', 
      value: !currentValue 
    });
  };
  
  const handleToggleSettlement = (orderId: number, currentValue: boolean) => {
    // Firmy jednoosobowe też mogą oznaczać zlecenia jako "do rozliczenia"
    if (!canModifyFinancialStatus && !isOnePersonCompany) return;
    
    // Użyj dedykowanego endpointu dla firm jednoosobowych, które nie mają pełnych uprawnień finansowych
    if (isOnePersonCompany && !canModifyFinancialStatus) {
      // Wywołaj dedykowaną mutację dla firm jednoosobowych
      updateSettlementStatusMutation.mutate({
        id: orderId,
        value: !currentValue
      });
    } else {
      // Standardowa ścieżka dla użytkowników z pełnymi uprawnieniami finansowymi
      updateOrderMutation.mutate({ 
        id: orderId, 
        field: 'willBeSettled', 
        value: !currentValue 
      });
    }
  };
  
  const handleCreateNewOrder = () => {
    setLocation('/orders/create');
  };
  
  const handleViewOrder = (id: number) => {
    setLocation(`/orders/${id}`);
  };
  
  // Mutacja do aktualizacji daty transportu
  const updateTransportDateMutation = useMutation({
    mutationFn: async (params: { id: number; transportDate: Date; transportStatus?: string; transporterId?: number }) => {
      const { id, transportDate, transportStatus, transporterId } = params;
      // Pobieramy dane zlecenia, żeby uzyskać ID transportera - tylko jeśli nie mamy przekazanego
      let transporterIdToUse = transporterId;
      
      if (!transporterIdToUse) {
        const orderResponse = await apiRequest('GET', `/api/orders/${id}`);
        if (!orderResponse.ok) {
          throw new Error('Nie można pobrać danych zlecenia');
        }
        const orderData = await orderResponse.json();
        transporterIdToUse = orderData.transporterId || user?.id;
      }
      
      // Wysyłamy zarówno ID transportera jak i datę transportu oraz status
      const response = await apiRequest('PATCH', `/api/orders/${id}/assign-transporter`, {
        transporterId: transporterIdToUse,
        // Dostosujmy datę tak, aby uwzględniała strefę czasową
        transportDate: new Date(
          transportDate.getFullYear(),
          transportDate.getMonth(),
          transportDate.getDate(),
          12, 0, 0
        ).toISOString(),
        transportStatus: transportStatus || 'transport zaplanowany',
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować daty transportu');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate orders query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Data zaktualizowana',
        description: 'Data transportu została pomyślnie zaktualizowana',
      });
      // Clear state
      setEditingTransportDateOrderId(null);
      setTransportDate(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutacja do aktualizacji daty montażu
  const updateInstallationDateMutation = useMutation({
    mutationFn: async (params: { id: number; installationDate: Date; installationStatus?: string; installerId?: number }) => {
      const { id, installationDate, installationStatus, installerId } = params;
      // Pobieramy dane zlecenia, żeby uzyskać ID montażysty - tylko jeśli nie mamy przekazanego
      let installerIdToUse = installerId;
      
      if (!installerIdToUse) {
        const orderResponse = await apiRequest('GET', `/api/orders/${id}`);
        if (!orderResponse.ok) {
          throw new Error('Nie można pobrać danych zlecenia');
        }
        const orderData = await orderResponse.json();
        installerIdToUse = orderData.installerId || user?.id;
      }
      
      // Wysyłamy zarówno ID montażysty jak i datę montażu oraz status
      const response = await apiRequest('PATCH', `/api/orders/${id}/assign-installer`, {
        installerId: installerIdToUse,
        // Dostosujmy datę tak, aby uwzględniała strefę czasową
        installationDate: new Date(
          installationDate.getFullYear(),
          installationDate.getMonth(),
          installationDate.getDate(),
          12, 0, 0
        ).toISOString(),
        installationStatus: installationStatus || 'zaplanowany',
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować daty montażu');
      }
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate orders query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Data zaktualizowana',
        description: 'Data montażu została pomyślnie zaktualizowana',
      });
      // Clear state
      setEditingInstallationDateOrderId(null);
      setInstallationDate(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Obsługa aktualizacji daty transportu
  const handleUpdateTransportDate = (orderId: number) => {
    if (!transportDate) return;
    
    // Wysyłamy także status transportu, jeśli został wybrany
    const transportStatus = selectedTransportStatus || 'transport zaplanowany';
    
    // Pobieramy obecne zlecenie
    const currentOrder = ordersQuery.data?.find(o => o.id === orderId);
    
    // Dla firm z pracownikami, uwzględniamy wybranego transportera
    if (user?.role === 'company' && user?.companyOwnerOnly === false) {
      // Jeśli wybrano transportera, wysyłamy jego ID
      updateTransportDateMutation.mutate({
        id: orderId,
        transportDate,
        transportStatus,
        transporterId: selectedTransporterId
      });
    } else {
      // Dla firm jednoosobowych, używamy standardowej logiki
      updateTransportDateMutation.mutate({
        id: orderId,
        transportDate,
        transportStatus
      });
    }
    
    // Zamykamy kalendarz po wysłaniu żądania
    setEditingTransportDateOrderId(null);
    setSelectedTransportStatus('');
    setSelectedTransporterId(undefined);
  };
  
  // Obsługa aktualizacji daty montażu
  const handleUpdateInstallationDate = (orderId: number) => {
    if (!installationDate) return;
    
    // Wysyłamy także status montażu, jeśli został wybrany
    const installationStatus = selectedInstallationStatus || 'montaż zaplanowany';
    
    // Pobieramy obecne zlecenie
    const currentOrder = ordersQuery.data?.find(o => o.id === orderId);
    
    // Dla firm z pracownikami, uwzględniamy wybranego montażystę
    if (user?.role === 'company' && user?.companyOwnerOnly === false) {
      // Jeśli wybrano montażystę, wysyłamy jego ID
      updateInstallationDateMutation.mutate({
        id: orderId,
        installationDate,
        installationStatus,
        installerId: selectedInstallerId
      });
    } else {
      // Dla firm jednoosobowych, używamy standardowej logiki
      updateInstallationDateMutation.mutate({
        id: orderId,
        installationDate,
        installationStatus
      });
    }
    
    // Zamykamy kalendarz po wysłaniu żądania
    setEditingInstallationDateOrderId(null);
    setSelectedInstallationStatus('');
    setSelectedInstallerId(undefined);
  };
  
  // Can create orders logic
  const canCreateOrders = ['admin', 'worker'].includes(user?.role || '');
  
  // Komponent wyświetlający centralny kalendarz
  const CalendarDialog = () => {
    // Jeśli nie ma aktywnego kalendarza, nie renderujemy niczego
    if (!editingTransportDateOrderId && !editingInstallationDateOrderId) {
      return null;
    }

    // Ustalamy, który kalendarz jest otwarty
    const isTransportCalendar = editingTransportDateOrderId !== null;
    const currentDate = isTransportCalendar ? transportDate : installationDate;
    const setCurrentDate = isTransportCalendar ? setTransportDate : setInstallationDate;
    const orderId = isTransportCalendar ? editingTransportDateOrderId : editingInstallationDateOrderId;
    const handleUpdate = isTransportCalendar ? handleUpdateTransportDate : handleUpdateInstallationDate;
    const isPending = isTransportCalendar 
      ? updateTransportDateMutation.isPending 
      : updateInstallationDateMutation.isPending;
    const closeCalendar = () => {
      if (isTransportCalendar) {
        setEditingTransportDateOrderId(null);
        setTransportDate(undefined);
      } else {
        setEditingInstallationDateOrderId(null);
        setInstallationDate(undefined);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">
              {isTransportCalendar ? "Wybierz datę transportu" : "Wybierz datę montażu"}
            </h3>
            <button 
              className="p-1 rounded-full hover:bg-gray-100"
              onClick={closeCalendar}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Pole wyboru statusu nad kalendarzem */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              {isTransportCalendar ? "Status transportu:" : "Status montażu:"}
            </label>
            <Select
              value={isTransportCalendar ? selectedTransportStatus : selectedInstallationStatus}
              onValueChange={(value) => {
                if (isTransportCalendar) {
                  setSelectedTransportStatus(value);
                } else {
                  setSelectedInstallationStatus(value);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isTransportCalendar ? "Wybierz status transportu" : "Wybierz status montażu"} />
              </SelectTrigger>
              <SelectContent>
                {isTransportCalendar ? (
                  TRANSPORT_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))
                ) : (
                  INSTALLATION_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Pole wyboru pracownika (montażysty lub transportera) dla firm wieloosobowych */}
          {user?.role === 'company' && user?.companyOwnerOnly === false && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                {isTransportCalendar ? "Przypisz transportera:" : "Przypisz montażystę:"}
              </label>
              <Select
                value={(isTransportCalendar ? selectedTransporterId : selectedInstallerId)?.toString()}
                onValueChange={(value) => {
                  const workerId = parseInt(value);
                  if (isTransportCalendar) {
                    setSelectedTransporterId(workerId);
                  } else {
                    setSelectedInstallerId(workerId);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isTransportCalendar ? "Wybierz transportera" : "Wybierz montażystę"} />
                </SelectTrigger>
                <SelectContent>
                  {isTransportCalendar ? (
                    availableTransporters.map(transporter => (
                      <SelectItem key={transporter.id} value={transporter.id.toString()}>
                        {transporter.name}
                      </SelectItem>
                    ))
                  ) : (
                    availableInstallers.map(installer => (
                      <SelectItem key={installer.id} value={installer.id.toString()}>
                        {installer.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <CalendarUI
            mode="single"
            selected={currentDate}
            onSelect={setCurrentDate}
            initialFocus
            className="mx-auto"
          />
          
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              variant="outline"
              onClick={closeCalendar}
            >
              Anuluj
            </Button>
            <Button
              onClick={() => orderId && handleUpdate(orderId)}
              disabled={!currentDate || isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Zapisz
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Komponent wyświetlający aktywne filtry
  const ActiveFiltersDisplay = () => {
    if (activeFilters.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {activeFilters.map(filter => (
          <Badge 
            key={filter.id} 
            variant="secondary"
            className="flex items-center gap-1 px-3 py-1"
          >
            {filter.label}
            <button 
              className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
              onClick={() => removeFilter(filter.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        <button 
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          onClick={clearAllFilters}
        >
          <XCircle className="h-3.5 w-3.5" />
          Wyczyść wszystkie
        </button>
      </div>
    );
  };
  
  // Komponent dla mobilnych filtrów (drawer)
  const MobileFilterDrawer = () => {
    // Lokalne stany dla filtrów (będą zastosowane dopiero po zatwierdzeniu)
    const [tempDateRange, setTempDateRange] = useState<{
      from?: Date,
      to?: Date,
      type: 'installationDate' | 'transportDate'
    }>({
      from: undefined,
      to: undefined,
      type: 'installationDate'
    });
    
    // Checkbox stany
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
    const [withTransport, setWithTransport] = useState<boolean | null>(null);
    
    // Zastosowanie filtrów i zamknięcie drawera
    const applyFilters = () => {
      // Dodaj filtr daty, jeśli ustawiony
      if (tempDateRange.from) {
        const filterLabel = tempDateRange.type === 'installationDate' 
          ? 'Montaż: ' 
          : 'Transport: ';
        
        const fromDate = tempDateRange.from ? startOfDay(tempDateRange.from) : undefined;
        const toDate = tempDateRange.to ? endOfDay(tempDateRange.to) : fromDate ? endOfDay(fromDate) : undefined;
        
        const dateRangeLabel = `${filterLabel}${formatDate(fromDate!)}${toDate && fromDate?.getTime() !== toDate.getTime() ? ` - ${formatDate(toDate)}` : ''}`;
        
        const filter: ActiveFilter = {
          id: `date_range_${Date.now()}`,
          type: 'dateRange',
          label: dateRangeLabel,
          value: {
            from: fromDate,
            to: toDate
          }
        };
        
        setActiveFilters(prev => [...prev.filter(f => f.type !== 'dateRange'), filter]);
      }
      
      // Dodaj filtry statusów
      selectedStatuses.forEach(status => {
        const statusInfo = [...INSTALLATION_STATUSES, ...TRANSPORT_STATUSES].find(s => s.value === status);
        if (statusInfo) {
          const type = INSTALLATION_STATUSES.some(s => s.value === status) ? 'status' : 'transportStatus';
          const label = type === 'status' ? `Montaż: ${statusInfo.label}` : `Transport: ${statusInfo.label}`;
          
          const filter: ActiveFilter = {
            id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: type as any,
            label,
            value: status
          };
          
          // Usuwamy poprzednie filtry tego samego typu
          setActiveFilters(prev => [...prev.filter(f => f.type !== type), filter]);
        }
      });
      
      // Dodaj filtry usług
      selectedServiceTypes.forEach(serviceType => {
        const filter: ActiveFilter = {
          id: `service_type_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'serviceType',
          label: `Usługa: ${serviceType}`,
          value: serviceType
        };
        
        setActiveFilters(prev => [...prev.filter(f => f.type !== 'serviceType'), filter]);
      });
      
      // Dodaj filtr transportu, jeśli wybrano
      if (withTransport !== null) {
        const filter: ActiveFilter = {
          id: `transport_${Date.now()}`,
          type: 'transport',
          label: withTransport ? 'Z transportem' : 'Bez transportu',
          value: withTransport
        };
        
        setActiveFilters(prev => [...prev.filter(f => f.type !== 'transport'), filter]);
      }
      
      // Zamknij drawer i odśwież listę
      setIsFilterDrawerOpen(false);
      ordersQuery.refetch();
    };
    
    // Resetowanie wszystkich filtrów w mobilnym drawerze
    const resetFilters = () => {
      // Resetujemy lokalne stany filtrów w drawerze
      setTempDateRange({
        from: undefined,
        to: undefined,
        type: 'installationDate'
      });
      setSelectedStatuses([]);
      setSelectedServiceTypes([]);
      setWithTransport(null);
      setSettlementFilter(null);
      
      // Czyścimy również globalne filtry
      clearAllFilters();
      
      // Odświeżamy listę
      ordersQuery.refetch();
    };
    
    // Inicjalizacja wybranych filtrów na podstawie aktywnych
    useEffect(() => {
      // Statusy
      const activeInstallationStatus = activeFilters.find(f => f.type === 'status')?.value as string;
      const activeTransportStatus = activeFilters.find(f => f.type === 'transportStatus')?.value as string;
      
      const statuses = [];
      if (activeInstallationStatus) statuses.push(activeInstallationStatus);
      if (activeTransportStatus) statuses.push(activeTransportStatus);
      setSelectedStatuses(statuses);
      
      // Typy usług
      const serviceType = activeFilters.find(f => f.type === 'serviceType')?.value as string;
      setSelectedServiceTypes(serviceType ? [serviceType] : []);
      
      // Transport
      const transportFilter = activeFilters.find(f => f.type === 'transport')?.value;
      setWithTransport(transportFilter !== undefined ? Boolean(transportFilter) : null);
      
      // Daty
      const dateRange = activeFilters.find(f => f.type === 'dateRange')?.value as { from?: Date, to?: Date } | undefined;
      const dateFilterType = activeFilters.find(f => f.type === 'dateRange')?.label.startsWith('Montaż') 
        ? 'installationDate' 
        : 'transportDate';
      
      if (dateRange) {
        setTempDateRange({
          from: dateRange.from,
          to: dateRange.to,
          type: dateFilterType as any
        });
      }
    }, [isFilterDrawerOpen]);
    
    return (
      <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <DrawerContent className="max-h-[90%] px-4">
          <DrawerHeader>
            <DrawerTitle>Filtry zleceń</DrawerTitle>
            <DrawerDescription>
              Wybierz filtry, aby znaleźć zlecenia
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="space-y-6 px-1 overflow-y-auto">
            {/* Sekcja - Zakres dat */}
            <div className="space-y-3 border-b pb-4">
              <h4 className="text-sm font-medium">Zakres dat:</h4>
              <Select
                value={tempDateRange.type}
                onValueChange={(value: 'installationDate' | 'transportDate') => 
                  setTempDateRange(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <span>
                    {tempDateRange.type === 'installationDate' ? 'Data montażu' : 'Data transportu'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="installationDate">Data montażu</SelectItem>
                  <SelectItem value="transportDate">Data transportu</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Data OD */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Od:</p>
                  {tempDateRange.from && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setTempDateRange(prev => ({ ...prev, from: undefined }))}
                      className="h-6 text-xs text-gray-500"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Wyczyść
                    </Button>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempDateRange.from ? (
                        formatDate(tempDateRange.from)
                      ) : (
                        <span>Wybierz datę początkową</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" id="mobile-calendar-start">
                    <CalendarUI
                      mode="single"
                      selected={tempDateRange.from}
                      onSelect={(date) => {
                        // Najpierw aktualizujemy datę
                        setTempDateRange(prev => ({ ...prev, from: date }));
                        
                        // NOWA METODA: Symulujemy kliknięcie w tle za pomocą zdarzenia 'Escape'
                        // Ta metoda jest bardziej niezawodna niż szukanie elementów w DOM
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Data DO */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Do:</p>
                  {tempDateRange.to && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setTempDateRange(prev => ({ ...prev, to: undefined }))}
                      className="h-6 text-xs text-gray-500"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Wyczyść
                    </Button>
                  )}
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      disabled={!tempDateRange.from}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempDateRange.to ? (
                        formatDate(tempDateRange.to)
                      ) : (
                        <span>{tempDateRange.from ? 'Wybierz datę końcową' : 'Najpierw wybierz datę początkową'}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" id="mobile-calendar-end">
                    <CalendarUI
                      mode="single"
                      selected={tempDateRange.to}
                      onSelect={(date) => {
                        // Najpierw aktualizujemy datę
                        setTempDateRange(prev => ({ ...prev, to: date }));
                        
                        // NOWA METODA: Symulujemy kliknięcie Escape, które zawsze zamyka popover
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                      }}
                      disabled={(date) => tempDateRange.from ? date < tempDateRange.from : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {/* Sekcja - Status montażu */}
            <div className="space-y-3 border-b pb-4">
              <h4 className="text-sm font-medium">Montaż:</h4>
              <div className="grid grid-cols-1 gap-2">
                {INSTALLATION_STATUSES.map(status => (
                  <div key={`installation-${status.value}`} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`installation-${status.value}`}
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStatuses(prev => [...prev, status.value]);
                        } else {
                          setSelectedStatuses(prev => prev.filter(s => s !== status.value));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`installation-${status.value}`}
                      className="text-sm flex items-center cursor-pointer"
                    >
                      <Tag className="h-4 w-4 mr-2 text-gray-500" />
                      {status.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Sekcja - Status transportu */}
            <div className="space-y-3 border-b pb-4">
              <h4 className="text-sm font-medium">Transport:</h4>
              <div className="grid grid-cols-1 gap-2">
                {TRANSPORT_STATUSES.map(status => (
                  <div key={`transport-${status.value}`} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`transport-${status.value}`}
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStatuses(prev => [...prev, status.value]);
                        } else {
                          setSelectedStatuses(prev => prev.filter(s => s !== status.value));
                        }
                      }}
                    />
                    <label 
                      htmlFor={`transport-${status.value}`}
                      className="text-sm flex items-center cursor-pointer"
                    >
                      <Tag className="h-4 w-4 mr-2 text-gray-500" />
                      {status.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Sekcja - Typ usługi */}
            <div className="space-y-3 border-b pb-4">
              <h4 className="text-sm font-medium">Typ usługi:</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="service-doors"
                    checked={selectedServiceTypes.includes('Montaż drzwi')}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setSelectedServiceTypes(prev => [...prev, 'Montaż drzwi']);
                      } else {
                        setSelectedServiceTypes(prev => prev.filter(s => s !== 'Montaż drzwi'));
                      }
                    }}
                  />
                  <label 
                    htmlFor="service-doors"
                    className="text-sm flex items-center cursor-pointer"
                  >
                    <DoorOpen className="h-4 w-4 mr-2 text-gray-500" />
                    Montaż drzwi
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="service-floor"
                    checked={selectedServiceTypes.includes('Montaż podłogi')}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setSelectedServiceTypes(prev => [...prev, 'Montaż podłogi']);
                      } else {
                        setSelectedServiceTypes(prev => prev.filter(s => s !== 'Montaż podłogi'));
                      }
                    }}
                  />
                  <label 
                    htmlFor="service-floor"
                    className="text-sm flex items-center cursor-pointer"
                  >
                    <Home className="h-4 w-4 mr-2 text-gray-500" />
                    Montaż podłogi
                  </label>
                </div>
              </div>
            </div>
            
            {/* Sekcja - Transport */}
            <div className="space-y-3 pb-4">
              <h4 className="text-sm font-medium">Transport:</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="with-transport"
                    checked={withTransport === true}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setWithTransport(true);
                      } else {
                        setWithTransport(null);
                      }
                    }}
                  />
                  <label 
                    htmlFor="with-transport"
                    className="text-sm flex items-center cursor-pointer"
                  >
                    <Truck className="h-4 w-4 mr-2 text-gray-500" />
                    Z transportem
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="without-transport"
                    checked={withTransport === false}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        setWithTransport(false);
                      } else {
                        setWithTransport(null);
                      }
                    }}
                  />
                  <label 
                    htmlFor="without-transport"
                    className="text-sm cursor-pointer"
                  >
                    Bez transportu
                  </label>
                </div>
              </div>
            </div>
            
            {/* Do rozliczenia - tylko dla firm jednoosobowych */}
            {isOnePersonCompany && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="to-settle"
                    checked={settlementFilter === true}
                    onCheckedChange={(checked) => {
                      setSettlementFilter(checked === true ? true : null);
                    }}
                  />
                  <label 
                    htmlFor="to-settle"
                    className="text-sm flex items-center cursor-pointer font-medium"
                  >
                    <CheckCircle className="h-4 w-4 mr-2 text-gray-500" />
                    Tylko zlecenia do rozliczenia
                  </label>
                </div>
              </div>
            )}
          </div>
          
          <DrawerFooter className="pt-2 space-y-2">
            <Button 
              variant="outline" 
              onClick={resetFilters}
              className="w-full"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Wyczyść wszystkie filtry
            </Button>
            <Button 
              className="w-full"
              onClick={applyFilters}
            >
              Zastosuj filtry
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  };
  
  // Komponent dla filtrów w widoku desktopowym
  const DesktopFiltersDialog = () => {
    return (
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Zaawansowane filtrowanie zleceń</DialogTitle>
            <DialogDescription>
              Wybierz filtry, aby precyzyjnie wyszukać zlecenia
            </DialogDescription>
          </DialogHeader>
          
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="quick-filters" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="flex items-center text-base font-medium">
                  <CalendarDays className="mr-2 h-5 w-5" />
                  Szybkie filtry
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {/* Filtry zakresu dat */}
                <div className="border-b pb-4 mb-4">
                  <div className="flex gap-4 mb-3">
                    <Select
                      value={dateFilterType}
                      onValueChange={(value: 'installationDate' | 'transportDate') => setDateFilterType(value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <span>
                          {dateFilterType === 'installationDate' ? 'Data montażu' : 'Data transportu'}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="installationDate">Data montażu</SelectItem>
                        <SelectItem value="transportDate">Data transportu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-500">Od:</p>
                        {dateFilterStart && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDateFilterStartOriginal(undefined)}
                            className="h-6 px-1 text-xs text-gray-500"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Wyczyść
                          </Button>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFilterStart ? formatDate(dateFilterStart) : 'Wybierz datę'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarUI
                            mode="single"
                            selected={dateFilterStart}
                            onSelect={setDateFilterStart}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <p className="text-sm text-gray-500">Do:</p>
                        {dateFilterEnd && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setDateFilterEndOriginal(undefined)}
                            className="h-6 px-1 text-xs text-gray-500"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Wyczyść
                          </Button>
                        )}
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            disabled={!dateFilterStart}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFilterEnd ? formatDate(dateFilterEnd) : 'Wybierz datę'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarUI
                            mode="single"
                            selected={dateFilterEnd}
                            onSelect={setDateFilterEnd}
                            disabled={(date) => dateFilterStart ? date < dateFilterStart : false}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  {/* Usunięto przycisk "Dodaj filtr zakresu dat" - filtry dat będą dodawane przez główny przycisk "Zastosuj filtry" */}
                </div>
                
                {/* Przyciski szybkich filtrów */}
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addQuickDateFilter('today')}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Na dziś
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addQuickDateFilter('tomorrow')}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Na jutro
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addQuickDateFilter('thisWeek')}
                  >
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Na ten tydzień
                  </Button>
                  
                  {/* Pierwsza linia statusów */}
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => isTransporter 
                      ? addTransportStatusFilter('transport zaplanowany', 'Transport zaplanowany')
                      : addStatusFilter('nowe', 'Nowe')
                    }
                  >
                    <Tag className="h-4 w-4 mr-2" />
                    {isTransporter ? 'Transport zaplanowany' : 'Nowe'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => isTransporter 
                      ? addTransportStatusFilter('w trakcie transportu', 'W drodze')
                      : addStatusFilter('w trakcie montażu', 'W realizacji')
                    }
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {isTransporter ? 'W drodze' : 'W realizacji'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => isTransporter
                      ? addTransportStatusFilter('transport dostarczony', 'Zakończony')
                      : addStatusFilter('montaż wykonany', 'Zakończony')
                    }
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Zakończone
                  </Button>
                  
                  {/* Druga linia statusów */}
                  {isOnePersonCompany && (
                    <Button 
                      variant="outline" 
                      className="justify-start"
                      onClick={() => addSettlementFilter(true)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Do rozliczenia
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="service-type" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="flex items-center text-base font-medium">
                  <Tag className="mr-2 h-5 w-5" />
                  Typ usługi
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-3 gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addServiceTypeFilter('Montaż drzwi')}
                  >
                    Montaż drzwi
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addServiceTypeFilter('Montaż podłogi')}
                  >
                    Montaż podłogi
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="transport-options" className="border-b">
              <AccordionTrigger className="hover:no-underline py-4">
                <span className="flex items-center text-base font-medium">
                  <Truck className="mr-2 h-5 w-5" />
                  Opcje transportu
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addTransportFilter(true)}
                  >
                    Z transportem
                  </Button>
                  <Button 
                    variant="outline" 
                    className="justify-start"
                    onClick={() => addTransportFilter(false)}
                  >
                    Bez transportu
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          
          <DialogFooter className="flex gap-2">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => {
                clearAllFilters();
                // Odświeżamy listę zleceń po wyczyszczeniu filtrów
                ordersQuery.refetch();
              }}
            >
              Wyczyść wszystkie filtry
            </Button>
            <Button
              type="button"
              onClick={() => {
                // Jeśli są ustawione daty, dodaj filtr daty
                if (dateFilterStart) {
                  // Tworzymy filtr zakresu dat
                  const filterLabel = `${dateFilterType === 'installationDate' ? 'Montaż' : 'Transport'}: ${formatDate(dateFilterStart)}${dateFilterEnd ? ` - ${formatDate(dateFilterEnd)}` : ''}`;
                  
                  const filter: ActiveFilter = {
                    id: `date-range-${dateFilterType}-${Date.now()}`,
                    type: 'dateRange',
                    label: filterLabel,
                    value: {
                      from: startOfDay(dateFilterStart),
                      to: dateFilterEnd ? endOfDay(dateFilterEnd) : endOfDay(dateFilterStart)
                    }
                  };
                  
                  addFilter(filter);
                  
                  // Resetuj pola kalendarza
                  setDateFilterStart(undefined);
                  setDateFilterEnd(undefined);
                }
                
                // Zamknij dialog
                setIsFilterDialogOpen(false);
                
                // Odświeżamy listę zleceń, aby zastosować filtry
                ordersQuery.refetch();
                
                console.log('Zastosowano filtry, w tym filtry dat');
              }}
            >
              Zastosuj filtry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  return (
    <div className="space-y-6 pb-32 md:pb-0">
      {/* Wykorzystujemy CalendarDialog */}
      <CalendarDialog />
      <BackButton fallbackPath="/" className="mb-4" />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            Zlecenia
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isTransporter 
              ? "Zarządzaj dostawami i statusami transportu"
              : "Zarządzaj zleceniami montażu i transportu"
            }
          </p>
        </div>
        
        {canCreateOrders && (
          <Button onClick={handleCreateNewOrder}>
            <Plus className="h-4 w-4 mr-2" />
            Nowe zlecenie
          </Button>
        )}
      </div>
      
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3">
          <CardTitle>
            Zlecenia
          </CardTitle>
          <CardDescription>
            {storeFilter === '1' && 'Sklep: Santocka 39'}
            {storeFilter === '2' && 'Sklep: Struga 31A'}
            {storeFilter === 'all' && 'Wszystkie sklepy'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Search and filters */}
          <div className="mb-6 flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-500" />
              </div>
              <Input
                type="search"
                className="pl-10"
                placeholder={isTransporter 
                  ? "Szukaj klienta, adresu dostawy..." 
                  : "Szukaj zlecenia, klienta, adresu..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                </button>
              )}
            </div>
            
            {/* Przyciski filtrowania dla urządzeń mobilnych */}
            <div className="flex md:hidden flex-wrap justify-between w-full mt-3">
              {/* Przyciski nawigacji dla dat */}
              <div className="flex items-center">
                <div className="flex items-center border rounded-md overflow-hidden mr-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => addDateOffsetFilter(-1)}
                    className="px-2 h-8 rounded-none border-r"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                  
                  <Button 
                    variant={currentDateOffset === 0 ? "default" : "ghost"}
                    size="sm"
                    onClick={() => addDateOffsetFilter(0)}
                    className="px-3 h-8 rounded-none border-r text-xs"
                  >
                    Dziś
                  </Button>
                  
                  <Button 
                    variant={currentDateOffset === 1 ? "default" : "ghost"}
                    size="sm"
                    onClick={() => addDateOffsetFilter(1)}
                    className="px-3 h-8 rounded-none border-r text-xs"
                  >
                    Jutro
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => addDateOffsetFilter(1)}
                    className="px-2 h-8 rounded-none"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              
              {/* Przycisk zaawansowanego filtrowania */}
              <div className="flex">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center"
                  onClick={openFilterDrawer}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  Filtruj
                </Button>
              </div>
            </div>
            
            {/* Przyciski filtrów - desktop */}
            <div className="hidden md:flex flex-wrap gap-2">
              {/* Przyciski szybkiego filtrowania dat i usług */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center border rounded-md overflow-hidden">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => addDateOffsetFilter(-1)}
                    className="px-2 h-8 rounded-none border-r"
                  >
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => addDateOffsetFilter(0)}
                    className="flex items-center px-2 h-8 rounded-none"
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">
                      {currentDateOffset === 0 && 'Dzisiaj'}
                      {currentDateOffset === 1 && 'Jutro'}
                      {currentDateOffset === -1 && 'Wczoraj'}
                      {currentDateOffset > 1 && `Za ${currentDateOffset} dni`}
                      {currentDateOffset < -1 && `${Math.abs(currentDateOffset)} dni temu`}
                    </span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => addDateOffsetFilter(1)}
                    className="px-2 h-8 rounded-none border-l"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  {/* Przycisk resetowania filtra daty - pokaż tylko gdy filtr jest aktywny */}
                  {activeFilters.some(f => f.type === 'dateRange') && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        // Usuń filtry typu dateRange
                        const updatedFilters = activeFilters.filter(filter => filter.type !== 'dateRange');
                        setActiveFilters(updatedFilters);
                        localStorage.setItem('orderFilters', JSON.stringify(updatedFilters));
                      }}
                      className="px-2 h-8 rounded-none border-l text-red-500 hover:text-red-700"
                      title="Wyczyść filtr daty"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                
                {!isTransporter && (
                  <div className="hidden sm:flex items-center space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addServiceTypeFilter('Montaż podłóg')}
                      className="flex items-center"
                    >
                      <Home className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden md:inline">Podłogi</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => addServiceTypeFilter('Montaż drzwi')}
                      className="flex items-center"
                    >
                      <DoorOpen className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden md:inline">Drzwi</span>
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Komponenty zapisanych filtrów */}
              <div className="hidden md:block">
                <SavedFilters 
                  activeFilters={activeFilters}
                  onApplyFilter={(filters) => setActiveFilters(filters)}
                  className="mr-2"
                />
              </div>
              
              {/* Przycisk zaawansowanego filtrowania - desktop */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="hidden md:flex items-center"
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtruj
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Zaawansowane filtrowanie zleceń</DialogTitle>
                    <DialogDescription>
                      Wybierz filtry według statusu montażu lub transportu
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-6">
                      {/* Filtr zakresu dat */}
                      <div className="space-y-3 border-b pb-4">
                        <h3 className="text-sm font-medium">Zakres dat:</h3>
                        <div className="flex gap-3 mb-3">
                          <Select
                            value={dateFilterType}
                            onValueChange={(value: 'installationDate' | 'transportDate') => setDateFilterType(value)}
                          >
                            <SelectTrigger className="w-[180px]">
                              <span>
                                {dateFilterType === 'installationDate' ? 'Data montażu' : 'Data transportu'}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="installationDate">Data montażu</SelectItem>
                              <SelectItem value="transportDate">Data transportu</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-gray-500">Od:</p>
                              {dateFilterStart && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => setDateFilterStartOriginal(undefined)}
                                  className="h-6 px-2 text-xs text-gray-500"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Wyczyść
                                </Button>
                              )}
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {dateFilterStart ? formatDate(dateFilterStart) : 'Wybierz datę'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <CalendarUI
                                  mode="single"
                                  selected={dateFilterStart}
                                  onSelect={setDateFilterStart}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <p className="text-sm text-gray-500">Do:</p>
                              {dateFilterEnd && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => setDateFilterEndOriginal(undefined)}
                                  className="h-6 px-2 text-xs text-gray-500"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Wyczyść
                                </Button>
                              )}
                            </div>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start text-left font-normal"
                                  disabled={!dateFilterStart}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {dateFilterEnd ? formatDate(dateFilterEnd) : 'Wybierz datę'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <CalendarUI
                                  mode="single"
                                  selected={dateFilterEnd}
                                  onSelect={setDateFilterEnd}
                                  disabled={(date) => dateFilterStart ? date < dateFilterStart : false}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        
                        {/* Usunięto przycisk "Dodaj filtr zakresu dat" - filtry dat będą dodawane przez główny przycisk "Zastosuj filtry" */}
                      </div>
                      
                      {/* Statusy montażu i transportu obok siebie w dwóch kolumnach */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Status montażu - lewa kolumna */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Status montażu:</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {INSTALLATION_STATUSES.map(status => (
                              <div className="flex items-center space-x-2" key={`mont-${status.value}`}>
                                <Checkbox 
                                  id={`mont-${status.value}`} 
                                  onCheckedChange={(checked) => {
                                    if (checked) addStatusFilter(status.value, `Montaż: ${status.label}`);
                                  }} 
                                />
                                <label htmlFor={`mont-${status.value}`} className="text-sm">{status.label}</label>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Status transportu - prawa kolumna */}
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium">Status transportu:</h3>
                          <div className="grid grid-cols-1 gap-2">
                            {TRANSPORT_STATUSES.map(status => (
                              <div className="flex items-center space-x-2" key={`trans-${status.value}`}>
                                <Checkbox 
                                  id={`trans-${status.value}`} 
                                  onCheckedChange={(checked) => {
                                    if (checked) addTransportStatusFilter(status.value, `Transport: ${status.label}`);
                                  }} 
                                />
                                <label htmlFor={`trans-${status.value}`} className="text-sm">{status.label}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Dodatkowe opcje filtrowania z checkboxami */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Dodatkowe filtry:</h3>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="filter-with-transport" 
                              onCheckedChange={(checked) => {
                                if (checked) addTransportFilter(true);
                              }}
                            />
                            <label htmlFor="filter-with-transport" className="text-sm flex items-center">
                              <Truck className="h-4 w-4 mr-1" />
                              Z transportem
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="filter-without-transport" 
                              onCheckedChange={(checked) => {
                                if (checked) addTransportFilter(false);
                              }}
                            />
                            <label htmlFor="filter-without-transport" className="text-sm">
                              Bez transportu
                            </label>
                          </div>
                          {isOnePersonCompany && (
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="filter-to-settle" 
                                onCheckedChange={(checked) => {
                                  if (checked) addSettlementFilter(true);
                                }}
                              />
                              <label htmlFor="filter-to-settle" className="text-sm">
                                Do rozliczenia
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        clearAllFilters();
                        ordersQuery.refetch();
                        setIsFilterDialogOpen(false);
                      }}
                    >
                      Wyczyść filtry
                    </Button>
                    <DialogClose asChild>
                      <Button 
                        onClick={() => {
                          // Jeśli są ustawione daty, dodaj filtr daty
                          if (dateFilterStart) {
                            // Tworzymy filtr zakresu dat
                            const filterLabel = `${dateFilterType === 'installationDate' ? 'Montaż' : 'Transport'}: ${formatDate(dateFilterStart)}${dateFilterEnd ? ` - ${formatDate(dateFilterEnd)}` : ''}`;
                            
                            const filter: ActiveFilter = {
                              id: `date-range-${dateFilterType}-${Date.now()}`,
                              type: 'dateRange',
                              label: filterLabel,
                              value: {
                                from: startOfDay(dateFilterStart),
                                to: dateFilterEnd ? endOfDay(dateFilterEnd) : endOfDay(dateFilterStart)
                              }
                            };
                            
                            addFilter(filter);
                            
                            // Resetuj pola kalendarza po dodaniu filtra
                            setDateFilterStart(undefined);
                            setDateFilterEnd(undefined);
                          }
                          
                          // Odświeżamy listę zleceń
                          ordersQuery.refetch();
                        }}
                      >
                        Zastosuj filtry
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              {/* Przycisk zaawansowanego filtrowania - mobile */}
              <Drawer>
                <DrawerTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="md:hidden flex items-center"
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtruj
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader className="text-left">
                    <DrawerTitle>Zaawansowane filtrowanie zleceń</DrawerTitle>
                    <DrawerDescription>
                      Wybierz filtry według statusu montażu lub transportu
                    </DrawerDescription>
                  </DrawerHeader>
                  
                  {/* Zapisane filtry - wersja mobilna */}
                  <div className="px-4 pb-2">
                    <SavedFilters 
                      activeFilters={activeFilters}
                      onApplyFilter={(filters) => setActiveFilters(filters)}
                    />
                  </div>
                  
                  <div className="px-4 space-y-4">
                    {/* Statusy montażu i transportu w mobilnej wersji */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Status montażu - lewa kolumna */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Status montażu:</h3>
                        <div className="grid grid-cols-1 gap-2">
                          {INSTALLATION_STATUSES.map(status => (
                            <div className="flex items-center space-x-2" key={`drawer-mont-${status.value}`}>
                              <Checkbox 
                                id={`drawer-mont-${status.value}`} 
                                onCheckedChange={(checked) => {
                                  if (checked) addStatusFilter(status.value, `Montaż: ${status.label}`);
                                }} 
                              />
                              <label htmlFor={`drawer-mont-${status.value}`} className="text-sm">{status.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Status transportu - prawa kolumna */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Status transportu:</h3>
                        <div className="grid grid-cols-1 gap-2">
                          {TRANSPORT_STATUSES.map(status => (
                            <div className="flex items-center space-x-2" key={`drawer-trans-${status.value}`}>
                              <Checkbox 
                                id={`drawer-trans-${status.value}`} 
                                onCheckedChange={(checked) => {
                                  if (checked) addTransportStatusFilter(status.value, `Transport: ${status.label}`);
                                }} 
                              />
                              <label htmlFor={`drawer-trans-${status.value}`} className="text-sm">{status.label}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Dodatkowe opcje filtrowania z checkboxami */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Dodatkowe filtry:</h3>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="drawer-filter-with-transport" 
                            onCheckedChange={(checked) => {
                              if (checked) addTransportFilter(true);
                            }}
                          />
                          <label htmlFor="drawer-filter-with-transport" className="text-sm flex items-center">
                            <Truck className="h-4 w-4 mr-1" />
                            Z transportem
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="drawer-filter-without-transport" 
                            onCheckedChange={(checked) => {
                              if (checked) addTransportFilter(false);
                            }}
                          />
                          <label htmlFor="drawer-filter-without-transport" className="text-sm">
                            Bez transportu
                          </label>
                        </div>
                        {isOnePersonCompany && (
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="drawer-filter-to-settle" 
                              onCheckedChange={(checked) => {
                                if (checked) addSettlementFilter(true);
                              }}
                            />
                            <label htmlFor="drawer-filter-to-settle" className="text-sm">
                              Do rozliczenia
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <DrawerFooter className="pt-2 space-y-2">
                    <Button 
                      onClick={() => {
                        clearAllFilters();
                        ordersQuery.refetch();
                        setIsFilterDrawerOpen(false);
                      }} 
                      variant="outline" 
                      className="w-full"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Wyczyść filtry
                    </Button>
                    <DrawerClose asChild>
                      <Button 
                        onClick={() => {
                          // Jeśli są ustawione daty, dodaj filtr daty
                          if (dateFilterStart) {
                            // Tworzymy filtr zakresu dat
                            const filterLabel = `${dateFilterType === 'installationDate' ? 'Montaż' : 'Transport'}: ${formatDate(dateFilterStart)}${dateFilterEnd ? ` - ${formatDate(dateFilterEnd)}` : ''}`;
                            
                            const filter: ActiveFilter = {
                              id: `date-range-${dateFilterType}-${Date.now()}`,
                              type: 'dateRange',
                              label: filterLabel,
                              value: {
                                from: startOfDay(dateFilterStart),
                                to: dateFilterEnd ? endOfDay(dateFilterEnd) : endOfDay(dateFilterStart)
                              }
                            };
                            
                            addFilter(filter);
                            
                            // Resetuj pola kalendarza po dodaniu filtra
                            setDateFilterStart(undefined);
                            setDateFilterEnd(undefined);
                          }
                          
                          // Odświeżamy listę zleceń
                          ordersQuery.refetch();
                        }} 
                        className="w-full"
                      >
                        Zastosuj filtry
                      </Button>
                    </DrawerClose>
                    <DrawerClose asChild>
                      <Button variant="outline" className="w-full">Anuluj</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
              
              {/* Zdublowany filtr statusu transportu został usunięty */}
              
              {canChangeStore && (
                <div className="w-44">
                  <Select
                    value={storeFilter}
                    onValueChange={setStoreFilter}
                  >
                    <SelectTrigger>
                      <span className="truncate">
                        {storeFilter === '1' ? 'Santocka 39' : 
                         storeFilter === '2' ? 'Struga 31A' : 'Wszystkie sklepy'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Wszystkie sklepy</SelectItem>
                      <SelectItem value="1">Santocka 39</SelectItem>
                      <SelectItem value="2">Struga 31A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          
          {/* Wyświetlanie aktywnych filtrów */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeFilters.map((filter) => (
                <Badge 
                  key={filter.id} 
                  variant="outline"
                  className="pl-2 pr-1 py-1 flex items-center gap-1 text-sm bg-blue-50"
                >
                  <span>
                    {filter.type === 'dateRange' && filter.value && typeof filter.value === 'object' ? (
                      <>
                        {filter.label}: {filter.value.from ? formatDate(filter.value.from) : ''} 
                        {filter.value.from && filter.value.to ? ' - ' : ''}
                        {filter.value.to ? formatDate(filter.value.to) : ''}
                      </>
                    ) : (
                      `${filter.label}`
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 rounded-full hover:bg-blue-100"
                    onClick={() => removeFilter(filter.id)}
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Usuń filtr</span>
                  </Button>
                </Badge>
              ))}
              {activeFilters.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 hover:bg-blue-100"
                  onClick={() => clearAllFilters()}
                >
                  Wyczyść wszystkie
                </Button>
              )}
            </div>
          )}
          
          {/* Orders table/cards */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Wystąpił błąd podczas ładowania danych. Spróbuj odświeżyć stronę.
            </div>
          ) : filteredOrders && filteredOrders.length > 0 ? (
            <>
              {/* Mobilny widok kart - widoczny tylko na małych ekranach */}
              <div className="md:hidden space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg bg-white shadow-sm p-4">
                    {/* Pierwsza sekcja: Imię/nazwisko i typ zlecenia */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="font-medium text-base">{order.clientName}</div>
                      <div className="text-sm text-gray-700 text-right">{order.serviceType}</div>
                    </div>
                    
                    {/* Druga sekcja: Adres (klikalny) */}
                    <div className="mb-2">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.installationAddress || '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary-600 text-sm"
                      >
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                        {order.installationAddress}
                      </a>
                    </div>
                    
                    {/* Trzecia sekcja: Telefon (klikalny) */}
                    <div className="mb-3">
                      <a 
                        href={`tel:${order.clientPhone}`} 
                        className="flex items-center text-primary-600 text-sm"
                      >
                        <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                        {order.clientPhone}
                      </a>
                    </div>
                    
                    {/* Linia oddzielająca */}
                    <div className="border-t border-gray-200 mb-3"></div>
                    
                    {/* Czwarta sekcja: Transport (status i data) */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 mr-2 text-gray-500" />
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.transportStatus || '')}`}>
                          {formatTransportStatus(order.transportStatus) || 'Brak'}
                        </div>
                      </div>
                      
                      {order.withTransport ? (
                        <button 
                          className="flex items-center text-xs text-gray-600 hover:bg-gray-100 p-1 rounded"
                          onClick={() => openTransportDateEditor(order.id, order.transportDate || undefined)}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1 text-gray-500" />
                          {order.transportDate ? (
                            <span>{new Date(order.transportDate).toLocaleDateString('pl-PL')}</span>
                          ) : (
                            <span className="text-gray-400 italic">nieustalona</span>
                          )}
                          <Pencil className="h-3 w-3 text-gray-500 ml-1" />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 italic">brak transportu</span>
                      )}
                    </div>
                    
                    {/* Piąta sekcja: Montaż (status i data) */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <Hammer className="h-4 w-4 mr-2 text-gray-500" />
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.installationStatus || '')}`}>
                          {order.installationStatus || 'Nie określono'}
                        </div>
                      </div>
                      
                      <button 
                        className="flex items-center text-xs text-gray-600 hover:bg-gray-100 p-1 rounded"
                        onClick={() => {
                          // Otwarcie edytora daty montażu
                          const currentOrder = order;
                          openInstallationDateEditor(order.id, order.installationDate || undefined);
                          
                          // Ustaw aktualny status montażu
                          if (currentOrder.installationStatus) {
                            setSelectedInstallationStatus(currentOrder.installationStatus);
                          } else {
                            setSelectedInstallationStatus('montaż zaplanowany');
                          }
                        }}
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1 text-gray-500" />
                        {order.installationDate ? (
                          <span>{new Date(order.installationDate).toLocaleDateString('pl-PL')}</span>
                        ) : (
                          <span className="text-gray-400 italic">nieustalona</span>
                        )}
                        <Pencil className="h-3 w-3 text-gray-500 ml-1" />
                      </button>
                    </div>
                    
                    {/* Linia oddzielająca */}
                    <div className="border-t border-gray-200 mb-3"></div>
                    
                    {/* Szósta sekcja: "Do rozliczenia" i przycisk szczegółów */}
                    <div className="flex items-center justify-between">
                      {isOnePersonCompany && (
                        <div className="flex items-center">
                          <button 
                            onClick={() => handleToggleSettlement(order.id, order.willBeSettled || false)}
                            className={`flex items-center justify-center rounded-sm transition-colors ${
                              updateOrderMutation.isPending ? 'opacity-50 cursor-wait' : 'hover:bg-gray-100'
                            }`}
                            disabled={updateOrderMutation.isPending}
                            title={order.willBeSettled ? "Zlecenie do rozliczenia - kliknij, aby odznaczyć" : "Kliknij, aby oznaczyć zlecenie do rozliczenia"}
                          >
                            {order.willBeSettled ? (
                              <div className="w-5 h-5 bg-green-600 text-white flex items-center justify-center rounded-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </div>
                            ) : (
                              <div className="w-5 h-5 border border-gray-300 rounded-sm"></div>
                            )}
                          </button>
                          <span className="ml-2 text-sm">Do rozliczenia</span>
                        </div>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewOrder(order.id)}
                        className="ml-auto"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Szczegóły
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Widok tabeli - widoczny tylko na większych ekranach */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3">Klient</th>
                      {/* Dla transporterów adres jest klikalny do nawigacji */}
                      <th scope="col" className="px-4 py-3">
                        {isTransporter ? "Adres (nawigacja)" : "Adres"}
                      </th>
                      {/* Dla transporterów telefon z możliwością połączenia */}
                      <th scope="col" className="px-4 py-3">
                        {isTransporter ? "Telefon (połącz)" : "Telefon"}
                      </th>
                      <th scope="col" className="px-4 py-3">Usługa</th>
{/* Usunięto kolumnę Data transportu */}
                      {/* Dla transporterów i firm (obu typów) pokazujemy Montaż zamiast statusu zamówienia */}
                      <th scope="col" className="px-4 py-3">
                        {isTransporter || isOnePersonCompany ? "Montaż" : "Status"}
                      </th>
                      {/* Kolumna Transport dla transporterów i firm (obu typów) */}
                      {(isTransporter || isOnePersonCompany) && (
                        <th scope="col" className="px-4 py-3">Transport</th>
                      )}
                      {/* Pola finansowe widoczne tylko dla adminów i pracowników (nie dla firm) */}
                      {canModifyFinancialStatus && !isTransporter && !isOnePersonCompany && (
                        <>
                          <th scope="col" className="px-3 py-3 text-center">Faktura</th>
                          <th scope="col" className="px-3 py-3 text-center">Do rozliczenia</th>
                        </>
                      )}
                      {/* Kolumna "Do rozliczenia" widoczna dla wszystkich firm (obu typów) */}
                      {(isOnePersonCompany || (user?.role === 'company' && !canModifyFinancialStatus)) && (
                        <th scope="col" className="px-3 py-3 text-center">Do rozliczenia</th>
                      )}
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Akcje</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-4 py-3">
                          {order.clientName?.split(' ').map((namePart, index, arr) => {
                            // Jeśli to jest pierwsze imię
                            if (index === 0) {
                              return (
                                <div key={index} className="font-medium">{namePart}</div>
                              );
                            } 
                            // Jeśli to jest nazwisko lub kolejne części (małżonkowie)
                            return (
                              <div key={index} className="text-sm text-gray-600">{namePart}</div>
                            );
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {(() => {
                            // Podziel adres na części
                            const addressParts = order.installationAddress?.split(',') || [];
                            const fullAddress = order.installationAddress || '';
                            
                            // Dla transporterów adres jest klikalny (otwiera nawigację)
                            if (isTransporter) {
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
                              return (
                                <a 
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary-600 hover:underline flex items-start"
                                >
                                  <Navigation className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex flex-col">
                                    {addressParts.length >= 2 ? (
                                      <>
                                        <div className="font-medium">{addressParts[0].trim()}</div>
                                        <div className="text-sm text-primary-500">
                                          {addressParts.slice(1).join(',').trim()}
                                        </div>
                                      </>
                                    ) : fullAddress}
                                  </div>
                                </a>
                              );
                            }
                            
                            // Dla innych użytkowników zwykły tekst
                            if (addressParts.length >= 2) {
                              return (
                                <>
                                  <div className="font-medium">{addressParts[0].trim()}</div>
                                  <div className="text-sm text-gray-600">
                                    {addressParts.slice(1).join(',').trim()}
                                  </div>
                                </>
                              );
                            }
                            
                            // Jeśli jest tylko jedna część lub pusty adres
                            return order.installationAddress;
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {isTransporter && order.clientPhone ? (
                            <a 
                              href={`tel:${order.clientPhone}`}
                              className="text-primary-600 hover:underline flex items-center"
                            >
                              <Phone className="h-5 w-5 mr-2 text-primary-600 flex-shrink-0" />
                              <span>{order.clientPhone}</span>
                            </a>
                          ) : (
                            order.clientPhone
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{order.serviceType}</div>
                          {order.withTransport && 
                            <div className="text-xs text-gray-600">+ transport</div>
                          }
                        </td>
{/* Usunięto osobną kolumnę daty transportu */}
                        <td className="px-4 py-3">
                          {/* Pokazujemy rozszerzoną wersję montażu dla transporterów i firm (obu typów) */}
                          {isTransporter || isOnePersonCompany ? (
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.installationStatus || '')}`}>
                                {formatInstallationStatus(order.installationStatus) || 'Nowe'}
                              </span>
                              <div className="flex items-center text-xs text-gray-600">
                                <button 
                                  className="flex items-center hover:bg-gray-100 p-0.5 rounded"
                                  onClick={() => {
                                    // Otwarcie edytora daty montażu
                                    const currentOrder = order;
                                    openInstallationDateEditor(order.id, order.installationDate || undefined);
                                    
                                    // Ustaw aktualny status montażu
                                    if (currentOrder.installationStatus) {
                                      setSelectedInstallationStatus(currentOrder.installationStatus);
                                    } else {
                                      setSelectedInstallationStatus('montaż zaplanowany');
                                    }
                                  }}
                                >
                                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-500 flex-shrink-0" />
                                  {order.installationDate ? (
                                    <span>{new Date(order.installationDate).toLocaleDateString('pl-PL')}</span>
                                  ) : (
                                    <span className="text-gray-500 italic">nieustalona</span>
                                  )}
                                  <Pencil className="h-3 w-3 text-gray-500 ml-1.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.installationStatus || '')}`}>
                              {order.installationStatus || 'Nie określono'}
                            </span>
                          )}
                        </td>
                        {/* Kolumna Transport dla transporterów i firm (obu typów) */}
                        {(isTransporter || isOnePersonCompany) && (
                          <td className="px-4 py-3">
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.transportStatus || '')}`}>
                                {formatTransportStatus(order.transportStatus) || 'Brak'}
                              </span>
                              <div className="flex items-center text-xs text-gray-600">
                                {order.withTransport ? (
                                  <button 
                                    className="flex items-center hover:bg-gray-100 p-0.5 rounded"
                                    onClick={() => {
                                      // Otwarcie edytora daty transportu
                                      const currentOrder = order;
                                      openTransportDateEditor(order.id, order.transportDate || undefined);
                                      
                                      // Ustaw aktualny status transportu
                                      if (currentOrder.transportStatus) {
                                        setSelectedTransportStatus(currentOrder.transportStatus);
                                      } else {
                                        setSelectedTransportStatus('transport zaplanowany');
                                      }
                                    }}
                                  >
                                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-500 flex-shrink-0" />
                                    {order.transportDate ? (
                                      <span>{new Date(order.transportDate).toLocaleDateString('pl-PL')}</span>
                                    ) : (
                                      <span className="text-gray-500 italic">nieustalona</span>
                                    )}
                                    <Pencil className="h-3 w-3 text-gray-500 ml-1.5" />
                                  </button>
                                ) : (
                                  <span className="text-gray-400 italic flex items-center">
                                    <X className="h-3.5 w-3.5 mr-1.5 text-gray-500 flex-shrink-0" />
                                    brak transportu
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        {/* Pola finansowe widoczne tylko dla adminów, pracowników i firm (nie dla transporterów) */}
                        {canModifyFinancialStatus && !isTransporter && (
                          <>
                            <td className="px-3 py-3 text-center">
                              <button 
                                onClick={() => handleToggleInvoice(order.id, order.invoiceIssued || false)}
                                className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors ${
                                  updateOrderMutation.isPending ? 'opacity-50 cursor-wait' : 'hover:bg-gray-100'
                                }`}
                                disabled={updateOrderMutation.isPending}
                                title={order.invoiceIssued ? "Faktura wystawiona - kliknij, aby odznaczyć" : "Kliknij, aby oznaczyć fakturę jako wystawioną"}
                              >
                                {order.invoiceIssued ? (
                                  <div className="w-5 h-5 bg-green-600 text-white flex items-center justify-center rounded-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 border border-gray-300 rounded-sm"></div>
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button 
                                onClick={() => handleToggleSettlement(order.id, order.willBeSettled || false)}
                                className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors ${
                                  updateOrderMutation.isPending ? 'opacity-50 cursor-wait' : 'hover:bg-gray-100'
                                }`}
                                disabled={updateOrderMutation.isPending}
                                title={order.willBeSettled ? "Zlecenie do rozliczenia - kliknij, aby odznaczyć" : "Kliknij, aby oznaczyć zlecenie do rozliczenia"}
                              >
                                {order.willBeSettled ? (
                                  <div className="w-5 h-5 bg-green-600 text-white flex items-center justify-center rounded-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 border border-gray-300 rounded-sm"></div>
                                )}
                              </button>
                            </td>
                          </>
                        )}
                        
                        {/* Kolumna Do rozliczenia dla firm jednoosobowych */}
                        {isOnePersonCompany && !canModifyFinancialStatus && (
                          <td className="px-3 py-3 text-center">
                            <button 
                              onClick={() => handleToggleSettlement(order.id, order.willBeSettled || false)}
                              className={`w-6 h-6 flex items-center justify-center rounded-sm transition-colors ${
                                updateOrderMutation.isPending ? 'opacity-50 cursor-wait' : 'hover:bg-gray-100'
                              }`}
                              disabled={updateOrderMutation.isPending}
                              title={order.willBeSettled ? "Zlecenie do rozliczenia - kliknij, aby odznaczyć" : "Kliknij, aby oznaczyć zlecenie do rozliczenia"}
                            >
                              {order.willBeSettled ? (
                                <div className="w-5 h-5 bg-green-600 text-white flex items-center justify-center rounded-sm">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                </div>
                              ) : (
                                <div className="w-5 h-5 border border-gray-300 rounded-sm"></div>
                              )}
                            </button>
                          </td>
                        )}
                        
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order.id)}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <Eye className="h-5 w-5" />
                            <span className="sr-only">Zobacz szczegóły</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Przycisk czyszczenia wszystkich filtrów - widoczny tylko gdy są filtry */}
              {(searchTerm || (statusFilter !== 'all') || activeFilters.length > 0) && (
                <div className="flex justify-center mt-6">
                  <Button 
                    variant="outline"
                    size="lg"
                    onClick={clearAllFilters}
                    className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Wyczyść wszystkie filtry</span>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Brak zleceń do wyświetlenia</h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || (statusFilter !== 'all') || activeFilters.length > 0 ? 
                  'Brak wyników dla podanych kryteriów wyszukiwania.' : 
                  'Nie znaleziono żadnych zleceń.'}
              </p>
              {/* Przyciski - nowe zlecenie i czyszczenie filtrów */}
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                {canCreateOrders && (
                  <Button onClick={handleCreateNewOrder}>
                    <Plus className="h-4 w-4 mr-2" />
                    Utwórz nowe zlecenie
                  </Button>
                )}
                {(searchTerm || (statusFilter !== 'all') || activeFilters.length > 0) && (
                  <Button 
                    variant="outline"
                    onClick={clearAllFilters}
                    className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    <span>Wyczyść filtry</span>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Drawer filtrów dla urządzeń mobilnych */}
      <MobileFilterDrawer />
    </div>
  );
}