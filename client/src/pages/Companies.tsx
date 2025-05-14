import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { GoogleAddressInput, ClickableAddress } from '@/components/address';
import { 
  Building2, 
  Plus, 
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Edit,
  Trash2,
  MoreHorizontal,
  Check,
  X,
  SearchIcon,
  Building,
  LinkIcon
} from 'lucide-react';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/ui/back-button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { insertCompanySchema, type Company } from '@shared/schema';

// Rozszerzamy schemat o walidacje
const companyFormSchema = insertCompanySchema
  .extend({
    name: z.string().min(3, { message: 'Nazwa firmy musi mieć co najmniej 3 znaki' }),
    nip: z.string().min(10, { message: 'NIP musi mieć co najmniej 10 znaków' }),
    email: z.string().email({ message: 'Podaj prawidłowy adres email' }),
    isOwnerInstaller: z.boolean().optional().default(false),
    ownerServices: z.array(z.string()).optional().default([]),
  });

type CompanyFormData = z.infer<typeof companyFormSchema>;

export default function Companies() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch companies
  const { data: companies = [], isLoading, error } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
  });

  // Form setup
  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      nip: '',
      address: '',
      contactName: '',
      email: '',
      phone: '',
      services: [],
      status: 'active'
    }
  });

  // Create company mutation
  const createCompanyMutation = useMutation<Company, Error, CompanyFormData>({
    mutationFn: async (data: CompanyFormData) => {
      const response = await apiRequest('POST', '/api/companies', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: 'Sukces',
        description: 'Firma została pomyślnie dodana',
      });
      setShowForm(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się dodać firmy: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: CompanyFormData }) => {
      return await apiRequest('PATCH', `/api/companies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: 'Sukces',
        description: 'Firma została pomyślnie zaktualizowana',
      });
      setShowForm(false);
      setEditingCompany(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się zaktualizować firmy: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });

  // Delete company mutation
  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: 'Sukces',
        description: 'Firma została pomyślnie usunięta',
      });
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się usunąć firmy: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });

  // Sync companies (unique endpoint we created)
  const syncCompaniesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/companies/sync');
      const data = await response.json();
      return data;
    },
    onSuccess: (data: { results?: { created: number, updated: number, skipped: number } }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({
        title: 'Sukces',
        description: `Synchronizacja zakończona. Utworzono: ${data.results?.created || 0}, Zaktualizowano: ${data.results?.updated || 0}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się zsynchronizować firm: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });

  // Mutacja do tworzenia konta firmowego dla właściciela
  const createCompanyOwnerMutation = useMutation({
    mutationFn: async ({ 
      name, 
      email, 
      phone, 
      companyId, 
      companyName,
      nip,
      companyAddress
    }: { 
      name: string; 
      email: string; 
      phone: string; 
      companyId: number; 
      companyName: string;
      nip: string;
      companyAddress: string;
    }) => {
      const response = await apiRequest('POST', '/api/users', {
        name,
        email,
        phone,
        role: 'company',
        companyId,
        companyName,
        nip,
        companyAddress,
        password: 'test1234' // Domyślne hasło, które powinno być potem zmienione przez użytkownika
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Sukces',
        description: 'Konto właściciela firmy zostało utworzone pomyślnie.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się utworzyć konta właściciela firmy: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Mutacja do tworzenia montażysty (właściciela firmy)
  const createInstallerOwnerMutation = useMutation({
    mutationFn: async ({ 
      name, 
      email, 
      phone, 
      companyId, 
      companyName,
      services 
    }: { 
      name: string; 
      email: string; 
      phone: string; 
      companyId: number; 
      companyName: string;
      services: string[];
    }) => {
      const response = await apiRequest('POST', '/api/users', {
        name,
        email,
        phone,
        role: 'installer',
        companyId,
        companyName,
        services,
        password: 'test1234' // Domyślne hasło, które powinno być potem zmienione przez użytkownika
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/installers'] });
      toast({
        title: 'Sukces',
        description: 'Właściciel został dodany jako montażysta pomyślnie.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się dodać właściciela jako montażysty: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: CompanyFormData) => {
    // If we have services as string, convert to array
    if (typeof data.services === 'string') {
      data.services = [data.services];
    }
    
    if (typeof data.ownerServices === 'string') {
      data.ownerServices = [data.ownerServices];
    }
    
    if (editingCompany) {
      updateCompanyMutation.mutate({ id: editingCompany.id, data });
    } else {
      // Tworzenie firmy
      createCompanyMutation.mutate(data, {
        onSuccess: (companyData) => {
          // Po utworzeniu firmy, zawsze tworzymy konto użytkownika dla właściciela
          try {
            const newCompanyId = companyData.id;
            
            if (newCompanyId && data.contactName && data.email) {
              // Zawsze utwórz konto właściciela firmy
              createCompanyOwnerMutation.mutate({
                name: data.contactName,
                email: data.email,
                phone: data.phone || '',
                companyId: newCompanyId,
                companyName: data.name,
                nip: data.nip || '',
                companyAddress: data.address || ''
              });
              
              // Dodatkowo, jeśli właściciel jest montażystą, utwórz drugie konto jako montażysta
              if (data.isOwnerInstaller && Array.isArray(data.ownerServices) && data.ownerServices.length > 0) {
                createInstallerOwnerMutation.mutate({
                  name: data.contactName,
                  email: data.email,
                  phone: data.phone || '',
                  companyId: newCompanyId,
                  companyName: data.name,
                  services: data.ownerServices
                });
              }
            }
          } catch (error) {
            console.error("Błąd podczas tworzenia kont dla właściciela firmy:", error);
          }
        }
      });
    }
  };

  // Handle edit company
  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    
    // Set form values
    form.reset({
      name: company.name ?? '',
      nip: company.nip ?? '',
      address: company.address ?? '',
      contactName: company.contactName ?? '',
      email: company.email ?? '',
      phone: company.phone ?? '',
      services: company.services ?? [],
      status: company.status ?? 'active',
      isOwnerInstaller: false, // Domyślnie ustawiamy na false dla edycji
      ownerServices: []
    });
    
    setShowForm(true);
  };

  // Handle create new company
  const handleCreateCompany = () => {
    setEditingCompany(null);
    form.reset({
      name: '',
      nip: '',
      address: '',
      contactName: '',
      email: '',
      phone: '',
      services: [],
      status: 'active'
    });
    setShowForm(true);
  };

  // Handle delete company
  const handleDeleteCompany = (id: number) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę firmę?')) {
      deleteCompanyMutation.mutate(id);
    }
  };

  // Filter companies by search term
  const filteredCompanies = companies.filter(company => 
    company.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.nip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.contactName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper: format services array to string
  const formatServices = (services: string[] | null | undefined) => {
    if (!services || services.length === 0) return 'Brak';
    return services.join(', ');
  };

  // Check if the user has permission to manage companies
  if (!isAdmin) {
    return (
      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3">
          <CardTitle>Brak dostępu</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Nie masz wystarczających uprawnień, aby zarządzać firmami montażowymi.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackPath="/" className="mb-4" />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Firmy montażowe</h1>
          <p className="text-gray-500 text-sm mt-1">
            Zarządzaj firmami montażowymi współpracującymi z Bel-Pol
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => syncCompaniesMutation.mutate()}
            disabled={syncCompaniesMutation.isPending}
          >
            {syncCompaniesMutation.isPending ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                Synchronizuję...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Synchronizuj użytkowników
              </>
            )}
          </Button>
          
          <Button onClick={handleCreateCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj firmę
          </Button>
        </div>
      </div>

      {/* Formularz dodawania/edycji firmy */}
      {showForm && (
        <Card className="bg-white shadow-sm border">
          <CardHeader className="pb-3">
            <CardTitle>
              {editingCompany ? 'Edytuj firmę montażową' : 'Dodaj nową firmę montażową'}
            </CardTitle>
            <CardDescription>
              {editingCompany 
                ? 'Zmodyfikuj dane firmowe w formularzu poniżej.' 
                : 'Wypełnij dane nowej firmy montażowej. Dla właściciela firmy zostanie automatycznie utworzone konto z rolą "Firma".'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nazwa firmy</FormLabel>
                      <FormControl>
                        <Input placeholder="np. Drzwi-Mont s.c." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="nip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NIP</FormLabel>
                      <FormControl>
                        <Input placeholder="np. 9511230498" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field: { value, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel>Osoba kontaktowa</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="np. Jan Kowalski" 
                            value={value ?? ''} 
                            {...fieldProps} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field: { value, ...fieldProps } }) => (
                      <FormItem>
                        <FormLabel>Telefon</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="np. 500123456" 
                            value={value ?? ''} 
                            {...fieldProps} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field: { value, ...fieldProps } }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="np. kontakt@firma.pl" 
                          value={value ?? ''} 
                          {...fieldProps} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
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
                          value={field.value} 
                          onChange={field.onChange}
                          placeholder="Wpisz adres firmy..." 
                          className="w-full"
                        />
                      </FormControl>
                      <FormDescription>
                        Wpisz adres aby skorzystać z autouzupełniania
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="services"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usługi</FormLabel>
                      <FormDescription>
                        Wybierz usługi oferowane przez firmę
                      </FormDescription>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['Montaż drzwi', 'Montaż podłogi', 'Transport'].map((service) => (
                          <Badge 
                            key={service}
                            variant={
                              Array.isArray(field.value) && field.value.includes(service) 
                                ? 'default' 
                                : 'outline'
                            }
                            className="cursor-pointer"
                            onClick={() => {
                              const currentServices = Array.isArray(field.value) ? [...field.value] : [];
                              const serviceIndex = currentServices.indexOf(service);
                              
                              if (serviceIndex === -1) {
                                currentServices.push(service);
                              } else {
                                currentServices.splice(serviceIndex, 1);
                              }
                              
                              field.onChange(currentServices);
                            }}
                          >
                            {service}
                          </Badge>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isOwnerInstaller"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 border rounded-md p-4 bg-gray-50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-base font-medium">
                          Jestem również montażystą
                        </FormLabel>
                        <FormDescription>
                          Zaznacz, jeśli właściciel firmy jest także montażystą wykonującym zlecenia. 
                          Zostanie wtedy utworzone dodatkowe konto z rolą "Montażysta".
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                {form.watch("isOwnerInstaller") && (
                  <FormField
                    control={form.control}
                    name="ownerServices"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usługi montażowe właściciela</FormLabel>
                        <FormDescription>
                          Wybierz usługi montażowe wykonywane przez właściciela firmy
                        </FormDescription>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {['Montaż drzwi', 'Montaż podłogi', 'Montaż okien', 'Montaż mebli', 'Transport'].map((service) => (
                            <Badge 
                              key={service}
                              variant={
                                Array.isArray(field.value) && field.value.includes(service) 
                                  ? 'default' 
                                  : 'outline'
                              }
                              className="cursor-pointer"
                              onClick={() => {
                                const currentServices = Array.isArray(field.value) ? [...field.value] : [];
                                const serviceIndex = currentServices.indexOf(service);
                                
                                if (serviceIndex === -1) {
                                  currentServices.push(service);
                                } else {
                                  currentServices.splice(serviceIndex, 1);
                                }
                                
                                field.onChange(currentServices);
                              }}
                            >
                              {service}
                            </Badge>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <div className="flex gap-2 mt-2">
                        <Badge 
                          variant={field.value === 'active' ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => field.onChange('active')}
                        >
                          Aktywna
                        </Badge>
                        <Badge 
                          variant={field.value === 'inactive' ? 'secondary' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => field.onChange('inactive')}
                        >
                          Nieaktywna
                        </Badge>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-between gap-2 pt-4">
                  <div>
                    {editingCompany && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          // Przekieruj do strony zarządzania sklepami dla tej firmy
                          window.location.href = `/company/stores?id=${editingCompany.id}`;
                        }}
                      >
                        <Building className="h-4 w-4 mr-2" />
                        Zarządzaj sklepami
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowForm(false)}
                    >
                      Anuluj
                    </Button>
                    <Button
                      type="submit"
                      disabled={createCompanyMutation.isPending || updateCompanyMutation.isPending}
                    >
                      {(createCompanyMutation.isPending || updateCompanyMutation.isPending) ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          Zapisywanie...
                        </>
                      ) : (
                        'Zapisz'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white shadow-sm border">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista firm montażowych</CardTitle>
            <CardDescription>
              Łącznie: {companies.length} firm
            </CardDescription>
          </div>
          <div className="relative w-64">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <SearchIcon className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type="search"
              placeholder="Szukaj firmy..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              Wystąpił błąd podczas ładowania danych. Spróbuj odświeżyć stronę.
            </div>
          ) : filteredCompanies.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nazwa firmy</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead>Dane kontaktowe</TableHead>
                    <TableHead>Usługi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-500" />
                          <div>
                            <div>{company.name}</div>
                            {company.contactName && (
                              <div className="text-sm text-gray-500">
                                Kontakt: {company.contactName}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{company.nip || 'Brak'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {company.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="h-3 w-3 mr-1 text-gray-500" />
                              <span>{company.email}</span>
                            </div>
                          )}
                          {company.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="h-3 w-3 mr-1 text-gray-500" />
                              <span>{company.phone}</span>
                            </div>
                          )}
                          {company.address && (
                            <div className="flex items-center text-sm">
                              <MapPin className="h-3 w-3 mr-1 text-gray-500" />
                              <ClickableAddress address={company.address} className="text-blue-600 hover:underline" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Briefcase className="h-3 w-3 mr-1 text-gray-500" />
                          <span>{formatServices(company.services)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                          {company.status === 'active' ? 'Aktywna' : 'Nieaktywna'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Otwórz menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Akcje</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edytuj
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                window.location.href = `/company/stores?id=${company.id}`;
                              }}
                            >
                              <Building className="h-4 w-4 mr-2" />
                              Zarządzaj sklepami
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteCompany(company.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Usuń
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Building2 className="h-8 w-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Brak firm do wyświetlenia
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery ? 'Brak wyników dla podanych kryteriów wyszukiwania.' : 'Dodaj pierwszą firmę montażową.'}
              </p>
              <Button onClick={handleCreateCompany}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj firmę
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}