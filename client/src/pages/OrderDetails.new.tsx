import { useState, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, addDays, isBefore, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { 
  AlertTriangle, FileText, Phone, Calendar, Package, 
  Truck, Map, User, BarChart3, Download, 
  Camera, Upload, X, Loader2, Trash2, ClipboardList, MessageCircle, Pencil, RotateCw,
  Building, Check, Wrench
} from 'lucide-react';
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { BackButton } from '@/components/ui/back-button';
import { UpdateOrderStatus } from '@shared/schema';

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
  
  // Stan dla przypisywania montażysty
  const [statusForm, setStatusForm] = useState<any>({});
  const [selectedInstallerId, setSelectedInstallerId] = useState<number | null>(null);
  const [selectedTransporterId, setSelectedTransporterId] = useState<number | null>(null);
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

  // Stan dla aktywnej zakładki, z domyślną wartością zależną od roli użytkownika
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Dla transporterów domyślnie otwórz zakładkę Transport
    if (user?.role === 'installer' && user?.services?.some(s => s.toLowerCase().includes('transport'))) {
      return 'transport';
    }
    // Dla pozostałych użytkowników domyślnie otwórz zakładkę Szczegóły
    return 'installation';
  });
  const [companyDialogOpen, setCompanyDialogOpen] = useState<boolean>(false);
  
  // Pobieranie danych zlecenia
  // Poprawne typowanie dla obiektu zamówienia
  const { data: order = {}, isLoading, isError } = useQuery<any>({
    queryKey: [`/api/orders/${id}`],
    refetchOnWindowFocus: false,
  });

  // Sprawdzenie, czy zalogowany użytkownik jest transporterem przypisanym do zlecenia
  const isAssignedTransporter = 
    user?.role === 'installer' && 
    user?.services?.includes('Transport') && 
    order?.transporterId === user?.id;
    
  // Sprawdzenie, czy zalogowany użytkownik jest transporterem (ogólnie)
  const isTransporter = 
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
      case 'montaż zaplanowany': return 'secondary';
      case 'w trakcie montażu': return 'warning';
      case 'montaż wykonany': return 'success';
      case 'wykonane': return 'success';
      case 'reklamacja': return 'destructive';
      case 'zafakturowane': return 'outline';
      default: return 'default';
    }
  };
  
  // Helper do wyświetlania statusów montażu
  const getInstallationStatusBadgeVariant = (status: string) => {
    switch (status) {
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
  const canEditStatus = 
    (user?.role === 'worker') || 
    (user?.role === 'company' && user.companyId === order.companyId) ||
    ((user?.role === 'installer') && user.id === order.installerId) ||
    user?.role === 'admin';
    
  // Sprawdza czy użytkownik może edytować status transportu
  const canEditTransportStatus = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId) ||
    (user?.role === 'installer' && user.id === order.transporterId);
    
  // Sprawdza czy użytkownik może przypisać transportera
  const canAssignTransporter = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId);
    
  // Sprawdza czy użytkownik może przypisać montażystę
  const canAssignInstaller = 
    isUserAdmin || 
    isUserWorker || 
    (isUserCompany && order.companyId === user?.companyId);
    
  // Sprawdza czy użytkownik może zmienić status zamówienia
  const userCanChangeOrderStatus = 
    (isUserAdmin || isUserWorker || (isAssignedInstaller && order.installerId) || (isUserCompany && order.companyId === user?.companyId));
    
  // Sprawdza czy użytkownik jest właścicielem/pracownikiem firmy przypisanej do zlecenia
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
      return apiRequest(`/api/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
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
      return apiRequest(`/api/orders/${id}/transport-status`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
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
      return apiRequest(`/api/orders/${id}/financial-status`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
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
      return apiRequest(`/api/orders/${id}/assign-company`, {
        method: 'PATCH',
        body: JSON.stringify({ companyId })
      });
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
      return apiRequest(`/api/orders/${id}/assign-installer`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
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
  
  // Mutacja dla przypisania transportera
  const { mutate: assignTransporter, isPending: isAssigningTransporter } = useMutation({
    mutationFn: async (data: { transporterId: number, transportDate?: string }) => {
      return apiRequest(`/api/orders/${id}/assign-transporter`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
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
    
    const status = statusForm.status || statusForm.transportStatus;
    
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
          <h1 className="text-2xl font-bold">Zlecenie: {order.orderNumber}</h1>
          <p className="text-sm text-gray-500">
            Utworzone: {new Date(order.createdAt).toLocaleDateString('pl-PL')}
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Szczegóły zlecenia</CardTitle>
          
          <div className="flex items-center space-x-2">
            <Badge variant={getStatusBadgeVariant(order.status || '')}>
              {getStatusLabel(order.status || '')}
            </Badge>
            
            {order.withTransport && order.transportStatus && (
              <Badge variant={getTransportStatusBadgeVariant(order.transportStatus)}>
                {getStatusLabel(order.transportStatus)}
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <Tabs defaultValue={isTransporter ? "transport" : "installation"} value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6 pt-4 border-b">
            <TabsList>
              {/* Zakładka Montaż - zawsze widoczna */}
              <TabsTrigger value="installation" className="data-[state=active]:bg-primary-50">
                <Wrench className="h-4 w-4 mr-2" />
                Montaż
              </TabsTrigger>
              
              {/* Zakładka Transport - zawsze widoczna */}
              <TabsTrigger value="transport" className="data-[state=active]:bg-primary-50">
                <Truck className="h-4 w-4 mr-2" />
                Transport
              </TabsTrigger>
              
              {/* Zakładka Reklamacja - zawsze widoczna */}
              <TabsTrigger value="complaint" className={`data-[state=active]:${(order.status || '') === 'reklamacja' ? 'bg-red-50' : 'bg-primary-50'}`}>
                <AlertTriangle className={`h-4 w-4 mr-2 ${(order.status || '') === 'reklamacja' ? 'text-red-500' : ''}`} />
                Reklamacja
              </TabsTrigger>
            </TabsList>
          </div>
          
          <CardContent className="p-6">
            {/* Zakładka Montaż */}
            <TabsContent value="installation" className="mt-0">
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">Panel Montażu</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-600 mb-2">Szczegóły montażu</h4>
                      <dl className="space-y-3">
                        <div>
                          <dt className="text-xs text-gray-500">Adres montażu</dt>
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
                            <a href={`tel:${order.clientPhone}`} className="text-blue-600 hover:underline flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
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
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Zmień status</h4>
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="status" className="text-xs text-gray-500">Nowy status</Label>
                              <Select 
                                defaultValue={order.installationStatus} 
                                onValueChange={(value) => setStatusForm(prev => ({ ...prev, installationStatus: value }))}
                              >
                                <SelectTrigger className="w-full mt-1">
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
                            
                            <div>
                              <Label htmlFor="comments" className="text-xs text-gray-500">Komentarz (opcjonalnie)</Label>
                              <Textarea 
                                id="comments" 
                                placeholder="Dodaj komentarz do zmiany statusu" 
                                className="mt-1"
                                value={statusForm.comments || ''}
                                onChange={(e) => setStatusForm(prev => ({ ...prev, comments: e.target.value }))}
                              />
                            </div>
                            
                            <Button 
                              onClick={handleStatusUpdate} 
                              disabled={isUpdatingStatus || !statusForm.installationStatus}
                              className="w-full"
                            >
                              {isUpdatingStatus ? (
                                <div className="flex items-center">
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Aktualizacja...
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <Check className="h-4 w-4 mr-2" />
                                  Zapisz status
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                <span className="text-xs truncate max-w-xs">{file.name}</span>
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
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowCommentDialog(true)}
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
                      
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowCommentDialog(false);
                            setStatusForm(prev => ({ ...prev, comments: '' }));
                          }}
                        >
                          Anuluj
                        </Button>
                        
                        <Button
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
            <TabsContent value="transport" className="mt-0">
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-semibold mb-4 text-blue-800">Panel Transportu</h3>
                  
                  <div className="grid md:grid-cols-2 gap-6">
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
                            <a href={`tel:${order.clientPhone}`} className="text-blue-600 hover:underline flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
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
                                {order.transportStatus}
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
                      </dl>
                      
                      {canEditTransportStatus && order.withTransport && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Zmień status transportu</h4>
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="transportStatus" className="text-xs text-gray-500">Nowy status</Label>
                              <Select 
                                defaultValue={order.transportStatus || ''} 
                                onValueChange={(value) => setStatusForm(prev => ({ ...prev, transportStatus: value }))}
                              >
                                <SelectTrigger className="w-full mt-1">
                                  <SelectValue placeholder="Wybierz status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="gotowe do transportu">Gotowe do transportu</SelectItem>
                                  <SelectItem value="transport zaplanowany">Transport zaplanowany</SelectItem>
                                  <SelectItem value="transport dostarczony">Transport dostarczony</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
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
            <TabsContent value="complaint" className="mt-0">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg border">
                  <h3 className="text-lg font-semibold mb-4">Reklamacja</h3>
                  
                  <div className="grid gap-6">
                    <div>
                      <Label htmlFor="complaintNotes" className="text-sm font-medium">Opis reklamacji</Label>
                      <Textarea 
                        id="complaintNotes" 
                        placeholder="Wpisz informacje dotyczące reklamacji" 
                        className="mt-2"
                        value={complaintNotes}
                        onChange={(e) => setComplaintNotes(e.target.value)}
                        disabled={!userCanChangeOrderStatus || (order.status !== 'reklamacja')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
