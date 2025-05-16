import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, addDays, isBefore, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { 
  AlertTriangle, FileText, Phone, Calendar, Package, 
  Truck, Map, User, BarChart3, Download, 
  Camera, Upload, X, Loader2, Trash2, ClipboardList, MessageCircle, Pencil, RotateCw,
  Building, Check, Wrench, Mic, MicOff
} from 'lucide-react';
import { SpeechRecognitionDialog } from '@/components/ui/SpeechRecognitionDialog';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { ClickableAddress } from '@/components/address';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { BackButton } from '@/components/ui/back-button';
import { UpdateOrderStatus } from '@shared/schema';

// Funkcja do formatowania statusów transportu na bardziej przyjazne dla użytkownika
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
    case 'transport dostarczony':
      return 'Dostarczony';
    
    default:
      return status;
  }
}

// Funkcja zwracająca styl badge dla statusu transportu
function getTransportStatusBadgeVariant(status: string | null | undefined): "default" | "secondary" | "outline" | "destructive" {
  if (!status) return "outline";
  
  switch (status) {
    case 'skompletowany':
    case 'gotowe do transportu':
      return "secondary";
    case 'zaplanowany':
    case 'transport zaplanowany':
      return "outline";
    case 'dostarczony':
    case 'transport dostarczony':
      return "default";
    default:
      return "outline";
  }
}

interface OrderDetailsProps {
  orderId?: string;
}

