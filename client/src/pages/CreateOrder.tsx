import { useState } from 'react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BackButton } from '@/components/ui/back-button';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { CreateOrder } from '@shared/schema';
import { GoogleAddressInput } from '@/components/address';

const createOrderSchema = z.object({
  clientName: z.string().min(3, { message: 'Imię i nazwisko klienta jest wymagane' }),
  clientPhone: z.string().min(9, { message: 'Numer telefonu jest wymagany' }),
  installationAddress: z.string().min(5, { message: 'Adres montażu jest wymagany' }),
  serviceType: z.string().min(1, { message: 'Wybierz zakres usługi' }),
  withTransport: z.boolean().default(false),
  proposedDate: z.string().min(1, { message: 'Proponowany termin jest wymagany' }),
  notes: z.string().optional().or(z.literal('')),
  documentsProvided: z.boolean().default(false),
  companyId: z.string().min(1, { message: 'Wybierz firmę montażową' }),
  storeId: z.number().default(1), // Domyślnie sklep nr 1
  storeName: z.string().default('Bel-Pol Szczecin'), // Domyślnie nazwa sklepu
  userId: z.number().optional(),
  userName: z.string().optional(),
  orderValue: z.coerce.number().default(0),
  warehouseValue: z.coerce.number().default(0),
  serviceValue: z.coerce.number().default(0),
  // Nowe pola zgodnie z wymaganiami
  deliveryStatus: z.string().default('gotowe do wydania'), // Status dostawy - gotowe do wydania, dostarczone do klienta
  installationDate: z.string().optional().or(z.literal('')),
  installationStatus: z.string().default('zlecenie złożone'), // Status montażu - zlecenie złożone, w realizacji, wykonane, reklamacja
  complaintNotes: z.string().optional().or(z.literal('')),
  complaintPhotos: z.array(z.string()).optional().default([]),
  willBeSettled: z.boolean().default(false), // Będzie rozliczone w tym miesiącu
  invoiceIssued: z.boolean().default(false), // Faktura wystawiona
  // Pole companyName jest dodawane w funkcji onSubmit na podstawie wybranej firmy
});

type CreateOrderFormData = z.infer<typeof createOrderSchema>;

