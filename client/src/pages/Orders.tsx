import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { Input } from '@/components/ui/input';

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

// Typy usług
const SERVICE_TYPES = [
  { value: 'Montaż drzwi', label: 'Montaż drzwi' },
  { value: 'Montaż podłogi', label: 'Montaż podłogi' },
  { value: 'Transport', label: 'Transport' },
];

import { 
  Eye, Plus, Search, Filter, X, CalendarClock, Phone, MapPin, 
  Navigation, Calendar, Loader2, Pencil, Truck, Hammer, 
  Check, CheckCircle, CalendarDays, Clock, Calendar as CalendarIcon,
  SlidersHorizontal, Tag, XCircle, Home, DoorOpen, Download, ArrowRight,
  Save, Users, UserCircle
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  
  status = status.toLowerCase();
  
  switch (status) {
    case 'nowe':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'zaplanowany':
    case 'montaż zaplanowany':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'w trakcie':
    case 'w trakcie montażu':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'zakończony':
    case 'montaż wykonany':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'reklamacja':
      return 'bg-red-100 text-red-800 border-red-200';
    // Statusy transportu
    case 'skompletowany':
    case 'gotowe do transportu':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'transport zaplanowany':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'w drodze':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'dostarczony':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'problem z transportem':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Funkcja do formatowania statusów transportu na bardziej zwięzłe
function formatTransportStatus(status: string | null | undefined): string {
  if (!status) return 'Brak';
  
  status = status.toLowerCase();
  
  switch (status) {
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
  
  status = status.toLowerCase();
  
  switch (status) {
    case 'montaż zaplanowany':
      return 'Zaplanowany';
    case 'w trakcie montażu':
      return 'W trakcie';
    case 'montaż wykonany':
      return 'Zakończony';
    case 'reklamacja':
      return 'Reklamacja';
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

  // Stan dla wyboru montażystów i transporterów
  const [editingInstallerOrderId, setEditingInstallerOrderId] = useState<number | null>(null);
  const [editingTransporterOrderId, setEditingTransporterOrderId] = useState<number | null>(null);
  const [selectedInstallerId, setSelectedInstallerId] = useState<number | undefined>();
  const [selectedTransporterId, setSelectedTransporterId] = useState<number | undefined>();
  
  // Stan dla zaawansowanego filtrowania
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [dateFilterStart, setDateFilterStart] = useState<Date | undefined>(undefined);
  const [dateFilterEnd, setDateFilterEnd] = useState<Date | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<'installationDate' | 'transportDate'>('installationDate');
  const [currentDateOffset, setCurrentDateOffset] = useState<number>(0); // 0 = dzisiaj, 1 = jutro, -1 = wczoraj
  
  // Stan dla filtrów w mobilnym drawerze
  const [tempDateRange, setTempDateRange] = useState<{
    from?: Date,
    to?: Date,
    type: 'installationDate' | 'transportDate'
  }>({
    from: undefined,
    to: undefined,
    type: 'installationDate'
  });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [withTransport, setWithTransport] = useState<boolean | null>(null);
  const [settlementFilter, setSettlementFilter] = useState<boolean | null>(null);
  
  // Określenie, czy zalogowany użytkownik jest transporterem
  // Uwaga: Dla obu typów firm (jednoosobowych i z pracownikami) chcemy identyczny interfejs
  // Dlatego ustawiamy isTransporter na true dla obu typów firm
  const isTransporter = 
    (user?.role === 'installer' && user?.services?.some(s => s.toLowerCase().includes('transport'))) ||
    user?.role === 'company';
    
  // Określenie, czy zalogowany użytkownik jest montażystą
  const isInstaller = 
    user?.role === 'installer' || 
    user?.services?.some(s => s.toLowerCase().includes('montaż')) ||
    user?.role === 'company';
    
  // Sprawdzenie czy to firma jednoosobowa (montażysta z przypisaną firmą)
  const isOnePersonCompany = 
    user?.role === 'installer' && 
    user?.companyId !== undefined && 
    user?.companyName;
  
  // Sprawdzenie czy to firma montażowa (bez uwzględnienia firm jednoosobowych)
  const isCompany = user?.role === 'company';
  
  // Sprawdzenie czy to właściciel firmy montażowej (companyOwnerOnly = true)
  const isCompanyOwner = isCompany && user?.companyOwnerOnly === true;
  
  // Sprawdzenie czy to jakikolwiek typ firmy (firma właściwa lub montażysta z przypisaną firmą)
  const isAnyCompany = isCompany || isOnePersonCompany;
  
  // Uprawnienia do edycji pól finansowych mają mieć:
  // 1. admin
  // 2. kierownicy i zastępcy kierowników w sklepach
  // 3. właściciel firmy montażowej, który NIE jest montażystą (companyOwnerOnly = true)
  const canModifyFinancialStatus = 
    user?.role === 'admin' || 
    (user?.role === 'worker' && (user?.position === 'kierownik' || user?.position === 'zastępca')) ||
    (user?.role === 'company' && user?.companyOwnerOnly === true);
    
  // Prawo do oznaczenia "do rozliczenia" - rozszerzamy o firmy jednoosobowe
  const canMarkForSettlement = canModifyFinancialStatus || isOnePersonCompany;
    
  // Stan dla filtrów zapisanych w bazie
  const [savedFilters, setSavedFilters] = useState<any[]>([]);
  const [isSaveFilterDialogOpen, setIsSaveFilterDialogOpen] = useState(false);
  const [filterNameToSave, setFilterNameToSave] = useState('');
  const [isDefaultFilter, setIsDefaultFilter] = useState(false);

  // Zapytanie o zapisane filtry użytkownika
  const userFiltersQuery = useQuery({
    queryKey: ['/api/user-filters'],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch('/api/user-filters');
      if (!response.ok) {
        throw new Error("Nie udało się pobrać zapisanych filtrów");
      }
      return response.json();
    },
    enabled: !!user?.id
  });
  
  // Ustaw zapisane filtry po załadowaniu
  useEffect(() => {
    if (userFiltersQuery.data) {
      setSavedFilters(userFiltersQuery.data);
      
      // Jeśli jest filtr domyślny i brak aktywnych filtrów, załaduj domyślny
      const defaultFilter = userFiltersQuery.data.find((f: any) => f.isDefault);
      if (defaultFilter && activeFilters.length === 0 && !sessionStorage.getItem('ignoreDefaultFilter')) {
        loadSavedFilter(defaultFilter, true);
        // Zapisujemy informację, że już załadowaliśmy domyślny filtr w tej sesji
        sessionStorage.setItem('ignoreDefaultFilter', 'true');
      }
    }
  }, [userFiltersQuery.data]);
  
  // Funkcja otwierająca dialog zapisywania filtra
  const openSaveFilterDialog = () => {
    setFilterNameToSave('');
    setIsDefaultFilter(false);
    setIsSaveFilterDialogOpen(true);
  };
  
  // Funkcja do zapisywania aktualnego filtra
  const saveCurrentFilter = () => {
    if (!user?.id || !filterNameToSave.trim() || activeFilters.length === 0) return;
    
    createFilterMutation.mutate({
      name: filterNameToSave.trim(),
      filtersData: activeFilters,
      isDefault: isDefaultFilter
    });
  };
  
  // Funkcja do wczytywania zapisanego filtra
  const loadSavedFilter = (filter: any, silent = false) => {
    try {
      // Konwertuj daty w filtrach, jeśli są
      const parsedFilters = filter.filtersData.map((filter: any) => {
        if (filter.type === 'dateRange' && typeof filter.value === 'object') {
          return {
            ...filter,
            value: {
              from: filter.value.from ? new Date(filter.value.from as string) : undefined,
              to: filter.value.to ? new Date(filter.value.to as string) : undefined
            }
          };
        }
        return filter;
      });
      
      // Ustawiamy aktywne filtry na załadowane
      setActiveFilters(parsedFilters);
      
      // Zamykamy dialog filtrów jeśli jest otwarty
      setIsFilterDialogOpen(false);
      
      // Odświeżamy listę zleceń
      ordersQuery.refetch();
      
      // Pokazujemy powiadomienie tylko jeśli nie jest tryb cichy
      if (!silent) {
        toast({
          title: "Filtr załadowany",
          description: `Załadowano filtr: ${filter.name}`,
        });
      }
    } catch (error) {
      console.error('Błąd podczas wczytywania filtra:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować filtra",
        variant: "destructive"
      });
    }
  };
  
  // Mutacje do zapisywania filtrów
  const createFilterMutation = useMutation({
    mutationFn: async (data: { name: string, filtersData: ActiveFilter[], isDefault: boolean }) => {
      return await apiRequest('POST', '/api/user/filters', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/filters'] });
      setIsSaveFilterDialogOpen(false);
      setFilterNameToSave('');
      setIsDefaultFilter(false);
      toast({
        title: "Filtr zapisany",
        description: "Twój filtr został zapisany pomyślnie",
      });
    },
    onError: (error: Error) => {
      console.error('Błąd podczas zapisywania filtra:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać filtra",
        variant: "destructive"
      });
    }
  });
  
  // Mutacja do ustawienia filtra jako domyślnego
  const setDefaultFilterMutation = useMutation({
    mutationFn: async (filterId: number) => {
      return await apiRequest('POST', `/api/user/filters/${filterId}/set-default`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/filters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/filters/default'] });
      toast({
        title: "Filtr domyślny",
        description: "Ustawiono filtr jako domyślny",
      });
    }
  });
  
  // Mutacja do usunięcia filtra
  const deleteFilterMutation = useMutation({
    mutationFn: async (filterId: number) => {
      return await apiRequest('DELETE', `/api/user/filters/${filterId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/filters'] });
      toast({
        title: "Filtr usunięty",
        description: "Filtr został usunięty pomyślnie",
      });
    }
  });
  
  // Funkcja zmieniająca filtr domyślny
  const setDefaultFilter = (filterId: number) => {
    setDefaultFilterMutation.mutate(filterId);
  };
  
  // Kiedy użytkownik otwiera kalendarz transportu, zamykamy kalendarz montażu i odwrotnie
  const openTransportDateEditor = (orderId: number, date?: Date) => {
    setEditingInstallationDateOrderId(null);
    setEditingTransporterOrderId(null);
    setEditingInstallerOrderId(null);
    setEditingTransportDateOrderId(orderId);
    
    // Znajdź aktualne zlecenie
    const order = ordersQuery.data?.find(o => o.id === orderId);
    
    // Ustaw status transportu
    if (order?.transportStatus) {
      setSelectedTransportStatus(order.transportStatus);
    } else {
      setSelectedTransportStatus('transport zaplanowany');
    }
    
    // Ustaw transportera (jeśli firma ma pracowników)
    if (isCompanyOwner) {
      if (order?.transporterId) {
        setSelectedTransporterId(order.transporterId);
      } else {
        setSelectedTransporterId(undefined);
      }
    }
    
    // Ustaw datę
    if (date) {
      setTransportDate(new Date(date));
    } else {
      setTransportDate(undefined);
    }
  };
  
  const openInstallationDateEditor = (orderId: number, date?: Date) => {
    setEditingTransportDateOrderId(null);
    setEditingTransporterOrderId(null);
    setEditingInstallerOrderId(null);
    setEditingInstallationDateOrderId(orderId);
    
    // Znajdź aktualne zlecenie
    const order = ordersQuery.data?.find(o => o.id === orderId);
    
    // Ustaw status montażu
    if (order?.installationStatus) {
      setSelectedInstallationStatus(order.installationStatus);
    } else {
      setSelectedInstallationStatus('montaż zaplanowany');
    }
    
    // Ustaw montażystę (jeśli firma ma pracowników)
    if (isCompanyOwner) {
      if (order?.installerId) {
        setSelectedInstallerId(order.installerId);
      } else {
        setSelectedInstallerId(undefined);
      }
    }
    
    // Ustaw datę
    if (date) {
      setInstallationDate(new Date(date));
    } else {
      setInstallationDate(undefined);
    }
  };

  // Obsługa otwierania/zamykania dialogu przypisywania montażysty
  const openInstallerDialog = (orderId: number) => {
    setEditingTransportDateOrderId(null);
    setEditingInstallationDateOrderId(null);
    setEditingTransporterOrderId(null);
    setEditingInstallerOrderId(orderId);
    
    // Pobierz aktualne dane zlecenia, aby ustawić domyślnego montażystę
    const order = ordersQuery.data?.find(o => o.id === orderId);
    if (order?.installerId) {
      setSelectedInstallerId(order.installerId);
    } else {
      setSelectedInstallerId(undefined);
    }
  };
  
  // Obsługa otwierania/zamykania dialogu przypisywania transportera
  const openTransporterDialog = (orderId: number) => {
    setEditingTransportDateOrderId(null);
    setEditingInstallationDateOrderId(null);
    setEditingInstallerOrderId(null);
    setEditingTransporterOrderId(orderId);
    
    // Pobierz aktualne dane zlecenia, aby ustawić domyślnego transportera
    const order = ordersQuery.data?.find(o => o.id === orderId);
    if (order?.transporterId) {
      setSelectedTransporterId(order.transporterId);
    } else {
      setSelectedTransporterId(undefined);
    }
  };
  
  // Zapytanie o zamówienia
  const ordersQuery = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się pobrać zleceń: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Pobieranie montażystów
  const { data: installers = [] } = useQuery<any[]>({
    queryKey: ['/api/installers'],
    enabled: isCompanyOwner && editingInstallerOrderId !== null,
  });
  
  // Pobieranie transporterów
  const { data: transporters = [] } = useQuery<any[]>({
    queryKey: ['/api/transporters'],
    enabled: isCompanyOwner && editingTransporterOrderId !== null,
  });
  
  // Mutacja do przypisywania montażysty
  const assignInstallerMutation2 = useMutation({
    mutationFn: async (params: { id: number; installerId: number }) => {
      const response = await apiRequest('PATCH', `/api/orders/${params.id}/assign-installer`, {
        installerId: params.installerId
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można przypisać montażysty');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Montażysta przypisany',
        description: 'Montażysta został pomyślnie przypisany do zlecenia',
      });
      
      // Czyścimy stan
      setEditingInstallerOrderId(null);
      setSelectedInstallerId(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd przypisywania',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutacja do przypisywania transportera
  const assignTransporterMutation = useMutation({
    mutationFn: async (params: { id: number; transporterId: number }) => {
      const response = await apiRequest('PATCH', `/api/orders/${params.id}/assign-transporter`, {
        transporterId: params.transporterId
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można przypisać transportera');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Transporter przypisany',
        description: 'Transporter został pomyślnie przypisany do zlecenia',
      });
      
      // Czyścimy stan
      setEditingTransporterOrderId(null);
      setSelectedTransporterId(undefined);
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd przypisywania',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutacja do aktualizacji daty montażu
  const updateInstallationDateMutation = useMutation({
    mutationFn: async (params: { id: number; installationDate: Date; installationStatus?: string }) => {
      const { id, installationDate, installationStatus } = params;
      
      const response = await apiRequest('PATCH', `/api/orders/${id}/installation-date`, {
        installationDate: installationDate.toISOString(),
        installationStatus
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować daty montażu');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Data montażu zaktualizowana',
        description: 'Data montażu została pomyślnie zaktualizowana',
      });
      setEditingInstallationDateOrderId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutacja do aktualizacji daty transportu
  const updateTransportDateMutation = useMutation({
    mutationFn: async (params: { id: number; transportDate: Date; transportStatus?: string }) => {
      const { id, transportDate, transportStatus } = params;
      
      const response = await apiRequest('PATCH', `/api/orders/${id}/transport-date`, {
        transportDate: transportDate.toISOString(),
        transportStatus
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować daty transportu');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Data transportu zaktualizowana',
        description: 'Data transportu została pomyślnie zaktualizowana',
      });
      setEditingTransportDateOrderId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Mutacja do aktualizacji pól zamówienia
  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: any }) => {
      const requestData: any = {};
      requestData[field] = value;
      
      const response = await apiRequest('PATCH', `/api/orders/${id}`, requestData);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować zlecenia');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd aktualizacji',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Mutacja do rozliczenia zleceń przez pracowników
  const dateSettlementStatusMutation = useMutation({
    mutationFn: async (params: { id: number; value: boolean }) => {
      const { id, value } = params;
      
      const response = await apiRequest('PATCH', `/api/orders/${id}/settlement-status`, {
        willBeSettled: value
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Nie można zaktualizować statusu rozliczenia');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Status rozliczenia zaktualizowany',
        description: 'Status rozliczenia został pomyślnie zaktualizowany',
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

  // Can create orders logic
  const canCreateOrders = ['admin', 'worker'].includes(user?.role || '');
  
  // Funkcja do dodawania filtrów
  const addFilter = (filter: ActiveFilter) => {
    // Najpierw usuń filtr o tym samym typie, jeśli istnieje
    const existingFilterIndex = activeFilters.findIndex(f => f.type === filter.type);
    
    if (existingFilterIndex !== -1) {
      // Sprawdź, czy wartość jest taka sama - jeśli tak, usuń filtr (toggle)
      if (JSON.stringify(activeFilters[existingFilterIndex].value) === JSON.stringify(filter.value)) {
        const newFilters = [...activeFilters];
        newFilters.splice(existingFilterIndex, 1);
        setActiveFilters(newFilters);
        return;
      }
      // W przeciwnym razie zastąp go nowym filtrem
      const newFilters = [...activeFilters];
      newFilters[existingFilterIndex] = filter;
      setActiveFilters(newFilters);
    } else {
      // Dodaj nowy filtr
      setActiveFilters([...activeFilters, filter]);
    }
    
    // Odśwież listę zleceń
    ordersQuery.refetch();
  };
  
  // Funkcja do usuwania filtrów
  const removeFilter = (filterId: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== filterId));
    
    // Odśwież listę zleceń
    ordersQuery.refetch();
  };
  
  // Funkcja do czyszczenia wszystkich filtrów
  const clearAllFilters = () => {
    setActiveFilters([]);
    
    // Odśwież listę zleceń
    ordersQuery.refetch();
  };

  // Filtrowanie zamówień
  const filterOrders = (orders: Order[] = []) => {
    if (!orders) return [];
    
    return orders.filter(order => {
      // Filtrowanie wg wyszukiwanego tekstu
      if (searchTerm && !order.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !order.installationAddress?.toLowerCase().includes(searchTerm.toLowerCase()) &&
          !order.clientPhone?.includes(searchTerm)) {
        return false;
      }
      
      // Filtrowanie na podstawie aktywnych filtrów
      for (const filter of activeFilters) {
        switch (filter.type) {
          case 'status':
            if (filter.value !== order.installationStatus?.toLowerCase()) {
              return false;
            }
            break;
          case 'transportStatus':
            if (filter.value !== order.transportStatus?.toLowerCase()) {
              return false;
            }
            break;
          case 'settlement':
            if (filter.value !== order.willBeSettled) {
              return false;
            }
            break;
          case 'serviceType':
            if (filter.value !== order.serviceType) {
              return false;
            }
            break;
          case 'transport':
            if (filter.value !== order.withTransport) {
              return false;
            }
            break;
          case 'store':
            if (filter.value !== order.storeId) {
              return false;
            }
            break;
          case 'dateRange':
            {
              const { from, to } = filter.value as { from?: Date, to?: Date };
              if (!from) break;
              
              let dateToCheck: Date | undefined;
              
              // Określ, którą datę sprawdzamy (transport czy montaż) 
              // na podstawie etykiety filtra
              if (filter.label.includes('Montaż')) {
                dateToCheck = order.installationDate ? new Date(order.installationDate) : undefined;
              } else {
                dateToCheck = order.transportDate ? new Date(order.transportDate) : undefined;
              }
              
              if (!dateToCheck) return false;
              
              // Sprawdzenie przedziału dat
              if (to) {
                if (!isWithinInterval(dateToCheck, { start: startOfDay(from), end: endOfDay(to) })) {
                  return false;
                }
              } else {
                if (!isSameDay(dateToCheck, from)) {
                  return false;
                }
              }
            }
            break;
        }
      }
      
      // Jeśli zamówienie przeszło wszystkie filtry, zwracamy true
      return true;
    });
  };

  // Filtrujemy zamówienia
  const filteredOrders = filterOrders(ordersQuery.data);
  
  // Funkcja przypisywania montażysty
  const handleAssignInstaller = (orderId: number) => {
    if (!selectedInstallerId) return;
    
    assignInstallerMutation.mutate({
      id: orderId,
      installerId: selectedInstallerId
    });
  };
  
  // Funkcja przypisywania transportera
  const handleAssignTransporter = (orderId: number) => {
    if (!selectedTransporterId) return;
    
    assignTransporterMutation.mutate({
      id: orderId,
      transporterId: selectedTransporterId
    });
  };
    
  // Obsługa przycisku ustawiania daty montażu
  const handleSetInstallationDate = (orderId: number) => {
    if (!installationDate) return;
    
    updateInstallationDateMutation.mutate({
      id: orderId,
      installationDate,
      installationStatus: selectedInstallationStatus
    });
  };
  
  // Obsługa przycisku ustawiania daty transportu
  const handleSetTransportDate = (orderId: number) => {
    if (!transportDate) return;
    
    updateTransportDateMutation.mutate({
      id: orderId,
      transportDate,
      transportStatus: selectedTransportStatus
    });
  };
  
  // Obsługa przycisku oznaczania faktury jako wystawionej
  const handleToggleInvoice = (orderId: number, currentValue: boolean) => {
    updateOrderMutation.mutate({ 
      id: orderId, 
      field: 'invoiceIssued', 
      value: !currentValue 
    });
  };
  
  // Obsługa przycisku oznaczania zlecenia do rozliczenia
  const handleToggleSettlement = (orderId: number, currentValue: boolean) => {
    // Gdy firma jednoosobowa lub pracownik sklepu (nie kierownik) klika w "do rozliczenia"
    if ((isOnePersonCompany || (user?.role === 'worker' && user?.position !== 'kierownik' && user?.position !== 'zastępca')) && !canModifyFinancialStatus) {
      // Używamy specjalnej ścieżki przez endopoint settlement-status
      dateSettlementStatusMutation.mutate({
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
  
  // Komponent dialogu wyboru montażysty
  const InstallerDialog = () => {
    // Jeśli nie ma aktywnego dialogu, nie renderujemy niczego
    if (!editingInstallerOrderId) return null;
    
    // Pobierz aktualny serviceType z zamówienia
    const order = ordersQuery.data?.find(o => o.id === editingInstallerOrderId);
    const serviceType = order?.serviceType || '';
    
    // Filtruj montażystów według specjalizacji (serviceType)
    const filteredInstallers = installers.filter((installer: any) => {
      // Sprawdź, czy specjalizacja montażysty pasuje do typu usługi
      return Array.isArray(installer.services) && installer.services.some(
        (service: string) => service.toLowerCase().includes(serviceType.toLowerCase())
      );
    });
    
    const closeInstallerDialog = () => {
      setEditingInstallerOrderId(null);
      setSelectedInstallerId(undefined);
    };
    
    return (
      <Dialog open={true} onOpenChange={closeInstallerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wybierz montażystę</DialogTitle>
            <DialogDescription>
              Przypisz montażystę do zlecenia zgodnie z jego specjalizacją.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div className="grid w-full gap-2">
                <p className="text-sm font-medium">Typ usługi: {serviceType}</p>
                <Select
                  value={selectedInstallerId?.toString()}
                  onValueChange={(value) => setSelectedInstallerId(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz montażystę" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredInstallers.length > 0 ? (
                      filteredInstallers.map((installer: any) => (
                        <SelectItem key={installer.id} value={installer.id.toString()}>
                          {installer.firstName} {installer.lastName} 
                          {installer.services && <span className="text-xs text-gray-500"> ({installer.services.join(', ')})</span>}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Brak montażystów z wymaganą specjalizacją
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={closeInstallerDialog}>
              Anuluj
            </Button>
            <Button 
              onClick={() => handleAssignInstaller(editingInstallerOrderId)}
              disabled={!selectedInstallerId || assignInstallerMutation.isPending}
            >
              {assignInstallerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Przypisywanie...
                </>
              ) : (
                <>
                  <UserCircle className="mr-2 h-4 w-4" />
                  Przypisz montażystę
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Komponent dialogu wyboru transportera
  const TransporterDialog = () => {
    // Jeśli nie ma aktywnego dialogu, nie renderujemy niczego
    if (!editingTransporterOrderId) return null;
    
    // Typ usługi
    const serviceType = "Transport";
    
    // Filtruj transporterów
    const filteredTransporters = transporters.filter((transporter: any) => {
      // Sprawdź, czy specjalizacja transportera pasuje do transportu
      return Array.isArray(transporter.services) && transporter.services.some(
        (service: string) => service.toLowerCase().includes('transport')
      );
    });
    
    const closeTransporterDialog = () => {
      setEditingTransporterOrderId(null);
      setSelectedTransporterId(undefined);
    };
    
    return (
      <Dialog open={true} onOpenChange={closeTransporterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wybierz transportera</DialogTitle>
            <DialogDescription>
              Przypisz transportera do zlecenia.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div className="grid w-full gap-2">
                <p className="text-sm font-medium">Typ usługi: {serviceType}</p>
                <Select
                  value={selectedTransporterId?.toString()}
                  onValueChange={(value) => setSelectedTransporterId(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz transportera" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTransporters.length > 0 ? (
                      filteredTransporters.map((transporter: any) => (
                        <SelectItem key={transporter.id} value={transporter.id.toString()}>
                          {transporter.firstName} {transporter.lastName} 
                          {transporter.services && <span className="text-xs text-gray-500"> (Transport)</span>}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Brak transporterów
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={closeTransporterDialog}>
              Anuluj
            </Button>
            <Button 
              onClick={() => handleAssignTransporter(editingTransporterOrderId)}
              disabled={!selectedTransporterId || assignTransporterMutation.isPending}
            >
              {assignTransporterMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Przypisywanie...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" />
                  Przypisz transportera
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  return (
    <div className="container mx-auto px-4 py-4">
      {/* Nagłówek strony */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Zamówienia</h1>
          <p className="text-gray-500 mt-1">Zarządzaj wszystkimi zleceniami</p>
        </div>
        
        {/* Przycisk dodawania nowego zamówienia */}
        {canCreateOrders && (
          <Button onClick={handleCreateNewOrder} className="mt-4 sm:mt-0">
            <Plus className="h-4 w-4 mr-1" />
            Nowe zlecenie
          </Button>
        )}
      </div>
      
      {/* Sekcja filtrowania i wyszukiwania */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Pole wyszukiwania */}
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Szukaj po nazwie, adresie lub numerze telefonu"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Przyciski filtrowania */}
        <div className="md:col-span-8 flex flex-wrap gap-2 items-center">
          {/* Mobile filter button (visible only on small screens) */}
          <Button 
            variant="outline" 
            size="sm" 
            className="md:hidden flex items-center"
            onClick={() => setIsFilterDrawerOpen(true)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtry
          </Button>
          
          {/* Desktop filter button (hidden on small screens) */}
          <Button 
            variant="outline" 
            size="sm" 
            className="hidden md:flex items-center"
            onClick={() => setIsFilterDialogOpen(true)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtruj
          </Button>
          
          {/* Aktywne filtry */}
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter) => (
              <div 
                key={filter.id} 
                className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm flex items-center"
              >
                <span>{filter.label}</span>
                <button 
                  onClick={() => removeFilter(filter.id)}
                  className="ml-2 text-primary-600 hover:text-primary-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            
            {activeFilters.length > 0 && (
              <button 
                onClick={clearAllFilters}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Lista zamówień */}
      <Card>
        <CardHeader className="p-4 pb-0">
          <CardTitle>Lista zleceń</CardTitle>
          <CardDescription>
            {ordersQuery.isLoading ? (
              "Wczytywanie danych..."
            ) : filteredOrders.length === 0 ? (
              "Brak zleceń spełniających wybrane kryteria"
            ) : (
              `Znaleziono ${filteredOrders.length} zleceń spełniających wybrane kryteria`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          {ordersQuery.isLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="mt-2 text-gray-500">Wczytywanie zleceń...</p>
            </div>
          ) : (
            <>
              {/* Widok mobilny - karty */}
              <div className="md:hidden space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-lg border p-4 space-y-3">
                    {/* Pierwsza sekcja: Nazwa klienta i adres */}
                    <div className="flex flex-col">
                      <div className="font-semibold text-lg">{order.clientName}</div>
                      <div className="text-gray-600 text-sm">
                        <div className="flex items-start mt-1">
                          <MapPin className="h-4 w-4 mr-1 text-gray-500 mt-0.5 flex-shrink-0" />
                          <span>{order.installationAddress}</span>
                        </div>
                        <div className="flex items-center mt-1">
                          <Phone className="h-4 w-4 mr-1 text-gray-500" />
                          <a href={`tel:${order.clientPhone}`} className="text-primary-600">
                            {order.clientPhone}
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    {/* Linia oddzielająca */}
                    <div className="border-t border-gray-200 mb-3"></div>
                    
                    {/* Druga sekcja: Typ usługi i status */}
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm font-medium">
                          {order.serviceType?.includes('drzwi') ? (
                            <DoorOpen className="h-4 w-4 mr-1 text-gray-500" />
                          ) : (
                            <Home className="h-4 w-4 mr-1 text-gray-500" />
                          )}
                          {order.serviceType}
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.installationStatus || '')}`}>
                            {formatInstallationStatus(order.installationStatus) || 'Nowe'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Przyciski przypisywania montażysty i transportera (widoczne tylko dla właściciela firmy) */}
                      {isCompanyOwner && order.companyId === user?.companyId && (
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openInstallerDialog(order.id)}
                            title="Przypisz montażystę"
                          >
                            <Hammer className="h-4 w-4" />
                          </Button>
                          
                          {order.withTransport && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTransporterDialog(order.id)}
                              title="Przypisz transportera"
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Linia oddzielająca */}
                    <div className="border-t border-gray-200 mb-3"></div>
                    
                    {/* Trzecia sekcja: Informacje o transporcie (jeśli jest) */}
                    {order.withTransport && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Truck className="h-4 w-4 mr-1 text-gray-500" />
                              <span className="text-sm font-medium">Transport:</span>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.transportStatus || '')}`}>
                              {formatTransportStatus(order.transportStatus) || 'Nowy'}
                            </span>
                          </div>
                          
                          <div className="flex items-center text-xs text-gray-600">
                            <button 
                              className="flex items-center hover:bg-gray-100 p-0.5 rounded"
                              onClick={() => {
                                // Otwarcie edytora daty transportu
                                const currentOrder = order;
                                openTransportDateEditor(order.id, order.transportDate);
                                
                                // Ustaw aktualny status transportu
                                if (currentOrder.transportStatus) {
                                  setSelectedTransportStatus(currentOrder.transportStatus);
                                } else {
                                  setSelectedTransportStatus('transport zaplanowany');
                                }
                              }}
                            >
                              <Calendar className="h-3.5 w-3.5 mr-1 text-gray-500" />
                              {order.transportDate ? (
                                <span>{new Date(order.transportDate).toLocaleDateString('pl-PL')}</span>
                              ) : (
                                <span className="text-gray-400 italic">nieustalona</span>
                              )}
                              <Pencil className="h-3 w-3 text-gray-500 ml-1" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Linia oddzielająca */}
                        <div className="border-t border-gray-200 mb-3"></div>
                      </>
                    )}
                    
                    {/* Czwarta sekcja: Dane montażysty (jeśli jest przypisany) */}
                    {order.installerName && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <Hammer className="h-4 w-4 mr-1 text-gray-500" />
                            <span className="text-sm font-medium">Montażysta:</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {order.installerName}
                          </div>
                        </div>
                        
                        {/* Linia oddzielająca */}
                        <div className="border-t border-gray-200 mb-3"></div>
                      </>
                    )}
                    
                    {/* Piąta sekcja: Data montażu */}
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <CalendarClock className="h-4 w-4 mr-1 text-gray-500" />
                        <span className="text-sm font-medium">Data montażu:</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <button 
                          className="flex items-center hover:bg-gray-100 p-0.5 rounded"
                          onClick={() => {
                            // Otwarcie edytora daty montażu
                            const currentOrder = order;
                            openInstallationDateEditor(order.id, order.installationDate);
                            
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
                    </div>
                    
                    {/* Linia oddzielająca */}
                    <div className="border-t border-gray-200 mb-3"></div>
                    
                    {/* Szósta sekcja: "Do rozliczenia" i przycisk szczegółów */}
                    <div className="flex items-center justify-between">
                      {isAnyCompany && (
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
                      {/* Dla transporterów pokazujemy status transportu zamiast statusu zamówienia */}
                      <th scope="col" className="px-4 py-3">
                        {isTransporter ? "Transport" : "Status"}
                      </th>
                      {/* Kolumna Montaż */}
                      {isTransporter && (
                        <th scope="col" className="px-4 py-3">Montaż</th>
                      )}
                      {/* Dla wszystkich firm pokazujemy kolumnę "Do rozliczenia" */}
                      {isAnyCompany && (
                        <th scope="col" className="px-3 py-3 text-center">Do rozliczenia</th>
                      )}
                      {/* Kolumny przypisywania montażysty i transportera (widoczne tylko dla właściciela firmy) */}
                      {isCompanyOwner && (
                        <th scope="col" className="px-4 py-3">Przypisz</th>
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
                                    ) : (
                                      <div className="font-medium">{fullAddress}</div>
                                    )}
                                  </div>
                                </a>
                              );
                            }
                            
                            // Dla pozostałych użytkowników adres nie jest klikalny
                            return (
                              <div className="flex flex-col">
                                {addressParts.length >= 2 ? (
                                  <>
                                    <div className="font-medium">{addressParts[0].trim()}</div>
                                    <div className="text-sm text-gray-600">
                                      {addressParts.slice(1).join(',').trim()}
                                    </div>
                                  </>
                                ) : (
                                  <div className="font-medium">{fullAddress}</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          {isTransporter ? (
                            <a 
                              href={`tel:${order.clientPhone}`}
                              className="text-primary-600 hover:underline flex items-center"
                            >
                              <Phone className="h-4 w-4 mr-1 text-primary-600" />
                              {order.clientPhone}
                            </a>
                          ) : (
                            <span>{order.clientPhone}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            {order.serviceType?.includes('drzwi') ? (
                              <DoorOpen className="h-4 w-4 mr-1.5 text-gray-500" />
                            ) : (
                              <Home className="h-4 w-4 mr-1.5 text-gray-500" />
                            )}
                            <span>{order.serviceType}</span>
                          </div>
                          
                          {/* Montażysta przypisany do zlecenia */}
                          {order.installerName && (
                            <div className="text-xs text-gray-500 mt-1 flex items-center">
                              <Users className="h-3 w-3 mr-1" />
                              {order.installerName}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isTransporter ? (
                            <div className="flex flex-col space-y-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.transportStatus || '')}`}>
                                {formatTransportStatus(order.transportStatus) || 'Nowy'}
                              </span>
                              <div className="flex items-center text-xs text-gray-600">
                                {order.withTransport ? (
                                  <button 
                                    className="flex items-center hover:bg-gray-100 p-0.5 rounded"
                                    onClick={() => {
                                      // Otwarcie edytora daty transportu
                                      const currentOrder = order;
                                      openTransportDateEditor(order.id, order.transportDate);
                                      
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
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeVariant(order.installationStatus || '')}`}>
                              {formatInstallationStatus(order.installationStatus) || 'Nie określono'}
                            </span>
                          )}
                        </td>
                        
                        {/* Kolumna Montaż dla transporterów */}
                        {isTransporter && (
                          <td className="px-4 py-3">
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
                                    openInstallationDateEditor(order.id, order.installationDate);
                                    
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
                          </td>
                        )}
                        
                        {/* Kolumna "Do rozliczenia" - dla wszystkich firm, jednakowy interfejs */}
                        {isAnyCompany && (
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
                        

                        
                        {/* Kolumna przypisywania montażysty i transportera (widoczna tylko dla właściciela firmy) */}
                        {isCompanyOwner && (
                          <td className="px-4 py-3">
                            <div className="flex space-x-2">
                              {/* Przycisk przypisywania montażysty */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openInstallerDialog(order.id)}
                                title="Przypisz montażystę"
                                className={order.companyId === user?.companyId ? "" : "opacity-50 cursor-not-allowed"}
                                disabled={order.companyId !== user?.companyId}
                              >
                                <Hammer className="h-4 w-4" />
                              </Button>
                              
                              {/* Przycisk przypisywania transportera (tylko jeśli zlecenie ma transport) */}
                              {order.withTransport && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openTransporterDialog(order.id)}
                                  title="Przypisz transportera"
                                  className={order.companyId === user?.companyId ? "" : "opacity-50 cursor-not-allowed"}
                                  disabled={order.companyId !== user?.companyId}
                                >
                                  <Truck className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                        
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order.id)}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Szczegóły
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog kalendarza dla daty transportu */}
      <Popover open={!!editingTransportDateOrderId} onOpenChange={(open) => !open && setEditingTransportDateOrderId(null)}>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="space-y-2">
              <h3 className="font-medium text-base">Ustaw datę transportu</h3>
              <p className="text-sm text-gray-500">
                Wybierz datę i status transportu
              </p>
            </div>
            
            {/* Status transportu */}
            <div className="mt-4">
              <label className="text-sm font-medium">Status transportu:</label>
              <Select
                value={selectedTransportStatus}
                onValueChange={setSelectedTransportStatus}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Wybierz status" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Wybór transportera - widoczny tylko dla właściciela firmy z pracownikami */}
            {isCompanyOwner && (
              <div className="mt-4">
                <label className="text-sm font-medium">Transporter:</label>
                <Select
                  value={selectedTransporterId?.toString()}
                  onValueChange={(value) => setSelectedTransporterId(Number(value))}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Wybierz transportera" />
                  </SelectTrigger>
                  <SelectContent>
                    {transporters.length > 0 ? (
                      transporters
                        .filter((transporter: any) => 
                          Array.isArray(transporter.services) && 
                          transporter.services.some((service: string) => service.toLowerCase().includes('transport'))
                        )
                        .map((transporter: any) => (
                          <SelectItem key={transporter.id} value={transporter.id.toString()}>
                            {transporter.firstName} {transporter.lastName}
                            <span className="text-xs text-gray-500"> (Transport)</span>
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Brak transporterów
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Wybór daty */}
            <div className="mt-4">
              <label className="text-sm font-medium">Data transportu:</label>
              <div className="mt-1">
                <CalendarUI
                  mode="single"
                  selected={transportDate}
                  onSelect={setTransportDate}
                  initialFocus
                />
              </div>
            </div>
            
            {/* Przyciski */}
            <div className="flex justify-between mt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditingTransportDateOrderId(null)}
              >
                Anuluj
              </Button>
              
              <Button 
                onClick={() => {
                  if (editingTransportDateOrderId && transportDate) {
                    // Jeśli wybrano transportera, przypisz go najpierw
                    if (isCompanyOwner && selectedTransporterId) {
                      assignTransporterMutation.mutate({
                        id: editingTransportDateOrderId,
                        transporterId: selectedTransporterId
                      });
                    }
                    
                    // Ustaw datę transportu
                    handleSetTransportDate(editingTransportDateOrderId);
                  }
                }}
                disabled={!transportDate || updateTransportDateMutation.isPending || assignTransporterMutation.isPending}
              >
                {updateTransportDateMutation.isPending || assignTransporterMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Zapisz
                  </>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Dialog kalendarza dla daty montażu */}
      <Popover open={!!editingInstallationDateOrderId} onOpenChange={(open) => !open && setEditingInstallationDateOrderId(null)}>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="space-y-2">
              <h3 className="font-medium text-base">Ustaw datę montażu</h3>
              <p className="text-sm text-gray-500">
                Wybierz datę i status montażu
              </p>
            </div>
            
            {/* Status montażu */}
            <div className="mt-4">
              <label className="text-sm font-medium">Status montażu:</label>
              <Select
                value={selectedInstallationStatus}
                onValueChange={setSelectedInstallationStatus}
              >
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Wybierz status" />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLATION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Wybór montażysty - widoczny tylko dla właściciela firmy z pracownikami */}
            {isCompanyOwner && (
              <div className="mt-4">
                <label className="text-sm font-medium">Montażysta:</label>
                <Select
                  value={selectedInstallerId?.toString()}
                  onValueChange={(value) => setSelectedInstallerId(Number(value))}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Wybierz montażystę" />
                  </SelectTrigger>
                  <SelectContent>
                    {installers.length > 0 ? (
                      installers
                        .filter((installer: any) => {
                          // Pobierz typ usługi z zamówienia
                          const order = ordersQuery.data?.find((o: any) => o.id === editingInstallationDateOrderId);
                          const serviceType = order?.serviceType || '';
                          
                          // Sprawdź czy montażysta ma odpowiednią specjalizację
                          return Array.isArray(installer.services) && 
                            installer.services.some(
                              (service: string) => service.toLowerCase().includes(serviceType.toLowerCase())
                            );
                        })
                        .map((installer: any) => (
                          <SelectItem key={installer.id} value={installer.id.toString()}>
                            {installer.firstName} {installer.lastName}
                            <span className="text-xs text-gray-500"> ({installer.services?.join(', ')})</span>
                          </SelectItem>
                        ))
                    ) : (
                      <SelectItem value="none" disabled>
                        Brak montażystów z wymaganą specjalizacją
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Wybór daty */}
            <div className="mt-4">
              <label className="text-sm font-medium">Data montażu:</label>
              <div className="mt-1">
                <CalendarUI
                  mode="single"
                  selected={installationDate}
                  onSelect={setInstallationDate}
                  initialFocus
                />
              </div>
            </div>
            
            {/* Przyciski */}
            <div className="flex justify-between mt-4">
              <Button 
                variant="outline" 
                onClick={() => setEditingInstallationDateOrderId(null)}
              >
                Anuluj
              </Button>
              
              <Button 
                onClick={() => {
                  if (editingInstallationDateOrderId && installationDate) {
                    // Jeśli wybrano montażystę, przypisz go najpierw
                    if (isCompanyOwner && selectedInstallerId) {
                      assignInstallerMutation.mutate({
                        id: editingInstallationDateOrderId,
                        installerId: selectedInstallerId
                      });
                    }
                    
                    // Ustaw datę montażu
                    handleSetInstallationDate(editingInstallationDateOrderId);
                  }
                }}
                disabled={!installationDate || updateInstallationDateMutation.isPending || assignInstallerMutation.isPending}
              >
                {updateInstallationDateMutation.isPending || assignInstallerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Zapisz
                  </>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Usuwamy niepotrzebne komponenty dialogów */}
    </div>
  );
}