export default function OrderDetails({ orderId }: OrderDetailsProps) {
  const params = useParams();
  const id = orderId || params.id;
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Stan lokalny dla edycji zlecenia
  const [status, setStatus] = useState<string | null>(null);
  const [comments, setComments] = useState<string>('');
  const [complaintNotes, setComplaintNotes] = useState<string>('');
  const [invoiceIssued, setInvoiceIssued] = useState<boolean>(false);
  const [willBeSettled, setWillBeSettled] = useState<boolean>(false);
  const [documentsProvided, setDocumentsProvided] = useState<boolean>(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState<boolean>(false);
  const [showSpeechDialog, setShowSpeechDialog] = useState<boolean>(false);
  
  // Stan dla przypisywania montażysty
  const [statusForm, setStatusForm] = useState<any>({});
  const [selectedInstallerId, setSelectedInstallerId] = useState<number | null>(null);
  const [selectedTransporterId, setSelectedTransporterId] = useState<number | null>(null);
  
  // Stan dla okna dialogowego edycji montażu (status, data, montażysta)
  const [isEditInstallationDialogOpen, setIsEditInstallationDialogOpen] = useState<boolean>(false);
  const [editInstallationDate, setEditInstallationDate] = useState<Date | undefined>(undefined);
  const [editInstallationStatus, setEditInstallationStatus] = useState<string>('');
  const [editInstallerId, setEditInstallerId] = useState<number | undefined>();
  
  // Stan dla okna dialogowego edycji transportu (status, data, transporter)
  const [isEditTransportDialogOpen, setIsEditTransportDialogOpen] = useState<boolean>(false);
  const [editTransportDate, setEditTransportDate] = useState<Date | undefined>(undefined);
  const [editTransportStatus, setEditTransportStatus] = useState<string>('');
  
  // Stan dla listy dostępnych montażystów i transporterów
  const [availableInstallers, setAvailableInstallers] = useState<any[]>([]);
  const [availableTransporters, setAvailableTransporters] = useState<any[]>([]);
  const [editTransporterId, setEditTransporterId] = useState<number | undefined>();
  const [isUpdatingTransportDetails, setIsUpdatingTransportDetails] = useState<boolean>(false);
  const [isTransporterSelectOpen, setIsTransporterSelectOpen] = useState<boolean>(false);
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState<boolean>(false);
  const [isInstallerSelectOpen, setIsInstallerSelectOpen] = useState<boolean>(false);
  const [showCommentDialog, setShowCommentDialog] = useState<boolean>(false);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState<boolean>(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [installerSelectDate, setInstallerSelectDate] = useState<Date | undefined>(undefined);
  const [transporterSelectDate, setTransporterSelectDate] = useState<Date | undefined>(undefined);
  const [calendar, setCalendar] = useState<{
    installationDate: Date | undefined;
    transportDate: Date | undefined;
  }>({
    installationDate: undefined,
    transportDate: undefined
  });

  // Pobieranie danych zlecenia
  // Poprawne typowanie dla obiektu zamówienia
  const { data: order = {}, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/orders/${id}`],
    refetchOnWindowFocus: false,
  });
  
  // Funkcja pobierająca dostępnych montażystów z odpowiednią specjalizacją
  const fetchAvailableInstallers = async (serviceType?: string) => {
    try {
      const response = await fetch(`/api/installers?serviceType=${serviceType || ''}`);
      if (response.ok) {
        const data = await response.json();
        // Przekształć dane na format potrzebny dla komponentu Select
        const formattedInstallers = data.map((installer: any) => ({
          id: installer.id,
          name: installer.name || installer.email.split('@')[0],
          email: installer.email,
          services: installer.services
        }));
        setAvailableInstallers(formattedInstallers);
      } else {
        console.error('Nie udało się pobrać listy montażystów');
        setAvailableInstallers([]);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania montażystów:', error);
      setAvailableInstallers([]);
    }
  };
  
  // Funkcja pobierająca dostępnych transporterów
  const fetchAvailableTransporters = async () => {
    try {
      const response = await fetch('/api/transporters');
      if (response.ok) {
        const data = await response.json();
        // Przekształć dane na format potrzebny dla komponentu Select
        const formattedTransporters = data.map((transporter: any) => ({
          id: transporter.id,
          name: transporter.name || transporter.email.split('@')[0],
          email: transporter.email,
          services: transporter.services
        }));
        setAvailableTransporters(formattedTransporters);
      } else {
        console.error('Nie udało się pobrać listy transporterów');
        setAvailableTransporters([]);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania transporterów:', error);
      setAvailableTransporters([]);
    }
  };
  
  // Funkcja otwierająca dialog edycji montażu
  const openEditInstallationDialog = () => {
    if (!order) return;
    
    // Ustawiamy początkowe wartości
    if (order.installationDate) {
      setEditInstallationDate(new Date(order.installationDate));
    } else {
      setEditInstallationDate(undefined);
    }
    
    // Ustawiamy status
    if (order.installationStatus) {
      setEditInstallationStatus(order.installationStatus);
    } else {
      setEditInstallationStatus('Zaplanowane');
    }
    
    // Ustawiamy montażystę
    if (order.installerId) {
      setEditInstallerId(order.installerId);
    } else {
      setEditInstallerId(undefined);
    }
    
    // Pobieramy listę dostępnych montażystów
    if (user?.role === 'company' && order) {
      fetchAvailableInstallers(order.serviceType);
    }
    
    // Otwieramy dialog
    setIsEditInstallationDialogOpen(true);
  };
  
  // Funkcja otwierająca dialog edycji transportu
  const openEditTransportDialog = () => {
    if (!order) return;
    
    // Ustawiamy początkowe wartości
    if (order.transportDate) {
      setEditTransportDate(new Date(order.transportDate));
    } else {
      setEditTransportDate(undefined);
    }
    
    // Ustawiamy status
    if (order.transportStatus) {
      setEditTransportStatus(order.transportStatus);
    } else {
      setEditTransportStatus('zaplanowany');
    }
    
    // Ustawiamy transportera
    if (order.transporterId) {
      setEditTransporterId(order.transporterId);
    } else {
      setEditTransporterId(undefined);
    }
    
    // Pobieramy listę dostępnych transporterów
    if (user?.role === 'company') {
      fetchAvailableTransporters();
    }
    
    // Otwieramy dialog
    setIsEditTransportDialogOpen(true);
  };
  
  // Efekt aktualizujący lokalne stany po załadowaniu danych zamówienia
  useEffect(() => {
    if (order) {
      // Aktualizuj opis reklamacji, jeśli istnieje w danych zamówienia
      if (order.complaintNotes !== undefined) {
        setComplaintNotes(order.complaintNotes || '');
      }
      
      // Aktualizujemy inne stany formularza
      if (order.willBeSettled !== undefined) {
        setWillBeSettled(order.willBeSettled);
      }
      
      if (order.invoiceIssued !== undefined) {
        setInvoiceIssued(order.invoiceIssued);
      }
      
      if (order.documentsProvided !== undefined) {
        setDocumentsProvided(order.documentsProvided);
      }
    }
  }, [order]);
  
  // Stan dla aktywnej zakładki, z domyślną wartością zależną od statusu zlecenia i roli użytkownika
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Dla transporterów domyślnie otwórz zakładkę Transport
    if (user?.role === 'installer' && 
        user?.services?.some((s) => s?.toLowerCase().includes('transport'))) {
      return 'transport';
    }
    // Dla pozostałych użytkowników domyślnie otwórz zakładkę Montaż
    return 'installation';
  });

  const [companyDialogOpen, setCompanyDialogOpen] = useState<boolean>(false);
  

  // Sprawdzenie, czy zalogowany użytkownik jest transporterem przypisanym do zlecenia
  const isAssignedTransporter = 
    user?.role === 'installer' && 
    user?.services?.includes('Transport') && 
    order?.transporterId === user?.id;
    
  // Sprawdzenie, czy zalogowany użytkownik ma możliwość transportu (ogólnie)
  // Uwaga: Ta zmienna nie jest już używana do ograniczania dostępu - wszyscy użytkownicy mają dostęp do wszystkich zakładek
  const canProvideTransport = 
    user?.role === 'installer' && 
    user?.services?.some(s => s.toLowerCase().includes('transport'));
    
  // Sprawdzenie, czy zalogowany użytkownik jest montażystą przypisanym do zlecenia
  const isAssignedInstaller = 
    user?.role === 'installer' && 
    user?.services?.includes('Montaż') && 
    order?.installerId === user?.id;
    
  // Sprawdzenie, czy zalogowany użytkownik jest montażystą (ogólnie)
  const isInstaller = 
    user?.role === 'installer' && 
    user?.services?.some(s => s.toLowerCase().includes('montaż'));
  
  // Sprawdzenie, czy zalogowany użytkownik ma dostęp administracyjny
  const isUserAdmin = user?.role === 'admin';
  const isUserWorker = user?.role === 'worker';
  const isUserCompany = user?.role === 'company' && user.companyId === order.companyId;
  
  // Automatyczne ustawianie wybranego montażysty lub transportera na podstawie danych zamówienia
  if (!selectedInstallerId && order.installerId) {
    setSelectedInstallerId(order.installerId);
  }
  
  if (!selectedTransporterId && order.transporterId) {
    setSelectedTransporterId(order.transporterId);
  }

  // Helper do wyświetlania statusów
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'złożone': return 'default';
      case 'zlecenie złożone': return 'info';
      case 'nowe': return 'info';
      case 'zaplanowany': return 'secondary';
      case 'w trakcie': return 'warning';
      case 'zakończony': return 'success';
      case 'reklamacja': return 'destructive';
      case 'zafakturowane': return 'outline';
      // Obsługa starych formatów dla kompatybilności
      case 'montaż zaplanowany': return 'secondary';
      case 'w trakcie montażu': return 'warning';
      case 'montaż wykonany': return 'success';
      case 'wykonane': return 'success';
      default: return 'default';
    }
  };
  
  // Helper do wyświetlania statusów montażu
  const getInstallationStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'nowe': return 'secondary';
      case 'zaplanowany': return 'warning';
      case 'w trakcie': return 'default';
      case 'zakończony': return 'success';
      case 'reklamacja': return 'destructive';
      // Obsługa starych formatów
      case 'Nowe': return 'secondary'; 
      case 'Zaplanowane': return 'warning';
      case 'W realizacji': return 'default';
      case 'Zakończone': return 'success';
      case 'Reklamacja': return 'destructive';
      default: return 'default';
    }
  };
  
  // Helper do wyświetlania statusów transportu
  const getTransportStatusBadgeVariant = (status: string) => {
    switch (status) {
      // Ujednolicone statusy transportu
      case 'skompletowany': return 'info';
      case 'zaplanowany': return 'secondary';
      case 'dostarczony': return 'success';

      // Stare formaty dla kompatybilności
      case 'gotowe do transportu': return 'info';
      case 'transport zaplanowany': return 'secondary';
      case 'transport dostarczony': return 'success';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Sprawdza czy użytkownik może edytować status
  // Identyczne zachowanie dla wszystkich typów firm
  const canEditStatus = 
    (user?.role === 'worker') || 
    (user?.role === 'company' && user.companyId === order.companyId) ||
    ((user?.role === 'installer') && (user.id === order.installerId || user.companyId === order.companyId)) ||
    user?.role === 'admin';
    
  // Sprawdza czy użytkownik może edytować status transportu
  // Identyczne zachowanie dla wszystkich typów firm
  const canEditTransportStatus = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId) ||
    (user?.role === 'installer' && (user.id === order.transporterId || user.companyId === order.companyId));
    
  // Sprawdza czy użytkownik może przypisać transportera
  // Identyczne zachowanie dla wszystkich typów firm
  const canAssignTransporter = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId) ||
    (user?.role === 'installer' && user.companyId === order.companyId);
    
  // Sprawdza czy użytkownik może przypisać montażystę
  // Identyczne zachowanie dla wszystkich typów firm
  const canAssignInstaller = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId) ||
    (user?.role === 'installer' && user.companyId === order.companyId);
    
  // Sprawdza czy użytkownik może zmienić status zamówienia
  // Identyczne zachowanie dla wszystkich typów firm
  const userCanChangeOrderStatus = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId) ||
    // Dodajemy także możliwość zmiany statusu dla pracowników firm (nie tylko montażysty)
    (user?.role === 'installer' && (user.id === order.installerId || user.companyId === order.companyId));
    
  // Sprawdza czy użytkownik jest właścicielem/pracownikiem firmy przypisanej do zlecenia
  // Traktujemy wszystkie firmy tak samo, niezależnie czy są jednoosobowe czy z pracownikami
  const isCompanyMember = 
    (user?.role === 'company' && user.companyId === order.companyId) ||
    (user?.role === 'installer' && user.companyId === order.companyId);
    
  // Sprawdza czy użytkownik może dodawać komentarze
  const canAddComments = 
    isUserAdmin || 
    isUserWorker || 
    isCompanyMember || 
    isAssignedInstaller || 
    isAssignedTransporter;
    
  // Pobieranie montażystów do wyboru przy przypisywaniu
  const { data: installers = [] } = useQuery<any[]>({
    queryKey: ['/api/installers'],
    enabled: canAssignInstaller, // Pobieraj tylko jeśli użytkownik może przypisywać montażystów
  });
  
  // Pobieranie transporterów do wyboru przy przypisywaniu
  const { data: transporters = [] } = useQuery<any[]>({
    queryKey: ['/api/transporters'],
    enabled: canAssignTransporter && order.withTransport, // Pobieraj tylko jeśli zamówienie obejmuje transport
  });
  
  // Pobieranie listy firm do przypisania
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    enabled: isUserAdmin || isUserWorker, // Pobieraj tylko jeśli użytkownik może przypisywać firmy
  });

  // Callback dla zmiany daty montażu
  const handleInstallationDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    // Ustaw datę w lokalnym stanie
    setCalendar({
      ...calendar,
      installationDate: date
    });
    
    // Sprawdź czy data montażu jest odpowiednio późniejsza od daty transportu
    if (order.withTransport && order.transportDate) {
      const transportDate = new Date(order.transportDate);
      
      // Dla usługi montażu drzwi, transport musi być przed montażem
      if (order.serviceType?.toLowerCase().includes('drzwi')) {
        if (date < transportDate) {
          toast({
            title: "Uwaga",
            description: "Data montażu drzwi musi być po dacie transportu",
            variant: "warning"
          });
          return;
        }
      }
      
      // Dla usługi montażu podłogi, transport musi być min. 2 dni przed montażem
      if (order.serviceType?.toLowerCase().includes('podłogi') || order.serviceType?.toLowerCase().includes('podlogi')) {
        const minDate = addDays(transportDate, 2);
        if (date < minDate) {
          toast({
            title: "Uwaga",
            description: "Data montażu podłogi musi być minimum 2 dni po dacie transportu",
            variant: "warning"
          });
          return;
        }
      }
    }
    
    // Zapisz datę w kalendarzu
    setInstallerSelectDate(date);
  };
  
  // Callback dla zmiany daty transportu
  const handleTransportDateChange = (date: Date | undefined) => {
    if (!date) return;
    
    // Ustaw datę w lokalnym stanie
    setCalendar({
      ...calendar,
      transportDate: date
    });
    
    // Sprawdź czy data transportu jest odpowiednio wcześniejsza od daty montażu
    if (order.installationDate) {
      const installationDate = new Date(order.installationDate);
      
      // Dla usługi montażu drzwi, transport musi być przed montażem
      if (order.serviceType?.toLowerCase().includes('drzwi')) {
        if (date > installationDate) {
          toast({
            title: "Uwaga",
            description: "Data transportu musi być przed datą montażu drzwi",
            variant: "warning"
          });
          return;
        }
      }
      
      // Dla usługi montażu podłogi, transport musi być min. 2 dni przed montażem
      if (order.serviceType?.toLowerCase().includes('podłogi') || order.serviceType?.toLowerCase().includes('podlogi')) {
        const maxDate = addDays(installationDate, -2);
        if (date > maxDate) {
          toast({
            title: "Uwaga",
            description: "Data transportu musi być minimum 2 dni przed datą montażu podłogi",
            variant: "warning"
          });
          return;
        }
      }
    }
    
    // Zapisz datę w kalendarzu
    setTransporterSelectDate(date);
  };
  
  // Mutacja dla aktualizacji statusu zamówienia
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: async (data: UpdateOrderStatus) => {
      return apiRequest('PATCH', `/api/orders/${id}/status`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status zlecenia został zaktualizowany",
        variant: "success"
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      setStatusForm({});
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować statusu: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla aktualizacji statusu transportu
  const { mutate: updateTransportStatus, isPending: isUpdatingTransportStatus } = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/orders/${id}/transport-status`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status transportu został zaktualizowany",
        variant: "success"
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      setStatusForm({});
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować statusu transportu: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla aktualizacji statusu finansowego
  const { mutate: updateFinancialStatus, isPending: isUpdatingFinancialStatus } = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/orders/${id}/financial-status`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status finansowy został zaktualizowany",
        variant: "success"
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować statusu finansowego: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla przypisania firmy montażowej
  const { mutate: assignCompany, isPending: isAssigningCompany } = useMutation({
    mutationFn: async (companyId: number) => {
      return apiRequest('PATCH', `/api/orders/${id}/assign-company`, { companyId });
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Firma montażowa została przypisana do zlecenia",
        variant: "success"
      });
      
      setCompanyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się przypisać firmy: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla przypisania montażysty
  const { mutate: assignInstaller, isPending: isAssigningInstaller } = useMutation({
    mutationFn: async (data: { installerId: number, installationDate?: string }) => {
      return apiRequest('PATCH', `/api/orders/${id}/assign-installer`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Montażysta został przypisany do zlecenia",
        variant: "success"
      });
      
      setIsInstallerSelectOpen(false);
      setInstallerSelectDate(undefined);
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się przypisać montażysty: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla zbiorczej aktualizacji statusu montażu, daty i montażysty
  const { mutate: updateInstallationDetails, isPending: isUpdatingInstallationDetails } = useMutation({
    mutationFn: async (data: { 
      installationStatus: string, 
      installationDate?: string,
      installerId?: number 
    }) => {
      // Dla firm z pracownikami, uwzględniamy wybranego montażystę
      if (user?.role === 'company' && user?.companyOwnerOnly === false) {
        return apiRequest('PATCH', `/api/orders/${id}/assign-installer`, {
          installerId: data.installerId,
          installationDate: data.installationDate,
          installationStatus: data.installationStatus
        });
      } else {
        // Dla firm jednoosobowych, wykorzystujemy standardową aktualizację statusu
        return apiRequest('PATCH', `/api/orders/${id}/status`, {
          installationStatus: data.installationStatus,
          installationDate: data.installationDate
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Dane montażu zostały zaktualizowane",
        variant: "success"
      });
      
      // Zamykamy dialog i resetujemy stany
      setIsEditInstallationDialogOpen(false);
      setEditInstallationDate(undefined);
      setEditInstallationStatus('');
      setEditInstallerId(undefined);
      
      // Odświeżamy dane zlecenia
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować danych montażu: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla zbiorczej aktualizacji statusu transportu, daty i transportera
  const { mutate: updateTransportDetails, isPending: isUpdatingTransportDetails } = useMutation({
    mutationFn: async (data: { 
      transportStatus: string, 
      transportDate?: string,
      transporterId?: number 
    }) => {
      // Dla firm z pracownikami, uwzględniamy wybranego transportera
      if (user?.role === 'company' && user?.companyOwnerOnly === false) {
        return apiRequest('PATCH', `/api/orders/${id}/assign-transporter`, {
          transporterId: data.transporterId,
          transportDate: data.transportDate,
          transportStatus: data.transportStatus
        });
      } else {
        // Dla firm jednoosobowych, wykorzystujemy standardową aktualizację statusu
        return apiRequest('PATCH', `/api/orders/${id}/transport-status`, {
          transportStatus: data.transportStatus,
          transportDate: data.transportDate
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Dane transportu zostały zaktualizowane",
        variant: "success"
      });
      
      // Zamykamy dialog i resetujemy stany
      setIsEditTransportDialogOpen(false);
      setEditTransportDate(undefined);
      setEditTransportStatus('');
      setEditTransporterId(undefined);
      
      // Odświeżamy dane zlecenia
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zaktualizować danych transportu: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja dla przypisania transportera
  const { mutate: assignTransporter, isPending: isAssigningTransporter } = useMutation({
    mutationFn: async (data: { transporterId: number, transportDate?: string }) => {
      return apiRequest('PATCH', `/api/orders/${id}/assign-transporter`, data);
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Transporter został przypisany do zlecenia",
        variant: "success"
      });
      
      setIsTransporterSelectOpen(false);
      setTransporterSelectDate(undefined);
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się przypisać transportera: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });

  // Mutacja dla dodawania zdjęć
  const { mutate: uploadPhotos } = useMutation({
    mutationFn: async (files: File[]) => {
      if (!files.length) return null;
      
      const formData = new FormData();
      files.forEach(file => {
        formData.append('photos', file);
      });
      
      setIsSubmittingPhoto(true);
      
      return fetch(`/api/orders/${id}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      }).then(res => {
        if (!res.ok) throw new Error('Błąd podczas dodawania zdjęć');
        return res.json();
      })
      .finally(() => {
        setIsSubmittingPhoto(false);
      });
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Zdjęcia zostały dodane do zlecenia",
        variant: "success"
      });
      
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: `Nie udało się dodać zdjęć: ${error.message || 'Nieznany błąd'}`,
        variant: "destructive"
      });
    }
  });

  // Handler dla aktualizacji statusu zamówienia
  const handleStatusUpdate = () => {
    setIsSubmittingStatus(true);
    
    // Poprawiona zmienna - używamy odpowiednich pól dla różnych statusów
    const status = statusForm.installationStatus || statusForm.transportStatus;
    
    if (!status) {
      toast({
        title: "Błąd",
        description: "Wybierz status",
        variant: "destructive"
      });
      setIsSubmittingStatus(false);
      return;
    }
    
    if (activeTab === 'installation') {
      updateStatus({
        installationStatus: status,
        comments: statusForm.comments
      });
    } else if (activeTab === 'transport') {
      updateTransportStatus({
        transportStatus: status,
        comments: statusForm.comments
      });
    }
    
    setIsSubmittingStatus(false);
  };
  
  // Handler dla aktualizacji wszystkich danych montażu (status, data, montażysta)
  const handleUpdateInstallationDetails = () => {
    if (!editInstallationStatus) {
      toast({
        title: "Błąd",
        description: "Wybierz status montażu",
        variant: "destructive"
      });
      return;
    }
    
    const data: any = {
      installationStatus: editInstallationStatus
    };
    
    // Dodaj datę montażu, jeśli została wybrana
    if (editInstallationDate) {
      data.installationDate = format(editInstallationDate, 'yyyy-MM-dd');
    }
    
    // Dodaj montażystę, jeśli został wybrany (tylko dla firm zatrudniających pracowników)
    if (user?.role === 'company' && user?.companyOwnerOnly === false && editInstallerId) {
      data.installerId = editInstallerId;
    }
    
    // Wywołaj mutację
    updateInstallationDetails(data);
  };
  
  // Handler dla aktualizacji wszystkich danych transportu (status, data, transporter)
  const handleUpdateTransportDetails = () => {
    if (!editTransportStatus) {
      toast({
        title: "Błąd",
        description: "Wybierz status transportu",
        variant: "destructive"
      });
      return;
    }
    
    const data: any = {
      transportStatus: editTransportStatus
    };
    
    // Dodaj datę transportu, jeśli została wybrana
    if (editTransportDate) {
      data.transportDate = format(editTransportDate, 'yyyy-MM-dd');
    }
    
    // Dodaj transportera, jeśli został wybrany (tylko dla firm zatrudniających pracowników)
    if (user?.role === 'company' && user?.companyOwnerOnly === false && editTransporterId) {
      data.transporterId = editTransporterId;
    }
    
    // Wywołaj mutację
    updateTransportDetails(data);
  };
  
  // Handler dla aktualizacji statusu finansowego
  const handleFinancialStatusUpdate = () => {
    updateFinancialStatus({
      invoiceIssued,
      willBeSettled,
      documentsProvided
    });
  };
  
  // Handler dla przypisania montażysty
  const handleAssignInstaller = () => {
    if (!selectedInstallerId) {
      toast({
        title: "Błąd",
        description: "Wybierz montażystę",
        variant: "destructive"
      });
      return;
    }
    
    const data: any = { installerId: selectedInstallerId };
    
    // Dodaj datę montażu jeśli została wybrana
    if (installerSelectDate) {
      data.installationDate = format(installerSelectDate, 'yyyy-MM-dd');
    }
    
    assignInstaller(data);
  };
  
  // Handler dla przypisania transportera
  const handleAssignTransporter = () => {
    if (!selectedTransporterId) {
      toast({
        title: "Błąd",
        description: "Wybierz transportera",
        variant: "destructive"
      });
      return;
    }
    
    const data: any = { transporterId: selectedTransporterId };
    
    // Dodaj datę transportu jeśli została wybrana
    if (transporterSelectDate) {
      data.transportDate = format(transporterSelectDate, 'yyyy-MM-dd');
    }
    
    assignTransporter(data);
  };
  
  // Handler dla wyboru plików
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    
    // Konwertuj FileList na Array
    const fileArray = Array.from(files);
    
    // Sprawdź czy wszystkie pliki to obrazy
    const allImages = fileArray.every(file => file.type.startsWith('image/'));
    
    if (!allImages) {
      toast({
        title: "Błąd",
        description: "Można dodawać tylko zdjęcia",
        variant: "destructive"
      });
      return;
    }
    
    setSelectedFiles(fileArray);
  };
  
  // Handler dla dodawania komentarza
  const handleAddComment = () => {
    setIsSubmittingComment(true);
    
    if (!statusForm.comments?.trim()) {
      toast({
        title: "Błąd",
        description: "Komentarz nie może być pusty",
        variant: "destructive"
      });
      setIsSubmittingComment(false);
      return;
    }
    
    updateStatus({
      installationStatus: order.installationStatus,
      comments: statusForm.comments
    });
    
    setShowCommentDialog(false);
    setIsSubmittingComment(false);
  };
  
  // Handler dla dodawania zdjęć
  const handleUploadPhotos = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Uwaga",
        description: "Wybierz pliki do dodania",
        variant: "warning"
      });
      return;
    }
    
    uploadPhotos(selectedFiles);
  };
  
  // Handler dla przypisania firmy
  const handleAssignCompany = () => {
    if (!selectedCompanyId) {
      toast({
        title: "Błąd",
        description: "Wybierz firmę",
        variant: "destructive"
      });
      return;
    }
    
    assignCompany(selectedCompanyId);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Ładowanie szczegółów zlecenia...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Wystąpił błąd podczas ładowania zlecenia</h1>
        <p className="mt-2 text-gray-500">Nie można pobrać szczegółów zlecenia.</p>
        <Link to="/orders">
          <Button variant="outline" className="mt-4">
            Wróć do listy zleceń
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <BackButton href="/orders" />
        <div className="ml-2">
          <h1 className="text-2xl font-bold">{order.clientName} - {order.serviceType?.toLowerCase()}</h1>
          <p className="text-sm text-gray-500">
            <span>Nr: {order.orderNumber}</span> | <span>Utworzone: {new Date(order.createdAt).toLocaleDateString('pl-PL')}</span>
          </p>
        </div>
      </div>
      
      <Card className="pt-4">
        
        <Tabs defaultValue="installation" value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6 pt-2 border-b">
            <TabsList className="flex w-full justify-center gap-1">
              {/* Zakładka Montaż - zawsze widoczna */}
              <TabsTrigger 
                value="installation" 
                className="data-[state=active]:bg-blue-700 data-[state=active]:text-white flex-1 sm:flex-initial hover:bg-blue-600 hover:text-white"
              >
                <Wrench className="h-5 w-5 md:mr-2 md:h-4 md:w-4" />
                <span className="hidden md:inline">Montaż</span>
              </TabsTrigger>
              
              {/* Zakładka Transport - zawsze widoczna */}
              <TabsTrigger 
                value="transport" 
                className="data-[state=active]:bg-blue-700 data-[state=active]:text-white flex-1 sm:flex-initial hover:bg-blue-600 hover:text-white"
              >
                <Truck className="h-5 w-5 md:mr-2 md:h-4 md:w-4" />
                <span className="hidden md:inline">Transport</span>
              </TabsTrigger>
              
              {/* Zakładka Reklamacja - zawsze widoczna */}
              <TabsTrigger 
                value="complaint" 
                style={{
                  backgroundColor: activeTab === 'complaint' 
                    ? (order.installationStatus || '').toLowerCase() === 'reklamacja' 
                      ? '#dc2626' // red-600
                      : '#1d4ed8' // blue-700
                    : undefined,
                  color: activeTab === 'complaint' ? 'white' : undefined
                }}
                className={`flex-1 sm:flex-initial hover:text-white hover:bg-${
                  (order.installationStatus || '').toLowerCase() === 'reklamacja' 
                    ? 'red-500' 
                    : 'blue-600'
                }`}
              >
                <AlertTriangle 
                  style={{
                    color: activeTab === 'complaint' 
                      ? 'white'
                      : (order.installationStatus || '').toLowerCase() === 'reklamacja'
                        ? '#ef4444' // red-500 
                        : undefined
                  }}
                  className="h-5 w-5 md:mr-2 md:h-4 md:w-4"
                />
                <span className="hidden md:inline">Reklamacja</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <CardContent className="p-3 sm:p-6">
            {/* Zakładka Montaż */}
            <TabsContent value="installation" className="mt-0 p-0 sm:p-3">
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-center mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-blue-800">Panel Montażu</h3>
                    
                    {/* Widoczny tylko dla firm z pracownikami */}
                    {user?.role === 'company' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs h-8"
                        onClick={openEditInstallationDialog}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edytuj montaż
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Szczegóły montażu</h4>
                      <dl className="space-y-3">
                        <div className="flex flex-col">
                          <dt className="text-xs text-gray-500">Adres montażu</dt>
                          <dd className="font-medium break-words">
                            <ClickableAddress 
                              address={order.installationAddress || ''} 
                              iconSize={16}
                            />
                          </dd>
                        </div>
                        
                        <div className="flex flex-col">
                          <dt className="text-xs text-gray-500">Telefon klienta</dt>
                          <dd className="font-medium">
                            <a href={`tel:${order.clientPhone}`} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center font-medium">
                              <Phone className="h-4 w-4 mr-1 text-blue-600" />
                              {order.clientPhone}
                            </a>
                          </dd>
                        </div>
                        
                        {order.installationDate && (
                          <div>
                            <dt className="text-xs text-gray-500">Data montażu</dt>
                            <dd className="font-medium flex items-center">
                              <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                              {new Date(order.installationDate).toLocaleDateString('pl-PL')}
                            </dd>
                          </div>
                        )}

                        <div>
                          <dt className="text-xs text-gray-500">Zakres usługi</dt>
                          <dd className="font-medium flex items-center">
                            <Package className="h-3 w-3 mr-1 text-gray-400" />
                            <span>{order.serviceType}{order.withTransport ? ' + transport' : ''}</span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Status montażu</h4>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs text-gray-500">Status</dt>
                          <dd className="font-medium">
                            <Badge 
                              variant={getInstallationStatusBadgeVariant(order.installationStatus)} 
                              className="text-xs px-2.5 py-0.5"
                            >
                              {order.installationStatus}
                            </Badge>
                          </dd>
                        </div>
                        
                        {(isUserAdmin || isUserWorker) && (
                          <div>
                            <dt className="text-xs text-gray-500">Firma montażowa</dt>
                            <dd className="font-medium">
                              {order.companyName || <span className="text-gray-400 italic">Nie przypisano</span>}
                            </dd>
                          </div>
                        )}
                        
                        {(isUserAdmin || isUserWorker || isUserCompany) && (
                          <div>
                            <dt className="text-xs text-gray-500">Montażysta</dt>
                            <dd className="font-medium">
                              {order.installerName || <span className="text-gray-400 italic">Nie przypisano</span>}
                            </dd>
                          </div>
                        )}
                      </dl>
                      
                      {userCanChangeOrderStatus && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Zmień status montażu</h4>
                          <div className="space-y-3">
                            <div className="flex flex-col space-y-1">
                              <Label htmlFor="status" className="text-xs text-gray-500">Nowy status</Label>
                              <Select 
                                defaultValue={order.installationStatus} 
                                onValueChange={(value) => setStatusForm(prev => ({ ...prev, installationStatus: value }))}
                              >
                                <SelectTrigger className="w-full h-10 mt-1">
                                  <SelectValue placeholder="Wybierz status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Nowe">Nowe</SelectItem>
                                  <SelectItem value="Zaplanowane">Zaplanowane</SelectItem>
                                  <SelectItem value="W realizacji">W realizacji</SelectItem>
                                  <SelectItem value="Zakończone">Zakończone</SelectItem>
                                  <SelectItem value="Reklamacja">Reklamacja</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex flex-col space-y-1">
                              <Label htmlFor="comments" className="text-xs text-gray-500">Komentarz (opcjonalnie)</Label>
                              <Textarea 
                                id="comments" 
                                placeholder="Dodaj komentarz do zmiany statusu" 
                                className="mt-1 min-h-[80px]"
                                value={statusForm.comments || ''}
                                onChange={(e) => setStatusForm(prev => ({ ...prev, comments: e.target.value }))}
                              />
                            </div>
                            
                            <Button 
                              onClick={handleStatusUpdate} 
                              disabled={isUpdatingStatus || !statusForm.installationStatus}
                              className="w-full h-11 text-base"
                            >
                              {isUpdatingStatus ? (
                                <div className="flex items-center justify-center">
                                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                  Aktualizacja...
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  <Check className="h-5 w-5 mr-2" />
                                  Zapisz status montażu
                                </div>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Sekcja zdjęć do zlecenia */}
                {order.photos && order.photos.length > 0 && (
                  <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Zdjęcia do zlecenia</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {order.photos.map((photo: string, index: number) => (
                        <div key={index} className="relative aspect-square rounded-md overflow-hidden">
                          <img
                            src={`/api/photos/${photo}`}
                            alt={`Zdjęcie ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Sekcja dodawania zdjęć */}
                {canAddComments && (
                  <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Dodaj zdjęcia do zlecenia</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                        
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-24 border-dashed flex flex-col items-center justify-center"
                        >
                          <Camera className="h-6 w-6 mb-2" />
                          <span>Wybierz zdjęcia</span>
                        </Button>
                      </div>
                      
                      {selectedFiles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500">Wybrano {selectedFiles.length} plików</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from(selectedFiles).map((file, index) => (
                              <div key={index} className="flex items-center bg-gray-100 rounded-md px-2 py-1">
                                <span className="text-xs truncate max-w-[150px] sm:max-w-xs">{file.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 ml-1"
                                  onClick={() => {
                                    const newFiles = [...selectedFiles];
                                    newFiles.splice(index, 1);
                                    setSelectedFiles(newFiles);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={handleUploadPhotos}
                        disabled={isSubmittingPhoto || selectedFiles.length === 0}
                        className="w-full"
                      >
                        {isSubmittingPhoto ? (
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Przesyłanie...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <Upload className="h-4 w-4 mr-2" />
                            Dodaj zdjęcia
                          </div>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Sekcja komentarzy */}
                {canAddComments && !showCommentDialog && (
                  <div className="flex justify-end p-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCommentDialog(true)}
                      className="w-full sm:w-auto"
                    >
                      <div className="flex items-center">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Dodaj komentarz
                      </div>
                    </Button>
                  </div>
                )}
                
                {/* Dialog komentarza */}
                {showCommentDialog && (
                  <div className="bg-white p-6 rounded-lg border">
                    <h3 className="text-lg font-semibold mb-4">Dodaj komentarz</h3>
                    
                    <div className="space-y-4">
                      <Textarea 
                        placeholder="Wpisz komentarz do zlecenia" 
                        value={statusForm.comments || ''}
                        onChange={(e) => setStatusForm(prev => ({ ...prev, comments: e.target.value }))}
                        rows={3}
                      />
                      
                      <div className="flex flex-wrap justify-end gap-2 mt-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCommentDialog(false);
                            setStatusForm(prev => ({ ...prev, comments: '' }));
                          }}
                          className="flex-1 sm:flex-initial"
                        >
                          Anuluj
                        </Button>
                        
                        <Button
                          className="flex-1 sm:flex-initial"
                          onClick={handleAddComment}
                          disabled={isSubmittingComment || !statusForm.comments?.trim()}
                        >
                          {isSubmittingComment ? (
                            <div className="flex items-center">
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Zapisywanie...
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              Dodaj komentarz
                            </div>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Transport Tab - For transporters */}
            <TabsContent value="transport" className="mt-0 p-1 sm:p-3">
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">Panel Transportu</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Szczegóły dostawy</h4>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs text-gray-500">Adres dostawy</dt>
                          <dd className="font-medium">
                            <ClickableAddress 
                              address={order.installationAddress || ''} 
                              iconSize={16}
                            />
                          </dd>
                        </div>
                        
                        <div>
                          <dt className="text-xs text-gray-500">Telefon klienta</dt>
                          <dd className="font-medium">
                            <a href={`tel:${order.clientPhone}`} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center font-medium">
                              <Phone className="h-3 w-3 mr-1 text-blue-600" />
                              {order.clientPhone}
                            </a>
                          </dd>
                        </div>
                        
                        {order.transportDate && (
                          <div>
                            <dt className="text-xs text-gray-500">Data transportu</dt>
                            <dd className="font-medium flex items-center">
                              <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                              {new Date(order.transportDate).toLocaleDateString('pl-PL')}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Status transportu</h4>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs text-gray-500">Status</dt>
                          <dd className="font-medium">
                            {order.transportStatus ? (
                              <Badge 
                                variant={getTransportStatusBadgeVariant(order.transportStatus)} 
                                className="text-xs px-2.5 py-0.5"
                              >
                                {formatTransportStatus(order.transportStatus)}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 italic">Nie określono</span>
                            )}
                          </dd>
                        </div>
                        
                        {(isUserAdmin || isUserWorker || isUserCompany) && (
                          <div>
                            <dt className="text-xs text-gray-500">Transporter</dt>
                            <dd className="font-medium">
                              {order.transporterName || <span className="text-gray-400 italic">Nie przypisano</span>}
                            </dd>
                          </div>
                        )}
                        
                        {/* Przycisk edycji transportu - działa tak samo dla obu typów firm */}
                        {canAssignTransporter && (
                          <div className="mt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full flex items-center justify-center"
                              onClick={openEditTransportDialog}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1.5" />
                              Edytuj transport
                            </Button>
                          </div>
                        )}
                      </dl>
                      
                      {canEditTransportStatus && order.withTransport && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Zmień status transportu</h4>
                          <div className="space-y-3">
                            <div className="flex flex-col space-y-1">
                              <Label htmlFor="transportStatus" className="text-xs text-gray-500">Nowy status</Label>
                              <Select 
                                defaultValue={order.transportStatus || ''} 
                                onValueChange={(value) => setStatusForm(prev => ({ ...prev, transportStatus: value }))}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Wybierz status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="skompletowany">Skompletowany</SelectItem>
                                  <SelectItem value="zaplanowany">Zaplanowany</SelectItem>
                                  <SelectItem value="dostarczony">Dostarczony</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex flex-col space-y-1">
                              <Label htmlFor="transportComments" className="text-xs text-gray-500">Komentarz (opcjonalnie)</Label>
                              <Textarea 
                                id="transportComments" 
                                placeholder="Dodaj komentarz do zmiany statusu" 
                                className="mt-1"
                                value={statusForm.comments || ''}
                                onChange={(e) => setStatusForm(prev => ({ ...prev, comments: e.target.value }))}
                              />
                            </div>
                            
                            <Button 
                              onClick={handleStatusUpdate} 
                              disabled={isUpdatingTransportStatus || !statusForm.transportStatus}
                              className="w-full"
                            >
                              {isUpdatingTransportStatus ? (
                                <div className="flex items-center">
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Aktualizacja...
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Truck className="h-4 w-4 mr-2" />
                                  Zapisz status transportu
                                </div>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            {/* Complaint Tab */}
            <TabsContent value="complaint" className="mt-0 p-0 sm:p-3">
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-red-50 p-4 sm:p-6 rounded-lg border border-red-200">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-red-800">Reklamacja</h3>
                  
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    <div className="flex flex-col space-y-1">
                      <Label htmlFor="complaintNotes" className="text-sm font-medium">Opis reklamacji</Label>
                      <div className="relative mt-2">
                        <Textarea 
                          id="complaintNotes" 
                          placeholder="Wpisz informacje dotyczące reklamacji" 
                          className="pr-12 min-h-[120px] sm:min-h-[150px] text-base"
                          value={complaintNotes}
                          onChange={(e) => setComplaintNotes(e.target.value)}
                          disabled={!userCanChangeOrderStatus || (order.installationStatus.toLowerCase() !== 'reklamacja')}
                        />
                        {userCanChangeOrderStatus && order.installationStatus.toLowerCase() === 'reklamacja' && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute right-2 top-2 h-14 w-14 bg-primary/10 rounded-full shadow-md hover:bg-primary/20 border border-primary/20 flex items-center justify-center"
                            onClick={() => {
                              // W środowisku Replit obsługa Web Speech API może nie działać,
                              // dlatego wyświetlamy tylko informację o funkcji
                              if (typeof window['webkitSpeechRecognition'] === 'undefined' && 
                                  typeof window['SpeechRecognition'] === 'undefined') {
                                toast({
                                  title: "Funkcja rozpoznawania mowy",
                                  description: "Ta funkcja będzie dostępna w przeglądarce na urządzeniu końcowym."
                                });
                                return;
                              }
                              
                              // Otwórz dialog pełnoekranowy do dyktowania
                              setShowSpeechDialog(true);
                            }}>
                            <Mic className="h-7 w-7 text-primary" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Complaint Photos Section */}
                    <div className="mt-4">
                      <Label className="text-sm font-medium mb-2 block">Zdjęcia reklamacyjne</Label>
                      
                      {/* Display existing photos */}
                      {order.complaintPhotos && order.complaintPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                          {order.complaintPhotos.map((photoUrl: string, index: number) => {
                            // Obsługa zarówno pełnych URL jak i ID zdjęcia
                            const photoId = photoUrl.includes('/api/photos/') 
                              ? photoUrl.split('/').pop() 
                              : photoUrl;
                            
                            const fullPhotoUrl = photoUrl.startsWith('/api/photos/') 
                              ? photoUrl 
                              : `/api/photos/${photoUrl}`;
                            
                            return (
                              <div key={index} className="relative group">
                                <a 
                                  href={fullPhotoUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <img 
                                    src={fullPhotoUrl} 
                                    alt={`Reklamacja ${index + 1}`} 
                                    className="w-full h-28 sm:h-32 object-cover rounded-md border border-gray-200 shadow-sm"
                                  />
                                </a>
                                
                                {userCanChangeOrderStatus && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const res = await apiRequest('DELETE', `/api/orders/${id}/photos`, {
                                          photo: photoUrl
                                        });
                                        
                                        if (res.ok) {
                                          toast({
                                            title: "Usunięto",
                                            description: "Zdjęcie zostało usunięte",
                                            variant: "default"
                                          });
                                          queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
                                        } else {
                                          throw new Error("Nie udało się usunąć zdjęcia");
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Błąd",
                                          description: "Nie udało się usunąć zdjęcia",
                                          variant: "destructive"
                                        });
                                      }
                                    }}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 mt-2">Brak zdjęć reklamacyjnych</div>
                      )}
                      
                      {/* Upload photos section */}
                      {userCanChangeOrderStatus && order.installationStatus.toLowerCase() === 'reklamacja' && (
                        <div className="mt-4">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => {
                              if (e.target.files) {
                                setSelectedFiles(Array.from(e.target.files));
                              }
                            }}
                            className="hidden"
                            accept="image/*"
                            multiple
                            capture="environment"
                          />
                          
                          <div className="flex flex-wrap gap-3 mt-3">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Podgląd ${index}`}
                                  className="w-24 h-24 object-cover rounded-md shadow-sm border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                                  }}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex flex-wrap items-center mt-4 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              className="flex-1 min-w-[130px]"
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Wybierz zdjęcia
                            </Button>
                            
                            <Button
                              className="flex-1 min-w-[130px]"
                              type="button"
                              disabled={selectedFiles.length === 0 || uploadingPhotos}
                              onClick={async () => {
                                if (selectedFiles.length === 0) return;
                                
                                setUploadingPhotos(true);
                                
                                const formData = new FormData();
                                selectedFiles.forEach(file => {
                                  formData.append('photos', file);
                                });
                                
                                try {
                                  const response = await fetch(`/api/orders/${id}/photos?type=complaint`, {
                                    method: 'POST',
                                    body: formData,
                                  });
                                  
                                  if (response.ok) {
                                    toast({
                                      title: "Zdjęcia przesłane",
                                      description: "Zdjęcia reklamacyjne zostały dodane.",
                                      variant: "success"
                                    });
                                    setSelectedFiles([]);
                                    queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
                                  } else {
                                    throw new Error("Wystąpił błąd podczas przesyłania zdjęć");
                                  }
                                } catch (error) {
                                  console.error("Błąd podczas przesyłania zdjęć:", error);
                                  toast({
                                    title: "Błąd",
                                    description: "Nie udało się przesłać zdjęć. Spróbuj ponownie.",
                                    variant: "destructive"
                                  });
                                } finally {
                                  setUploadingPhotos(false);
                                }
                              }}
                            >
                              {uploadingPhotos ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Przesyłanie...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4 mr-2" />
                                  Prześlij zdjęcia
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Save complaint notes button */}
                    {userCanChangeOrderStatus && order.installationStatus.toLowerCase() === 'reklamacja' && (
                      <Button
                        onClick={async () => {
                          try {
                            const res = await apiRequest(
                              'PATCH', 
                              `/api/orders/${id}/status`, 
                              {
                                installationStatus: 'Reklamacja', // Używamy dokładnie takiej wartości, jakiej oczekuje API
                                complaintNotes
                              }
                            );
                            
                            if (res.ok) {
                              toast({
                                title: "Zapisano",
                                description: "Opis reklamacji został zaktualizowany",
                                variant: "success"
                              });
                              queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
                            } else {
                              throw new Error("Wystąpił błąd podczas zapisywania opisu reklamacji");
                            }
                          } catch (error) {
                            console.error("Błąd podczas zapisywania opisu reklamacji:", error);
                            toast({
                              title: "Błąd",
                              description: "Nie udało się zapisać opisu reklamacji. Spróbuj ponownie.",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="mt-4"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Zapisz opis reklamacji
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
      
      {/* Pełnoekranowy dialog rozpoznawania mowy */}
      {showSpeechDialog && (
        <SpeechRecognitionDialog
          onClose={() => setShowSpeechDialog(false)}
          onTextRecognized={(text) => {
            setComplaintNotes(prev => prev ? `${prev} ${text}` : text);
          }}
          initialText={complaintNotes}
        />
      )}
      
      {/* Dialog edycji montażu (status, data, montażysta w jednym oknie) */}
      {isEditInstallationDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Edycja parametrów montażu
              </h3>
              <button 
                className="p-1 rounded-full hover:bg-gray-100"
                onClick={() => setIsEditInstallationDialogOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Pole wyboru statusu */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Status montażu:
              </label>
              <Select
                value={editInstallationStatus}
                onValueChange={setEditInstallationStatus}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz status montażu" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'Nowe', label: 'Nowe' },
                    { value: 'Zaplanowane', label: 'Zaplanowane' },
                    { value: 'W realizacji', label: 'W realizacji' },
                    { value: 'Zakończone', label: 'Zakończone' },
                    { value: 'Reklamacja', label: 'Reklamacja' }
                  ].map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Pole wyboru montażysty (tylko dla firm z pracownikami) */}
            {user?.role === 'company' && user?.companyOwnerOnly === false && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Przypisz montażystę:
                </label>
                <Select
                  value={editInstallerId?.toString()}
                  onValueChange={(value) => {
                    const installerId = parseInt(value);
                    setEditInstallerId(installerId);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Wybierz montażystę" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInstallers.map(installer => (
                      <SelectItem key={installer.id} value={installer.id.toString()}>
                        {installer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Kalendarz do wyboru daty */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Data montażu:
              </label>
              <CalendarComponent
                mode="single"
                selected={editInstallationDate}
                onSelect={setEditInstallationDate}
                initialFocus
                className="mx-auto border rounded-md p-3"
              />
            </div>
            
            {/* Przyciski */}
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline"
                onClick={() => setIsEditInstallationDialogOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleUpdateInstallationDetails}
                disabled={!editInstallationStatus || isUpdatingInstallationDetails}
              >
                {isUpdatingInstallationDetails ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Zapisz
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