export default function CreateOrderPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Diagnostyczne logowanie informacji o użytkowniku
  console.log("CreateOrder - Zalogowany użytkownik:", JSON.stringify(user, null, 2));
  console.log("CreateOrder - ID sklepu użytkownika:", user?.storeId);
  console.log("CreateOrder - Store użytkownika:", user?.store);
  
  // Pobieranie firm montażowych z uwzględnieniem roli użytkownika
  const { data: companies = [] } = useQuery<Array<{ id: number, name: string }>>({
    queryKey: ['/api/companies', user?.role === 'worker' ? 'filtered' : 'all'],
    queryFn: async () => {
      // Jeśli użytkownik jest pracownikiem sklepu, pobierz tylko firmy przypisane do jego sklepu
      if (user?.role === 'worker' && user?.storeId) {
        console.log(`Pobieranie firm przypisanych do sklepu ${user.storeId}`);
        const response = await fetch(`/api/stores/${user.storeId}/companies`);
        if (!response.ok) {
          throw new Error('Nie udało się pobrać firm montażowych');
        }
        return await response.json();
      } 
      // W przeciwnym wypadku pobierz wszystkie firmy
      else {
        console.log('Pobieranie wszystkich firm (admin)');
        const response = await fetch('/api/companies');
        if (!response.ok) {
          throw new Error('Nie udało się pobrać firm montażowych');
        }
        return await response.json();
      }
    },
    enabled: !!user,
  });
  
  const form = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      installationAddress: '',
      serviceType: '',
      withTransport: false,
      proposedDate: '',
      notes: '',
      documentsProvided: false,
      companyId: '',
      orderValue: 0,
      warehouseValue: 0,
      serviceValue: 0,
      // Nowe pola
      deliveryStatus: 'gotowe do wydania',
      installationDate: '',
      installationStatus: 'zlecenie złożone',
      complaintNotes: '',
      complaintPhotos: [],
      willBeSettled: false,
      invoiceIssued: false,
    },
  });
  
  const createOrderMutation = useMutation({
    mutationFn: async (data: CreateOrderFormData) => {
      return await apiRequest('POST', '/api/orders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: 'Zlecenie utworzone',
        description: 'Nowe zlecenie zostało pomyślnie utworzone',
      });
      setLocation('/orders');
    },
    onError: (error) => {
      toast({
        title: 'Błąd',
        description: `Nie udało się utworzyć zlecenia: ${error instanceof Error ? error.message : 'Nieznany błąd'}`,
        variant: 'destructive',
      });
    }
  });
  
  const onSubmit = (data: CreateOrderFormData) => {
    console.log("Dane formularza:", data);
    // Wyświetl wszystkie błędy formularza, jeśli istnieją
    console.log("Błędy formularza:", form.formState.errors);
    
    // Znajdź nazwę firmy na podstawie companyId
    const selectedCompany = companies.find(company => 
      company.id.toString() === data.companyId
    );
    
    if (!selectedCompany) {
      toast({
        title: "Błąd",
        description: "Nie znaleziono wybranej firmy",
        variant: "destructive",
      });
      return;
    }
    
    // Przygotuj dane zamówienia
    const orderData = {
      ...data,
      // Dodajemy nazwę firmy - to jest kluczowe, ponieważ serwer teraz weryfikuje tę wartość
      companyName: selectedCompany.name,
      // Zapewniamy wartości dla pól związanych ze sklepem i użytkownikiem
      storeId: user?.storeId || 1,
      storeName: user?.store || 'Bel-Pol Szczecin',
      // Dodajemy informacje o użytkowniku tworzącym zamówienie
      userId: user?.id || 1,
      userName: user?.name || 'Administrator',
      // Przekształć puste wartości numeryczne na zera
      orderValue: data.orderValue || 0,
      warehouseValue: data.warehouseValue || 0,
      serviceValue: data.serviceValue || 0
    };
    
    console.log("Dane wysyłane do API:", orderData);
    
    createOrderMutation.mutate(orderData, {
      onError: (error: any) => {
        console.error("Błąd podczas wysyłania danych:", error);
        let errorMessage = "Wystąpił problem podczas tworzenia zlecenia";
        
        // Sprawdź, czy błąd zawiera szczegółowe informacje z serwera
        if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Błąd",
          description: errorMessage,
          variant: "destructive",
        });
      }
    });
  };
  
  const handleGoBack = () => {
    setLocation('/orders');
  };
  
  // Ensure only admin and workers can create orders
  if (user?.role !== 'admin' && user?.role !== 'worker') {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <CardTitle className="font-semibold text-gray-800">Brak dostępu</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-gray-600">Nie masz uprawnień do tworzenia nowych zleceń.</p>
          <Button className="mt-4" onClick={handleGoBack}>Wróć do listy zleceń</Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <CardHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <BackButton variant="ghost" size="icon" label="" className="h-8 w-8" fallbackPath="/orders" />
          <CardTitle className="font-semibold text-gray-800">
            Nowe zlecenie
          </CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Client Information */}
            <div>
              <h3 className="font-medium text-lg mb-4">Dane klienta</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Imię i nazwisko klienta</FormLabel>
                      <FormControl>
                        <Input placeholder="np. Jan Kowalski" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numer telefonu</FormLabel>
                      <FormControl>
                        <Input placeholder="np. 500600700" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="installationAddress"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>
                        <div className="flex items-center gap-1">
                          <MapPin size={16} className="text-blue-600" />
                          <span>Adres montażu</span>
                        </div>
                      </FormLabel>
                      <FormControl>
                        <GoogleAddressInput 
                          value={field.value} 
                          onChange={field.onChange}
                          placeholder="Wpisz adres montażu..." 
                          className="w-full"
                          required
                        />
                      </FormControl>
                      <FormDescription>
                        Użyj autouzupełniania, aby wybrać dokładny adres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            

            
            {/* Order Details */}
            <div className="pt-4 border-t">
              <h3 className="font-medium text-lg mb-4">Szczegóły zlecenia</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zakres usługi</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz rodzaj usługi" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Montaż drzwi">Montaż drzwi</SelectItem>
                          <SelectItem value="Montaż podłogi">Montaż podłogi</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="withTransport"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Z transportem</FormLabel>
                        <FormDescription>
                          Zaznacz, jeśli zlecenie wymaga transportu
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="proposedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proponowany termin montażu</FormLabel>
                      <FormControl>
                        <Input placeholder="np. początek maja" {...field} />
                      </FormControl>
                      <FormDescription>
                        Wpisz proponowany termin montażu w formie tekstowej
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firma montażowa</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz firmę montażową" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies?.map((company: { id: number, name: string }) => (
                            <SelectItem key={company.id} value={company.id.toString()}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {user?.role === 'worker' && user?.storeId ? 
                          "Lista zawiera tylko firmy montażowe obsługujące ten sklep" : 
                          "Lista zawiera wszystkie dostępne firmy montażowe"}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="documentsProvided"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Dokumenty montażowe przekazane</FormLabel>
                        <FormDescription>
                          Zaznacz, jeśli dokumenty montażowe zostały przekazane montażystom
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Uwagi do zlecenia</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Dodatkowe informacje dotyczące zlecenia..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Financial Data - Only for admin and workers */}
            {(user?.role === 'admin' || user?.role === 'worker') && (
              <>
                <div className="pt-4 border-t">
                  <h3 className="font-medium text-lg mb-4">Dane finansowe</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="orderValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wartość zlecenia netto (zł)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="warehouseValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wartość wydania magazynowego netto (zł)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="serviceValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Wartość kosztów usługi netto (zł)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <FormField
                      control={form.control}
                      name="willBeSettled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Będzie rozliczone w tym miesiącu</FormLabel>
                            <FormDescription>
                              Zaznacz, jeśli zlecenie ma być rozliczone w bieżącym miesiącu
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="invoiceIssued"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 py-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Faktura wystawiona</FormLabel>
                            <FormDescription>
                              Zaznacz, jeśli faktura została już wystawiona
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Delivery Status - Only for admin and workers */}
                <div className="pt-4 border-t">
                  <h3 className="font-medium text-lg mb-4">Status dostawy</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="deliveryStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status dostawy</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz status dostawy" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="gotowe do wydania">Gotowe do wydania</SelectItem>
                              <SelectItem value="dostarczone do klienta">Dostarczone do klienta</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
            )}
            
            {/* Wyświetlanie błędów walidacji dla całego formularza */}
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="bg-red-50 p-3 rounded-md border border-red-200 mb-4">
                <p className="text-red-800 font-medium">Formularz zawiera błędy:</p>
                <ul className="list-disc list-inside text-red-700 text-sm">
                  {Object.entries(form.formState.errors).map(([field, error]) => (
                    <li key={field}>{error?.message?.toString()}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex justify-end space-x-4 pt-4">
              <Button 
                variant="outline" 
                type="button" 
                onClick={handleGoBack}
              >
                Anuluj
              </Button>
              
              {/* Zwykły przycisk submit formularza */}
              <Button 
                type="submit" 
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                    Zapisywanie...
                  </div>
                ) : (
                  'Utwórz zlecenie'
                )}
              </Button>
              
              {/* Dodatkowy przycisk do siłowego wysłania formularza (pomijający validację) */}
              <Button 
                type="button" 
                onClick={() => {
                  const currentData = form.getValues();
                  console.log("Wymuszenie wysłania formularza z danymi:", currentData);
                  onSubmit(currentData);
                }}
                disabled={createOrderMutation.isPending}
                variant="secondary"
              >
                {createOrderMutation.isPending ? "Zapisywanie..." : "Wymuś zapisanie"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
