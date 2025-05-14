import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Edit, Trash2, UserPlus, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { User } from '@shared/schema';
import { GoogleAddressInput, ClickableAddress } from '@/components/address';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'admin':
      return 'destructive';
    case 'worker':
      return 'secondary';
    case 'company':
      return 'info';
    case 'installer':
      return 'warning';
    default:
      return 'neutral';
  }
};

const getRoleLabel = (role: string, user?: any) => {
  const labels: Record<string, string> = {
    'admin': 'Administrator',
    'worker': 'Pracownik',
    'company': 'Firma',
    'installer': 'Montażysta'
  };
  
  // Przypadek 1: Firma z rolą instalatora (właściciel, który jest też montażystą)
  if (role === 'company' && user && !user.companyOwnerOnly) {
    return 'Firma/Montażysta';
  }
  
  // Przypadek 2: Montażysta, który ma przypisane companyId (jest właścicielem firmy)
  if (role === 'installer' && user && user.companyId) {
    return 'Firma/Montażysta';
  }
  
  return labels[role] || role;
};

const userSchema = z.object({
  name: z.string().min(3, { message: 'Imię i nazwisko jest wymagane' }),
  email: z.string().email({ message: 'Wprowadź poprawny adres email' }),
  phone: z.string().min(9, { message: 'Numer telefonu jest wymagany' }),
  role: z.string().min(1, { message: 'Rola jest wymagana' }),
  password: z.string().min(6, { message: 'Hasło musi mieć minimum 6 znaków' }),
  storeId: z.union([
    z.string().transform(val => val === '' ? null : parseInt(val, 10)),
    z.number().nullable()
  ]).nullable().optional(),
  position: z.string().optional(),
  companyId: z.union([
    z.string().transform(val => val === '' ? null : parseInt(val, 10)),
    z.number().nullable()
  ]).nullable().optional(),
  companyName: z.string().optional(),
  nip: z.string().optional(),
  companyAddress: z.string().optional(),
  // Upewniamy się, że usługi są zawsze tablicą, nawet gdy są puste
  services: z.array(z.string()).default([]),
  companyOwnerOnly: z.boolean().optional().default(true),
});

