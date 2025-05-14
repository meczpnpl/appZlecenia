import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Store, Mail, Phone, MapPin, Check, Building, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient, getQueryFn } from '@/lib/queryClient';
import { Store as StoreType, Company } from '@shared/schema';
import { GoogleAddressInput, ClickableAddress } from '@/components/address';
import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Walidacja formularza
const storeSchema = z.object({
  name: z.string().min(2, "Nazwa musi mieć co najmniej 2 znaki"),
  address: z.string().min(5, "Adres musi być kompletny"),
  city: z.string().min(2, "Podaj nazwę miasta"),
  phone: z.string().min(9, "Numer telefonu jest zbyt krótki"),
  email: z.string().email("Podaj prawidłowy adres email"),
  status: z.enum(["active", "inactive"]),
});

type StoreFormData = z.infer<typeof storeSchema>;

/**
 * Komponent StoreCompanies - wyświetla firmy montażowe przypisane do sklepu
 */
function StoreCompanies({ storeId }: { storeId: number }) {
  // Pobieranie firm przypisanych do sklepu
  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ['/api/stores', storeId, 'companies'],
    queryFn: getQueryFn({ 
      on401: "throw",
      customUrl: `/api/stores/${storeId}/companies`
    }),
  });

  if (isLoading) {
    return <div className="animate-pulse h-5 w-20 bg-gray-200 rounded"></div>;
  }

  if (companies.length === 0) {
    return <span className="text-gray-500 text-sm">Brak przypisanych firm</span>;
  }

  // Wyświetlamy maksymalnie 2 firmy, a resztę w tooltipie
  const visibleCompanies = companies.slice(0, 2);
  const additionalCompanies = companies.length > 2 ? companies.slice(2) : [];

  return (
    <div className="flex flex-col gap-1">
      {visibleCompanies.map(company => (
        <div key={company.id} className="flex items-center text-sm">
          <Building className="h-3 w-3 mr-1 text-blue-600" />
          <span>{company.name}</span>
        </div>
      ))}
      
      {additionalCompanies.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="cursor-help w-fit">
                <Users className="h-3 w-3 mr-1" />
                +{additionalCompanies.length} więcej
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-1 p-1">
                {additionalCompanies.map(company => (
                  <div key={company.id} className="flex items-center text-sm whitespace-nowrap">
                    <Building className="h-3 w-3 mr-1 text-blue-600" />
                    {company.name}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      <Link href={`/stores/${storeId}/companies`} className="text-blue-600 hover:underline text-xs flex items-center mt-1">
        <Plus className="h-3 w-3 mr-1" /> Zarządzaj firmami
      </Link>
    </div>
  );
}

/**
 * Komponent StoreList - wyświetla listę sklepów 
 */
function StoreList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  const { data: stores, isLoading } = useQuery<StoreType[]>({
    queryKey: ['/api/stores'],
  });
  
  const deleteStoreMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/stores/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      toast({
        title: 'Sklep usunięty',
        description: 'Sklep został pomyślnie usunięty z systemu',
      });
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się usunąć sklepu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const handleDeleteStore = (id: number) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten sklep? Ta operacja wpłynie również na powiązanych pracowników i zamówienia.')) {
      deleteStoreMutation.mutate(id);
    }
  };
  
  // Ensure only admin can access this page
  if (user?.role !== 'admin') {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Brak dostępu</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-600">Nie masz uprawnień do zarządzania sklepami.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="font-semibold text-gray-800">Sklepy</CardTitle>
            <div className="animate-pulse h-10 w-32 bg-gray-200 rounded"></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-64 animate-pulse bg-gray-100"></div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <BackButton fallbackPath="/" className="mb-4" />
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="font-semibold text-gray-800">
              Sklepy
            </CardTitle>
            <Link href="/stores/add">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj nowy sklep
              </Button>
            </Link>
          </div>
        </CardHeader>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Firmy montażowe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(!stores || stores.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                    Brak sklepów w systemie
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => (
                  <TableRow key={store.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Store className="h-4 w-4 mr-2 text-blue-600" />
                        {store.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <ClickableAddress address={`${store.address}, ${store.city}`} className="text-blue-600 hover:underline flex items-center">
                          <MapPin className="h-3 w-3 mr-1 text-gray-500" />
                          {store.address}
                        </ClickableAddress>
                        <span className="text-sm text-gray-500">{store.city}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-1 text-gray-500" />
                          <span>{store.phone}</span>
                        </div>
                        <div className="flex items-center">
                          <Mail className="h-3 w-3 mr-1 text-gray-500" />
                          <a href={`mailto:${store.email}`} className="text-blue-600 hover:underline">
                            {store.email}
                          </a>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StoreCompanies storeId={store.id} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={store.status === 'active' ? 'success' : 'destructive'}>
                        {store.status === 'active' ? 'Aktywny' : 'Nieaktywny'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex space-x-2 justify-end">
                        <Link href={`/stores/edit/${store.id}`}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDeleteStore(store.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}

/**
 * Komponent StoreForm - formularz dodawania/edycji sklepu
 */
function StoreForm({ storeId }: { storeId?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const isEditMode = Boolean(storeId);
  
  // W trybie edycji pobieramy dane sklepu
  const { data: store } = useQuery<StoreType>({
    queryKey: [`/api/stores/${storeId}`],
    enabled: isEditMode,
  });

  // Inicjalizacja formularza
  const form = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      phone: '',
      email: '',
      status: 'active',
    },
  });
  
  // Ustawienie wartości formularza gdy dane sklepu są dostępne
  React.useEffect(() => {
    if (store && isEditMode) {
      form.reset({
        name: store.name || '',
        address: store.address || '',
        city: store.city || '',
        phone: store.phone || '',
        email: store.email || '',
        status: (store.status as "active" | "inactive") || 'active',
      });
    }
  }, [store, isEditMode, form]);
  
  const createStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData) => {
      return await apiRequest('POST', '/api/stores', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      toast({
        title: 'Sklep utworzony',
        description: 'Nowy sklep został pomyślnie dodany do systemu',
      });
      navigate('/stores');
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się utworzyć sklepu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const updateStoreMutation = useMutation({
    mutationFn: async (data: StoreFormData & { id: number }) => {
      return await apiRequest('PATCH', `/api/stores/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
      toast({
        title: 'Sklep zaktualizowany',
        description: 'Dane sklepu zostały pomyślnie zaktualizowane',
      });
      navigate('/stores');
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się zaktualizować sklepu: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const onSubmit = (data: StoreFormData) => {
    if (isEditMode && storeId && store) {
      updateStoreMutation.mutate({ ...data, id: parseInt(storeId) });
    } else {
      createStoreMutation.mutate(data);
    }
  };
  
  // Ensure only admin can access this page
  if (user?.role !== 'admin') {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Brak dostępu</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-600">Nie masz uprawnień do zarządzania sklepami.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (isEditMode && !store) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Edycja sklepu</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <BackButton fallbackPath="/stores" className="mb-4" />
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <CardTitle className="font-semibold text-gray-800">
              {isEditMode ? 'Edycja sklepu' : 'Dodaj nowy sklep'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwa sklepu</FormLabel>
                    <FormControl>
                      <Input placeholder="np. Santocka 39" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <div className="flex items-center gap-1">
                          <MapPin size={16} className="text-blue-600" />
                          <span>Adres</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <GoogleAddressInput 
                          value={field.value || ''} 
                          onChange={field.onChange}
                          placeholder="Wpisz adres sklepu..."
                          className="w-full" 
                        />
                      </FormControl>
                      <FormDescription>
                        Wpisz adres, aby skorzystać z podpowiedzi Google Maps
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Miasto</FormLabel>
                      <FormControl>
                        <Input placeholder="np. Szczecin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <Input placeholder="np. 91 123 45 67" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="np. sklep@belpol.pl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz status sklepu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktywny</SelectItem>
                        <SelectItem value="inactive">Nieaktywny</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {isEditMode && storeId && (
                <div className="border rounded-lg p-4 mt-6">
                  <h3 className="text-lg font-medium mb-4 flex items-center">
                    <Building className="mr-2 h-5 w-5 text-blue-600" />
                    Przypisane firmy montażowe
                  </h3>
                  <StoreCompaniesManager storeId={parseInt(storeId)} />
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" type="button" onClick={() => navigate('/stores')}>
                  Anuluj
                </Button>
                <Button 
                  type="submit" 
                  disabled={form.formState.isSubmitting || createStoreMutation.isPending || updateStoreMutation.isPending}
                >
                  {form.formState.isSubmitting || createStoreMutation.isPending || updateStoreMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></div>
                      {isEditMode ? 'Zapisywanie...' : 'Dodawanie...'}
                    </div>
                  ) : (
                    isEditMode ? 'Zapisz zmiany' : 'Dodaj sklep'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

/**
 * Komponent StoreCompaniesManager - zarządza przypisaniem firm montażowych do sklepu
 */
function StoreCompaniesManager({ storeId }: { storeId: number }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pobieranie wszystkich firm
  const { data: allCompanies = [], isLoading: isLoadingCompanies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: getQueryFn({ on401: "throw" }),
  });
  
  // Pobieranie firm przypisanych do sklepu
  const { 
    data: storeCompanies = [], 
    isLoading: isLoadingStoreCompanies,
    refetch: refetchStoreCompanies 
  } = useQuery<Company[]>({
    queryKey: ['/api/stores', storeId, 'companies'],
    queryFn: getQueryFn({ 
      on401: "throw",
      customUrl: `/api/stores/${storeId}/companies` 
    }),
  });
  
  // Identyfikatory przypisanych firm
  const associatedCompanyIds = storeCompanies.map(company => company.id);
  
  // Filtrowanie firm wg wyszukiwania
  const filteredCompanies = allCompanies.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.nip?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Mutacja do przypisania firmy do sklepu
  const assignCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest('POST', `/api/stores/${storeId}/companies/${companyId}`, {});
    },
    onSuccess: () => {
      refetchStoreCompanies();
      toast({
        title: "Sukces",
        description: "Firma została przypisana do sklepu",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się przypisać firmy: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Mutacja do usunięcia przypisania firmy do sklepu
  const removeCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest('DELETE', `/api/stores/${storeId}/companies/${companyId}`, {});
    },
    onSuccess: () => {
      refetchStoreCompanies();
      toast({
        title: "Sukces",
        description: "Firma została odłączona od sklepu",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się odłączyć firmy: ${error.message}`,
        variant: "destructive"
      });
    }
  });
  
  // Funkcja obsługująca przełączanie przypisania firmy
  const handleToggleCompany = (companyId: number, isAssigned: boolean) => {
    if (isAssigned) {
      removeCompanyMutation.mutate(companyId);
    } else {
      assignCompanyMutation.mutate(companyId);
    }
  };
  
  // Sprawdzenie, czy firma jest już przypisana do sklepu
  const isCompanyAssigned = (companyId: number): boolean => {
    return associatedCompanyIds.includes(companyId);
  };
  
  if (isLoadingCompanies || isLoadingStoreCompanies) {
    return (
      <div className="py-4 flex justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 rounded-full border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Szukaj firmy..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>
      
      {storeCompanies.length === 0 && (
        <div className="text-center py-4 text-gray-500">
          <p>Ten sklep nie ma jeszcze przypisanych firm montażowych.</p>
        </div>
      )}
      
      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
        {filteredCompanies.map(company => {
          const isAssigned = isCompanyAssigned(company.id);
          
          return (
            <div key={company.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
              <div className="flex items-center">
                <Building className="h-4 w-4 mr-2 text-blue-600" />
                <div>
                  <div className="font-medium">{company.name}</div>
                  {company.nip && <div className="text-sm text-gray-500">NIP: {company.nip}</div>}
                </div>
              </div>
              
              <Button
                variant={isAssigned ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleToggleCompany(company.id, isAssigned)}
                disabled={assignCompanyMutation.isPending || removeCompanyMutation.isPending}
              >
                {isAssigned ? "Odłącz" : "Przypisz"}
              </Button>
            </div>
          );
        })}
        
        {filteredCompanies.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <p>Nie znaleziono firm spełniających kryteria wyszukiwania.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Główny komponent obsługujący routing dla sekcji Sklepów
 */
export default function StoresModule() {
  const [match, params] = useRoute('/stores/edit/:id');
  const addMatch = useRoute('/stores/add')[0];
  const listMatch = useRoute('/stores')[0];
  
  // Domyślny widok (lista)
  if (listMatch) {
    return <StoreList />;
  }
  
  // Formularz dodawania
  if (addMatch) {
    return <StoreForm />;
  }
  
  // Formularz edycji
  if (match && params?.id) {
    return <StoreForm storeId={params.id} />;
  }
  
  // Fallback - przekierowanie do listy
  return <StoreList />;
}