type UserFormData = z.infer<typeof userSchema>;

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: '',
      password: '',
      storeId: null,
      position: '',
      companyId: null,
      companyName: '',
      nip: '',
      companyAddress: '',
      services: [],
      companyOwnerOnly: true, // Domyślnie właściciel firmy jest tylko właścicielem
    },
  });
  
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/users', { search: searchTerm }],
  });
  
  const { data: companies = [] } = useQuery<{id: number, name: string}[]>({
    queryKey: ['/api/companies'],
    refetchOnWindowFocus: true // Odświeżaj dane przy powrocie do okna
  });
  
  const { 
    data: stores = [],
    isLoading: isLoadingStores,
    error: storesError,
    refetch: refetchStores
  } = useQuery<{id: number, name: string}[]>({
    queryKey: ['/api/stores'],
    refetchOnWindowFocus: true // Odświeżaj dane przy powrocie do okna
  });
  
  // Efekt usunięty - Logi diagnostyczne nie są już potrzebne
  
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return await apiRequest('POST', '/api/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Użytkownik utworzony',
        description: 'Nowy użytkownik został pomyślnie utworzony',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się utworzyć użytkownika: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserFormData & { id: number }) => {
      return await apiRequest('PATCH', `/api/users/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Użytkownik zaktualizowany',
        description: 'Dane użytkownika zostały pomyślnie zaktualizowane',
      });
      setIsDialogOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się zaktualizować użytkownika: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/users/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Użytkownik usunięty',
        description: 'Użytkownik został pomyślnie usunięty',
      });
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się usunąć użytkownika: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    
    // Inicjalizujemy formularz danymi użytkownika
    
    form.reset({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || '',
      password: '', // Don't prefill password
      storeId: user.storeId, // Poprawiona wartość - bez konwersji
      position: user.position || '',
      companyId: user.companyId, // Poprawiona wartość - bez konwersji
      companyName: user.companyName || '',
      nip: user.nip || '',
      companyAddress: user.companyAddress || '',
      services: user.services || [],
      companyOwnerOnly: user.companyOwnerOnly === false ? false : true, // Wartość domyślna to true, jeśli nie została zmieniona
    });
    
    setIsDialogOpen(true);
  };
  
  const handleDeleteUser = (id: number) => {
    if (window.confirm('Czy na pewno chcesz usunąć tego użytkownika?')) {
      deleteUserMutation.mutate(id);
    }
  };
  
  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      updateUserMutation.mutate({ ...data, id: editingUser.id });
    } else {
      createUserMutation.mutate(data);
    }
  };
  
  const handleOpenDialog = () => {
    // Wyczyść pamięć podręczną dla sklepów i firm
    queryClient.invalidateQueries({ queryKey: ['/api/stores'] });
    queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
    
    // Czyszczenie formularza
    setEditingUser(null);
    form.reset({
      name: '',
      email: '',
      phone: '',
      role: '',
      password: '',
      storeId: null,   // Używaj null zamiast pustych ciągów znaków dla pól liczbowych
      position: '',
      companyId: null,  // Używaj null zamiast pustych ciągów znaków dla pól liczbowych
      companyName: '',
      nip: '',
      companyAddress: '',
      services: [],
      companyOwnerOnly: true,
    });
    
    // Otwórz dialog - to spowoduje pobranie najnowszych danych
    setIsDialogOpen(true);
    
    // Opóźnione odświeżenie, aby zagwarantować świeże dane
    setTimeout(() => {
      refetchStores();
    }, 100);
  };
  
  const watchRole = form.watch('role');
  
  // Ensure only admin can access this page
  if (user?.role !== 'admin') {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Brak dostępu</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-600">Nie masz uprawnień do zarządzania użytkownikami.</p>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="font-semibold text-gray-800">Użytkownicy</CardTitle>
            <div className="animate-pulse h-10 w-32 bg-gray-200 rounded"></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-96 animate-pulse bg-gray-100"></div>
        </CardContent>
      </Card>
    );
  }
  
  const filteredUsers = users || [];
  
  return (
    <>
      <BackButton fallbackPath="/" className="mb-4" />
      <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="font-semibold text-gray-800">
              Użytkownicy
            </CardTitle>
            <Button onClick={handleOpenDialog}>
              <UserPlus className="h-4 w-4 mr-2" />
              Nowy użytkownik
            </Button>
          </div>
        </CardHeader>
        
        {/* Search */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Szukaj użytkownika..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Dodatkowe informacje</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                    Nie znaleziono użytkowników spełniających kryteria wyszukiwania
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">
                      {user.name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {getRoleLabel(user.role, user)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'worker' && (
                        <>
                          <div>
                            Sklep: {' '}
                            {(() => {
                              // Szukamy najpierw dokładnego dopasowania
                              let storeName = stores.find(store => store.id === user.storeId)?.name;
                              
                              // Jeśli nie znaleziono, spróbujmy przekonwertować storeId na liczbę i porównać
                              if (!storeName && user.storeId) {
                                const storeIdAsNumber = typeof user.storeId === 'string' ? parseInt(user.storeId, 10) : user.storeId;
                                storeName = stores.find(store => store.id === storeIdAsNumber)?.name;
                              }
                              
                              // Jeśli nadal nie znaleziono, a user ma pole 'store', użyj tego
                              if (!storeName && user.store) {
                                return user.store;
                              }
                              
                              return storeName || '-';
                            })()}
                          </div>
                          <div>
                            Stanowisko: {' '}
                            {user.position === 'kierownik' && (
                              <span className="font-medium text-blue-600">Kierownik</span>
                            )}
                            {user.position === 'zastępca' && (
                              <span className="font-medium text-indigo-600">Zastępca kierownika</span>
                            )}
                            {user.position === 'doradca' && (
                              <span className="text-gray-600">Doradca klienta</span>
                            )}
                            {!user.position && '-'}
                          </div>
                        </>
                      )}
                      {user.role === 'company' && (
                        <>
                          <div>Firma: {user.companyName || '-'}</div>
                          <div>NIP: {user.nip || '-'}</div>
                          {user.companyAddress && (
                            <div className="flex items-center text-sm mt-1">
                              <MapPin className="h-3 w-3 mr-1 text-gray-500" />
                              <ClickableAddress address={user.companyAddress} className="text-blue-600 hover:underline" />
                            </div>
                          )}
                        </>
                      )}
                      {user.role === 'installer' && (
                        <>
                          <div>Firma: {user.companyName || '-'}</div>
                          <div>Usługi: {user.services?.join(', ') || '-'}</div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex space-x-2 justify-end">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500"
                          onClick={() => handleDeleteUser(user.id)}
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
      
      {/* Create/Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edytuj użytkownika' : 'Dodaj nowego użytkownika'}
            </DialogTitle>
            <DialogDescription>
              {editingUser 
                ? 'Zaktualizuj dane użytkownika w systemie.' 
                : 'Wprowadź dane nowego użytkownika, który otrzyma dostęp do systemu.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-lg">Podstawowe informacje</h3>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imię i nazwisko</FormLabel>
                      <FormControl>
                        <Input placeholder="np. Jan Kowalski" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (login)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="np. jan@belpol.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon</FormLabel>
                        <FormControl>
                          <Input placeholder="np. 500123456" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editingUser ? 'Nowe hasło (opcjonalnie)' : 'Hasło'}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Minimum 6 znaków" {...field} />
                      </FormControl>
                      {editingUser && (
                        <FormDescription>
                          Pozostaw puste, aby zachować obecne hasło
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rola</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          // Aktualizuj wartość pola formularza
                          field.onChange(value);
                          
                          // Automatycznie inicjalizuj odpowiednie pola dla danej roli
                          if (value === 'worker') {
                            if (!form.getValues('storeId') && stores.length > 0) {
                              // Ustaw ID sklepu jako liczbę, a nie tekst
                              form.setValue('storeId', stores[0].id);
                            }
                          } else if (value === 'company') {
                            if (!form.getValues('companyName')) {
                              form.setValue('companyName', '');
                            }
                          } else if (value === 'installer') {
                            if (!form.getValues('services') || form.getValues('services').length === 0) {
                              form.setValue('services', []);
                            }
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz rolę użytkownika" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="worker">Pracownik sklepu</SelectItem>
                          <SelectItem value="company">Firma montażowa</SelectItem>
                          <SelectItem value="installer">Montażysta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Worker specific fields */}
              {watchRole === 'worker' && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-lg">Informacje o pracowniku</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="storeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sklep</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              // Konwertuj wartość na liczbę lub null
                              const numValue = value ? parseInt(value, 10) : null;
                              field.onChange(numValue);
                              
                              // Automatycznie zapisz zmiany, jeśli edytujemy istniejącego użytkownika
                              if (editingUser) {
                                const updatedData = {
                                  ...form.getValues(),
                                  id: editingUser.id,
                                  storeId: numValue
                                };
                                updateUserMutation.mutate(updatedData);
                              }
                            }} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz sklep" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {isLoadingStores ? (
                                <SelectItem value="" disabled>Ładowanie sklepów...</SelectItem>
                              ) : storesError ? (
                                <SelectItem value="" disabled>Błąd ładowania sklepów</SelectItem>
                              ) : stores.length > 0 ? (
                                stores.map(store => (
                                  <SelectItem key={store.id} value={store.id.toString()}>
                                    {store.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="" disabled>Brak dostępnych sklepów</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stanowisko</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              
                              // Automatycznie zapisz zmiany, jeśli edytujemy istniejącego użytkownika
                              if (editingUser && value !== field.value) {
                                const updatedData = {
                                  ...form.getValues(),
                                  id: editingUser.id,
                                  position: value
                                };
                                updateUserMutation.mutate(updatedData);
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz stanowisko" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="kierownik">Kierownik</SelectItem>
                              <SelectItem value="zastępca">Zastępca kierownika</SelectItem>
                              <SelectItem value="doradca">Doradca klienta</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
              
              {/* Company specific fields */}
              {watchRole === 'company' && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-lg">Informacje o firmie</h3>
                  
                  <FormField
                    control={form.control}
                    name="companyOwnerOnly"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              
                              // Automatycznie zapisz zmiany, jeśli edytujemy istniejącego użytkownika
                              if (editingUser) {
                                const updatedData = {
                                  ...form.getValues(),
                                  id: editingUser.id,
                                  companyOwnerOnly: checked === 'indeterminate' ? true : !!checked
                                };
                                updateUserMutation.mutate(updatedData);
                              }
                            }}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Wyłącznie właściciel firmy
                          </FormLabel>
                          <FormDescription>
                            Odznacz to pole, jeśli właściciel firmy działa również jako montażysta
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nazwa firmy</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="np. Drzwi-Mont" 
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e); // Aktualizuj wartość pola formularza
                              
                              // Automatycznie zapisz zmiany po 1 sekundzie od zakończenia pisania
                              if (editingUser) {
                                const timer = setTimeout(() => {
                                  const newValue = e.target.value;
                                  if (newValue !== editingUser.companyName) {
                                    const updatedData = {
                                      ...form.getValues(),
                                      id: editingUser.id,
                                      companyName: newValue
                                    };
                                    updateUserMutation.mutate(updatedData);
                                  }
                                }, 1000);
                                
                                // Cleanup timer on next render
                                return () => clearTimeout(timer);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NIP</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="np. 9511230498" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e); // Aktualizuj wartość pola formularza
                                
                                // Automatycznie zapisz zmiany po 1 sekundzie od zakończenia pisania
                                if (editingUser) {
                                  const timer = setTimeout(() => {
                                    const newValue = e.target.value;
                                    if (newValue !== editingUser.nip) {
                                      const updatedData = {
                                        ...form.getValues(),
                                        id: editingUser.id,
                                        nip: newValue
                                      };
                                      updateUserMutation.mutate(updatedData);
                                    }
                                  }, 1000);
                                  
                                  // Cleanup timer on next render
                                  return () => clearTimeout(timer);
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="companyAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            <div className="flex items-center gap-1">
                              <MapPin size={16} className="text-blue-600" />
                              <span>Adres firmy</span>
                            </div>
                          </FormLabel>
                          <FormControl>
                            <GoogleAddressInput 
                              value={field.value || ''} 
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
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="services"
                    render={() => (
                      <FormItem>
                        <FormLabel>Usługi</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {['Montaż drzwi', 'Montaż podłogi', 'Transport'].map((service) => (
                            <FormField
                              key={service}
                              control={form.control}
                              name="services"
                              render={({ field }) => {
                                return (
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={service}
                                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                      checked={field.value?.includes(service)}
                                      onChange={(e) => {
                                        const currentValue = field.value || [];
                                        let newServices;
                                        
                                        if (e.target.checked) {
                                          newServices = [...currentValue, service];
                                          field.onChange(newServices);
                                        } else {
                                          newServices = currentValue.filter((val) => val !== service);
                                          field.onChange(newServices);
                                        }
                                        
                                        // Automatycznie zapisz zmiany
                                        if (editingUser) {
                                          const updatedData = {
                                            ...form.getValues(),
                                            id: editingUser.id,
                                            services: newServices
                                          };
                                          updateUserMutation.mutate(updatedData);
                                        }
                                      }}
                                    />
                                    <label htmlFor={service} className="text-sm text-gray-700">
                                      {service}
                                    </label>
                                  </div>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              {/* Installer specific fields */}
              {watchRole === 'installer' && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-medium text-lg">Informacje o montażyście</h3>
                  
                  <div className="mb-4">
                    <label className="block mb-2 text-sm font-medium text-gray-900">Wybierz firmę</label>
                    <select 
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                      onChange={(e) => {
                        const value = e.target.value;
                        const numValue = value ? parseInt(value, 10) : null;
                        const selectedCompany = companies.find(company => company.id === numValue);
                        
                        // Firmę wybrano
                        
                        // Aktualizuj zarówno companyId jak i companyName w formularzu
                        form.setValue('companyId', numValue);
                        form.setValue('companyName', selectedCompany?.name || '');
                        
                        // Automatycznie zapisz zmiany, jeśli edytujemy istniejącego użytkownika
                        if (editingUser) {
                          const updatedData = {
                            ...form.getValues(),
                            id: editingUser.id,
                            companyId: value ? parseInt(value, 10) : null,
                            companyName: selectedCompany?.name || ''
                          };
                          updateUserMutation.mutate(updatedData);
                        }
                      }}
                      value={form.watch('companyId')?.toString() || ''}
                    >
                      <option value="">-- Wybierz firmę --</option>
                      {companies.map(company => (
                        <option key={company.id} value={company.id.toString()}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                    {form.formState.errors.companyId && (
                      <p className="mt-2 text-sm text-red-600">
                        {form.formState.errors.companyId.message?.toString()}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <FormLabel className="block mb-2">Usługi</FormLabel>
                    <div className="flex flex-wrap gap-3 border rounded-md p-3">
                      {['Montaż drzwi', 'Montaż podłogi', 'Montaż okien', 'Montaż mebli', 'Transport'].map((service) => (
                        <div key={service} className="flex items-center space-x-2">
                          <Checkbox
                            id={`service-${service}`}
                            checked={form.watch('services')?.includes(service)}
                            onCheckedChange={(checked: boolean | "indeterminate") => {
                              const currentServices = form.getValues('services') || [];
                              let newServices;
                              
                              if (checked === true) {
                                newServices = [...currentServices, service];
                                form.setValue('services', newServices, {
                                  shouldValidate: true,
                                  shouldDirty: true
                                });
                              } else {
                                newServices = currentServices.filter(s => s !== service);
                                form.setValue('services', newServices, {
                                  shouldValidate: true,
                                  shouldDirty: true
                                });
                              }
                              
                              // Automatycznie zapisz zmiany
                              if (editingUser) {
                                const updatedData = {
                                  ...form.getValues(),
                                  id: editingUser.id,
                                  services: newServices
                                };
                                updateUserMutation.mutate(updatedData);
                              }
                            }}
                          />
                          <label
                            htmlFor={`service-${service}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {service}
                          </label>
                        </div>
                      ))}
                    </div>
                    {form.formState.errors.services && (
                      <p className="text-sm font-medium text-destructive mt-2">
                        {form.formState.errors.services.message?.toString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={
                    createUserMutation.isPending || 
                    updateUserMutation.isPending
                  }
                >
                  {(createUserMutation.isPending || updateUserMutation.isPending) ? (
                    <div className="flex items-center">
                      <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                      Zapisywanie...
                    </div>
                  ) : (
                    editingUser ? 'Zapisz zmiany' : 'Dodaj użytkownika'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}