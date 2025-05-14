import { useState, useEffect } from "react";
import { Setting } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Mail, Building, FileText, Cog, Globe, Palette, Bell } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";

// Interfejs dla wartości ustawień
interface SettingsFormValues {
  [key: string]: string | boolean | object | null;
}

// Komponent dla sekcji ustawień w danej kategorii
const SettingSection = ({ 
  title, 
  description, 
  children 
}: { 
  title: string;
  description: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

// Komponent główny ustawień
export default function Settings() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("notifications");
  const [formValues, setFormValues] = useState<SettingsFormValues>({});
  const [changes, setChanges] = useState<SettingsFormValues>({});
  const [isLoading, setIsLoading] = useState(false);

  // Jeśli nie jest admin, przekieruj do strony głównej
  if (!isAdmin) {
    return <Redirect to="/" />;
  }

  // Pobierz wszystkie ustawienia
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Problem z pobraniem ustawień');
      }
      return response.json();
    },
    staleTime: Infinity, // Ustawienia nie będą automatycznie oznaczane jako nieaktualne
    refetchOnWindowFocus: false, // Nie odświeżaj przy fokusie okna
    refetchInterval: false // Wyłącz automatyczne odświeżanie
  });

  // Mutacja do aktualizacji ustawień
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, valueJson }: { key: string; value?: string | null; valueJson?: object | null }) => {
      const response = await apiRequest('PATCH', `/api/settings/${key}`, { 
        value, 
        valueJson 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Zapisano zmiany",
        description: "Ustawienia zostały zaktualizowane pomyślnie.",
      });
      setChanges({});
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się zapisać zmian: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Mutacja do tworzenia nowych ustawień
  const createSettingMutation = useMutation({
    mutationFn: async ({ category, key, value, valueJson, description }: { 
      category: string; 
      key: string; 
      value?: string | null; 
      valueJson?: object | null;
      description?: string;
    }) => {
      const response = await apiRequest('POST', '/api/settings', {
        category,
        key,
        value,
        valueJson,
        description
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Dodano ustawienie",
        description: "Nowe ustawienie zostało dodane pomyślnie.",
      });
    },
    onError: (error) => {
      toast({
        title: "Błąd",
        description: `Nie udało się dodać ustawienia: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Filtruj ustawienia według kategorii
  const getSettingsByCategory = (category: string): Setting[] => {
    if (!settings) return [];
    return settings.filter((setting: Setting) => setting.category === category);
  };

  // Pobierz wartość ustawienia według klucza
  const getSettingValue = (key: string): string | boolean | object | null => {
    if (changes[key] !== undefined) {
      return changes[key];
    }
    if (!settings) return '';
    const setting = settings.find((s: Setting) => s.key === key);
    if (!setting) return '';
    return setting.valueJson || setting.value || '';
  };

  // Obsługa zmiany wartości ustawienia
  const handleSettingChange = (key: string, value: string | boolean | object | null) => {
    setChanges(prev => ({ ...prev, [key]: value }));
  };

  // Zapisz wszystkie zmienione ustawienia
  const saveChanges = async () => {
    setIsLoading(true);
    
    try {
      // Dla każdej zmiany, wywołaj mutację aktualizacji
      const keys = Object.keys(changes);
      
      for (const key of keys) {
        const value = changes[key];
        
        // Sprawdź, czy ustawienie już istnieje
        const existingSetting = settings?.find((s: Setting) => s.key === key);
        
        if (existingSetting) {
          // Aktualizuj istniejące ustawienie
          if (typeof value === 'object' && value !== null) {
            await updateSettingMutation.mutateAsync({ key, valueJson: value });
          } else {
            await updateSettingMutation.mutateAsync({ key, value: String(value) });
          }
        } else {
          // Utwórz nowe ustawienie w aktywnej kategorii
          if (typeof value === 'object' && value !== null) {
            await createSettingMutation.mutateAsync({ 
              category: activeTab, 
              key, 
              valueJson: value,
              description: `Ustawienie kategorii ${activeTab}` 
            });
          } else {
            await createSettingMutation.mutateAsync({ 
              category: activeTab, 
              key, 
              value: String(value),
              description: `Ustawienie kategorii ${activeTab}`  
            });
          }
        }
      }
      
      toast({
        title: "Zapisano zmiany",
        description: "Wszystkie ustawienia zostały zaktualizowane pomyślnie.",
      });
      setChanges({});
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił problem podczas zapisywania ustawień.",
        variant: "destructive",
      });
      console.error("Błąd podczas zapisywania ustawień:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Inicjalizacja wartości formularza na podstawie pobranych ustawień
  useEffect(() => {
    if (settings) {
      const initialValues: SettingsFormValues = {};
      settings.forEach((setting: Setting) => {
        initialValues[setting.key] = setting.valueJson || setting.value || '';
      });
      setFormValues(initialValues);
    }
  }, [settings]);

  // Utwórz lub zaktualizuj ustawienie
  const initializeSetting = async (category: string, key: string, defaultValue: string | boolean | object) => {
    // Sprawdź, czy ustawienie już istnieje
    if (settings) {
      const existingSetting = settings.find((s: Setting) => s.key === key);
      if (!existingSetting) {
        try {
          if (typeof defaultValue === 'object') {
            await createSettingMutation.mutateAsync({
              category,
              key,
              valueJson: defaultValue,
              description: `Ustawienie kategorii ${category}`
            });
          } else {
            await createSettingMutation.mutateAsync({
              category,
              key,
              value: String(defaultValue),
              description: `Ustawienie kategorii ${category}`
            });
          }
        } catch (error) {
          console.error(`Błąd podczas inicjalizacji ustawienia ${key}:`, error);
        }
      }
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ustawienia</h1>
          <p className="text-muted-foreground">
            Zarządzaj ustawieniami systemu Bel-Pol
          </p>
        </div>
        <Button 
          onClick={saveChanges} 
          disabled={Object.keys(changes).length === 0 || isLoading}
          className="flex items-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Zapisywanie...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Zapisz zmiany
            </>
          )}
        </Button>
      </div>

      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-6 w-full">
          <TabsTrigger value="notifications" className="flex items-center">
            <Mail className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Powiadomienia</span>
            <span className="inline md:hidden">Powiad.</span>
          </TabsTrigger>
          <TabsTrigger value="company" className="flex items-center">
            <Building className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Firma</span>
            <span className="inline md:hidden">Firma</span>
          </TabsTrigger>
          <TabsTrigger value="order" className="flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Zlecenia</span>
            <span className="inline md:hidden">Zlecenia</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center">
            <Cog className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">System</span>
            <span className="inline md:hidden">System</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Integracje</span>
            <span className="inline md:hidden">Integr.</span>
          </TabsTrigger>
          <TabsTrigger value="ui" className="flex items-center">
            <Palette className="h-4 w-4 mr-2" />
            <span className="hidden md:inline">Interfejs</span>
            <span className="inline md:hidden">Interf.</span>
          </TabsTrigger>
        </TabsList>

        {/* Zawartość zakładki Powiadomienia */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia powiadomień</CardTitle>
              <CardDescription>
                Skonfiguruj system powiadomień email i push
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SettingSection 
                title="Serwer SMTP" 
                description="Ustawienia do wysyłania powiadomień email"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_host">Host SMTP</Label>
                    <Input 
                      id="smtp_host" 
                      placeholder="mail.example.com" 
                      value={getSettingValue('smtp_host') as string || ''}
                      onChange={(e) => handleSettingChange('smtp_host', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_port">Port SMTP</Label>
                    <Input 
                      id="smtp_port" 
                      placeholder="587" 
                      value={getSettingValue('smtp_port') as string || ''}
                      onChange={(e) => handleSettingChange('smtp_port', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="smtp_user">Użytkownik SMTP</Label>
                    <Input 
                      id="smtp_user" 
                      placeholder="info@example.com" 
                      value={getSettingValue('smtp_user') as string || ''}
                      onChange={(e) => handleSettingChange('smtp_user', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_pass">Hasło SMTP</Label>
                    <Input 
                      id="smtp_pass" 
                      type="password" 
                      placeholder="••••••••" 
                      value={getSettingValue('smtp_pass') as string || ''}
                      onChange={(e) => handleSettingChange('smtp_pass', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email_from">Adres nadawcy</Label>
                    <Input 
                      id="email_from" 
                      placeholder="info@bel-pol.com" 
                      value={getSettingValue('email_from') as string || ''}
                      onChange={(e) => handleSettingChange('email_from', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="smtp_secure">Bezpieczne połączenie</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Switch
                        id="smtp_secure"
                        checked={getSettingValue('smtp_secure') === 'true' || getSettingValue('smtp_secure') === true}
                        onCheckedChange={(checked) => handleSettingChange('smtp_secure', checked)}
                      />
                      <Label htmlFor="smtp_secure" className="font-normal">
                        Używaj SSL/TLS
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        toast({
                          title: "Testowanie...",
                          description: "Wysyłanie testowego emaila",
                        });
                        
                        const response = await fetch('/api/settings/test-smtp', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            email: user?.email
                          }),
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                          toast({
                            title: "Sukces!",
                            description: "Testowy email został wysłany. Sprawdź swoją skrzynkę pocztową.",
                          });
                        } else {
                          toast({
                            title: "Błąd",
                            description: data.message || "Wystąpił problem podczas wysyłania testowego emaila",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        console.error("Błąd podczas testowania SMTP:", error);
                        toast({
                          title: "Błąd",
                          description: "Wystąpił błąd podczas próby wysłania testowego emaila",
                          variant: "destructive",
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testowanie...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Wyślij testowy email
                      </>
                    )}
                  </Button>
                </div>
              </SettingSection>

              <SettingSection 
                title="Web Push" 
                description="Konfiguracja powiadomień push"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vapid_public_key">Klucz publiczny VAPID</Label>
                    <Textarea 
                      id="vapid_public_key" 
                      placeholder="Klucz publiczny VAPID" 
                      value={getSettingValue('vapid_public_key') as string || ''}
                      onChange={(e) => handleSettingChange('vapid_public_key', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vapid_private_key">Klucz prywatny VAPID</Label>
                    <Textarea 
                      id="vapid_private_key" 
                      placeholder="Klucz prywatny VAPID" 
                      value={getSettingValue('vapid_private_key') as string || ''}
                      onChange={(e) => handleSettingChange('vapid_private_key', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        toast({
                          title: "Testowanie...",
                          description: "Wysyłanie testowego powiadomienia push",
                        });
                        
                        const response = await fetch('/api/settings/test-push', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          }
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                          toast({
                            title: "Sukces!",
                            description: "Testowe powiadomienie push zostało wysłane. Powinno pojawić się na ekranie.",
                          });
                        } else {
                          toast({
                            title: "Błąd",
                            description: data.message || "Wystąpił problem podczas wysyłania powiadomienia push",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        console.error("Błąd podczas testowania powiadomień push:", error);
                        toast({
                          title: "Błąd",
                          description: "Upewnij się, że Twoja przeglądarka ma aktywne powiadomienia i zasubskrybuj je w aplikacji.",
                          variant: "destructive",
                        });
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testowanie...
                      </>
                    ) : (
                      <>
                        <Bell className="mr-2 h-4 w-4" />
                        Wyślij testowe powiadomienie push
                      </>
                    )}
                  </Button>
                </div>
              </SettingSection>

              <SettingSection 
                title="Konfiguracja powiadomień" 
                description="Włącz lub wyłącz powiadomienia dla poszczególnych zdarzeń"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notify_new_order">Nowe zlecenie</Label>
                      <p className="text-sm text-muted-foreground">Powiadomienia o nowych zleceniach</p>
                    </div>
                    <Switch
                      id="notify_new_order"
                      checked={getSettingValue('notify_new_order') === 'true' || getSettingValue('notify_new_order') === true}
                      onCheckedChange={(checked) => handleSettingChange('notify_new_order', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notify_status_change">Zmiana statusu</Label>
                      <p className="text-sm text-muted-foreground">Powiadomienia o zmianach statusu zlecenia</p>
                    </div>
                    <Switch
                      id="notify_status_change"
                      checked={getSettingValue('notify_status_change') === 'true' || getSettingValue('notify_status_change') === true}
                      onCheckedChange={(checked) => handleSettingChange('notify_status_change', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="notify_installer_assigned">Przypisanie montażysty</Label>
                      <p className="text-sm text-muted-foreground">Powiadomienia o przypisaniu montażysty do zlecenia</p>
                    </div>
                    <Switch
                      id="notify_installer_assigned"
                      checked={getSettingValue('notify_installer_assigned') === 'true' || getSettingValue('notify_installer_assigned') === true}
                      onCheckedChange={(checked) => handleSettingChange('notify_installer_assigned', checked)}
                    />
                  </div>
                </div>
              </SettingSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zawartość zakładki Firma */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dane firmy</CardTitle>
              <CardDescription>
                Informacje kontaktowe i dane identyfikacyjne
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SettingSection 
                title="Informacje o firmie" 
                description="Podstawowe dane identyfikacyjne"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nazwa firmy</Label>
                    <Input 
                      id="company_name" 
                      placeholder="Bel-Pol" 
                      value={getSettingValue('company_name') as string || ''}
                      onChange={(e) => handleSettingChange('company_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_nip">NIP</Label>
                    <Input 
                      id="company_nip" 
                      placeholder="1234567890" 
                      value={getSettingValue('company_nip') as string || ''}
                      onChange={(e) => handleSettingChange('company_nip', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_address">Adres siedziby</Label>
                  <Textarea 
                    id="company_address" 
                    placeholder="ul. Przykładowa 123, 00-000 Miasto" 
                    value={getSettingValue('company_address') as string || ''}
                    onChange={(e) => handleSettingChange('company_address', e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">Telefon</Label>
                    <Input 
                      id="company_phone" 
                      placeholder="+48 123 456 789" 
                      value={getSettingValue('company_phone') as string || ''}
                      onChange={(e) => handleSettingChange('company_phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_email">Email</Label>
                    <Input 
                      id="company_email" 
                      placeholder="kontakt@bel-pol.com" 
                      value={getSettingValue('company_email') as string || ''}
                      onChange={(e) => handleSettingChange('company_email', e.target.value)}
                    />
                  </div>
                </div>
              </SettingSection>

              <SettingSection 
                title="Logo firmy" 
                description="Ustawienia logo na dokumentach"
              >
                <div className="space-y-2">
                  <Label htmlFor="company_logo_url">URL do logo</Label>
                  <Input 
                    id="company_logo_url" 
                    placeholder="https://example.com/logo.png" 
                    value={getSettingValue('company_logo_url') as string || ''}
                    onChange={(e) => handleSettingChange('company_logo_url', e.target.value)}
                  />
                </div>
              </SettingSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zawartość zakładki Zlecenia */}
        <TabsContent value="order" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia zleceń</CardTitle>
              <CardDescription>
                Konfiguracja dotycząca zleceń montażowych
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SettingSection 
                title="Numeracja zleceń" 
                description="Konfiguracja automatycznej numeracji"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="order_number_prefix">Prefiks</Label>
                    <Input 
                      id="order_number_prefix" 
                      placeholder="ZM/" 
                      value={getSettingValue('order_number_prefix') as string || ''}
                      onChange={(e) => handleSettingChange('order_number_prefix', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_number_suffix">Sufiks</Label>
                    <Input 
                      id="order_number_suffix" 
                      placeholder="/BP" 
                      value={getSettingValue('order_number_suffix') as string || ''}
                      onChange={(e) => handleSettingChange('order_number_suffix', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="order_number_format">Format</Label>
                    <Select 
                      value={getSettingValue('order_number_format') as string || 'YY/NNNNN'}
                      onValueChange={(value) => handleSettingChange('order_number_format', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Format numeracji" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YY/NNNNN">RR/NNNNN (23/00001)</SelectItem>
                        <SelectItem value="YYYY/NNNNN">RRRR/NNNNN (2023/00001)</SelectItem>
                        <SelectItem value="MM/YY/NNNNN">MM/RR/NNNNN (01/23/00001)</SelectItem>
                        <SelectItem value="NNNNN">NNNNN (00001)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SettingSection>

              <SettingSection 
                title="Domyślne wartości" 
                description="Domyślne ustawienia dla nowych zleceń"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="default_order_status">Domyślny status</Label>
                    <Select 
                      value={getSettingValue('default_order_status') as string || 'złożone'}
                      onValueChange={(value) => handleSettingChange('default_order_status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz domyślny status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="złożone">Złożone</SelectItem>
                        <SelectItem value="w realizacji">W realizacji</SelectItem>
                        <SelectItem value="zaplanowane">Zaplanowane</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="default_delivery_status">Domyślny status dostawy</Label>
                    <Select 
                      value={getSettingValue('default_delivery_status') as string || 'czeka na wydanie'}
                      onValueChange={(value) => handleSettingChange('default_delivery_status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz domyślny status dostawy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="czeka na wydanie">Czeka na wydanie</SelectItem>
                        <SelectItem value="gotowe do wydania">Gotowe do wydania</SelectItem>
                        <SelectItem value="w transporcie">W transporcie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_realization_days">Domyślny czas realizacji (dni)</Label>
                  <Input 
                    id="default_realization_days" 
                    type="number" 
                    placeholder="14" 
                    value={getSettingValue('default_realization_days') as string || ''}
                    onChange={(e) => handleSettingChange('default_realization_days', e.target.value)}
                  />
                </div>
              </SettingSection>

              <SettingSection 
                title="Wymagane pola" 
                description="Konfiguracja wymaganych pól formularza"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="require_phone">Numer telefonu</Label>
                      <p className="text-sm text-muted-foreground">Wymagaj numeru telefonu klienta</p>
                    </div>
                    <Switch
                      id="require_phone"
                      checked={getSettingValue('require_phone') === 'true' || getSettingValue('require_phone') === true}
                      onCheckedChange={(checked) => handleSettingChange('require_phone', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="require_email">Email</Label>
                      <p className="text-sm text-muted-foreground">Wymagaj adresu email klienta</p>
                    </div>
                    <Switch
                      id="require_email"
                      checked={getSettingValue('require_email') === 'true' || getSettingValue('require_email') === true}
                      onCheckedChange={(checked) => handleSettingChange('require_email', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="require_notes">Notatki</Label>
                      <p className="text-sm text-muted-foreground">Wymagaj dodania notatek do zlecenia</p>
                    </div>
                    <Switch
                      id="require_notes"
                      checked={getSettingValue('require_notes') === 'true' || getSettingValue('require_notes') === true}
                      onCheckedChange={(checked) => handleSettingChange('require_notes', checked)}
                    />
                  </div>
                </div>
              </SettingSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zawartość zakładki System */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia systemowe</CardTitle>
              <CardDescription>
                Ogólne ustawienia działania systemu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SettingSection 
                title="Sesja użytkownika" 
                description="Konfiguracja sesji i uwierzytelniania"
              >
                <div className="space-y-2">
                  <Label htmlFor="session_lifetime">Czas trwania sesji (minuty)</Label>
                  <Input 
                    id="session_lifetime" 
                    type="number" 
                    placeholder="60" 
                    value={getSettingValue('session_lifetime') as string || ''}
                    onChange={(e) => handleSettingChange('session_lifetime', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Czas po którym użytkownik zostanie automatycznie wylogowany</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <Label htmlFor="require_strong_password">Silne hasła</Label>
                    <p className="text-sm text-muted-foreground">Wymagaj złożonych haseł (min. 8 znaków, duże i małe litery, cyfry, znaki specjalne)</p>
                  </div>
                  <Switch
                    id="require_strong_password"
                    checked={getSettingValue('require_strong_password') === 'true' || getSettingValue('require_strong_password') === true}
                    onCheckedChange={(checked) => handleSettingChange('require_strong_password', checked)}
                  />
                </div>
              </SettingSection>

              <SettingSection 
                title="Kopia zapasowa" 
                description="Konfiguracja automatycznych kopii zapasowych"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto_backup">Automatyczne kopie zapasowe</Label>
                    <p className="text-sm text-muted-foreground">Twórz regularne kopie zapasowe danych</p>
                  </div>
                  <Switch
                    id="auto_backup"
                    checked={getSettingValue('auto_backup') === 'true' || getSettingValue('auto_backup') === true}
                    onCheckedChange={(checked) => handleSettingChange('auto_backup', checked)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="backup_frequency">Częstotliwość (dni)</Label>
                    <Input 
                      id="backup_frequency" 
                      type="number" 
                      placeholder="7" 
                      value={getSettingValue('backup_frequency') as string || ''}
                      onChange={(e) => handleSettingChange('backup_frequency', e.target.value)}
                      disabled={getSettingValue('auto_backup') !== 'true' && getSettingValue('auto_backup') !== true}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup_retain_count">Liczba przechowywanych kopii</Label>
                    <Input 
                      id="backup_retain_count" 
                      type="number" 
                      placeholder="5" 
                      value={getSettingValue('backup_retain_count') as string || ''}
                      onChange={(e) => handleSettingChange('backup_retain_count', e.target.value)}
                      disabled={getSettingValue('auto_backup') !== 'true' && getSettingValue('auto_backup') !== true}
                    />
                  </div>
                </div>
              </SettingSection>

              <SettingSection 
                title="Język i lokalizacja" 
                description="Ustawienia językowe aplikacji"
              >
                <div className="space-y-2">
                  <Label htmlFor="system_language">Język systemu</Label>
                  <Select 
                    value={getSettingValue('system_language') as string || 'pl'}
                    onValueChange={(value) => handleSettingChange('system_language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz język" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pl">Polski</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zawartość zakładki Integracje */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integracje zewnętrzne</CardTitle>
              <CardDescription>
                Konfiguracja połączeń z zewnętrznymi usługami
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SettingSection 
                title="Google Maps" 
                description="Konfiguracja API Google Maps"
              >
                <div className="space-y-2">
                  <Label htmlFor="google_maps_api_key">Klucz API Google Maps</Label>
                  <Input 
                    id="google_maps_api_key" 
                    placeholder="AIzaSyB_1234567890abcdefghijklmnop" 
                    value={getSettingValue('google_maps_api_key') as string || ''}
                    onChange={(e) => handleSettingChange('google_maps_api_key', e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <Label htmlFor="enable_maps">Włącz mapy</Label>
                    <p className="text-sm text-muted-foreground">Pokaż mapy w aplikacji</p>
                  </div>
                  <Switch
                    id="enable_maps"
                    checked={getSettingValue('enable_maps') === 'true' || getSettingValue('enable_maps') === true}
                    onCheckedChange={(checked) => handleSettingChange('enable_maps', checked)}
                  />
                </div>
              </SettingSection>

              <SettingSection 
                title="Integracja z kalendarzem" 
                description="Konfiguracja synchronizacji z kalendarzem"
              >
                <div className="space-y-2">
                  <Label htmlFor="calendar_type">Typ kalendarza</Label>
                  <Select 
                    value={getSettingValue('calendar_type') as string || 'google'}
                    onValueChange={(value) => handleSettingChange('calendar_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz typ kalendarza" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">Google Calendar</SelectItem>
                      <SelectItem value="outlook">Microsoft Outlook</SelectItem>
                      <SelectItem value="none">Brak</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="calendar_api_key">Klucz API kalendarza</Label>
                  <Input 
                    id="calendar_api_key" 
                    placeholder="Klucz API" 
                    value={getSettingValue('calendar_api_key') as string || ''}
                    onChange={(e) => handleSettingChange('calendar_api_key', e.target.value)}
                    disabled={getSettingValue('calendar_type') === 'none'}
                  />
                </div>
              </SettingSection>

              <SettingSection 
                title="System fakturowania" 
                description="Integracja z systemem fakturowania"
              >
                <div className="space-y-2">
                  <Label htmlFor="invoicing_system">System fakturowania</Label>
                  <Select 
                    value={getSettingValue('invoicing_system') as string || 'none'}
                    onValueChange={(value) => handleSettingChange('invoicing_system', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz system fakturowania" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Brak</SelectItem>
                      <SelectItem value="subiekt">Subiekt GT</SelectItem>
                      <SelectItem value="comarch">Comarch ERP XT</SelectItem>
                      <SelectItem value="custom">System własny</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="invoicing_api_url">URL API fakturowania</Label>
                  <Input 
                    id="invoicing_api_url" 
                    placeholder="https://api.fakturowanie.pl" 
                    value={getSettingValue('invoicing_api_url') as string || ''}
                    onChange={(e) => handleSettingChange('invoicing_api_url', e.target.value)}
                    disabled={getSettingValue('invoicing_system') === 'none'}
                  />
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="invoicing_api_key">Klucz API fakturowania</Label>
                  <Input 
                    id="invoicing_api_key" 
                    placeholder="Klucz API" 
                    value={getSettingValue('invoicing_api_key') as string || ''}
                    onChange={(e) => handleSettingChange('invoicing_api_key', e.target.value)}
                    disabled={getSettingValue('invoicing_system') === 'none'}
                  />
                </div>
              </SettingSection>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zawartość zakładki Interfejs */}
        <TabsContent value="ui" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personalizacja interfejsu</CardTitle>
              <CardDescription>
                Dostosuj wygląd aplikacji
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <SettingSection 
                title="Motyw kolorystyczny" 
                description="Dostosowanie kolorów aplikacji"
              >
                <div className="space-y-2">
                  <Label htmlFor="ui_theme">Motyw</Label>
                  <Select 
                    value={getSettingValue('ui_theme') as string || 'light'}
                    onValueChange={(value) => handleSettingChange('ui_theme', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz motyw" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Jasny</SelectItem>
                      <SelectItem value="dark">Ciemny</SelectItem>
                      <SelectItem value="system">Systemowy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="ui_primary_color">Kolor główny</Label>
                  <Select 
                    value={getSettingValue('ui_primary_color') as string || 'blue'}
                    onValueChange={(value) => handleSettingChange('ui_primary_color', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz kolor główny" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Niebieski</SelectItem>
                      <SelectItem value="green">Zielony</SelectItem>
                      <SelectItem value="purple">Fioletowy</SelectItem>
                      <SelectItem value="red">Czerwony</SelectItem>
                      <SelectItem value="orange">Pomarańczowy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SettingSection>

              <SettingSection 
                title="Układ pulpitu" 
                description="Konfiguracja widoku głównego dashboardu"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="dashboard_show_recent_orders">Ostatnie zlecenia</Label>
                      <p className="text-sm text-muted-foreground">Pokaż sekcję ostatnich zleceń</p>
                    </div>
                    <Switch
                      id="dashboard_show_recent_orders"
                      checked={getSettingValue('dashboard_show_recent_orders') === 'true' || getSettingValue('dashboard_show_recent_orders') === true}
                      onCheckedChange={(checked) => handleSettingChange('dashboard_show_recent_orders', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="dashboard_show_stats">Statystyki</Label>
                      <p className="text-sm text-muted-foreground">Pokaż sekcję statystyk</p>
                    </div>
                    <Switch
                      id="dashboard_show_stats"
                      checked={getSettingValue('dashboard_show_stats') === 'true' || getSettingValue('dashboard_show_stats') === true}
                      onCheckedChange={(checked) => handleSettingChange('dashboard_show_stats', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="dashboard_show_sales_chart">Wykres sprzedaży</Label>
                      <p className="text-sm text-muted-foreground">Pokaż wykres realizacji planu sprzedaży</p>
                    </div>
                    <Switch
                      id="dashboard_show_sales_chart"
                      checked={getSettingValue('dashboard_show_sales_chart') === 'true' || getSettingValue('dashboard_show_sales_chart') === true}
                      onCheckedChange={(checked) => handleSettingChange('dashboard_show_sales_chart', checked)}
                    />
                  </div>
                </div>
              </SettingSection>

              <SettingSection 
                title="Widoczność modułów" 
                description="Konfiguracja widoczności modułów dla różnych ról"
              >
                <div className="space-y-2">
                  <Label>Administratorzy widzą</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="admin_see_companies"
                        checked={getSettingValue('admin_see_companies') === 'true' || getSettingValue('admin_see_companies') === true}
                        onCheckedChange={(checked) => handleSettingChange('admin_see_companies', checked)}
                      />
                      <Label htmlFor="admin_see_companies" className="font-normal">
                        Firmy
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="admin_see_installers"
                        checked={getSettingValue('admin_see_installers') === 'true' || getSettingValue('admin_see_installers') === true}
                        onCheckedChange={(checked) => handleSettingChange('admin_see_installers', checked)}
                      />
                      <Label htmlFor="admin_see_installers" className="font-normal">
                        Montażyści
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="admin_see_salesplan"
                        checked={getSettingValue('admin_see_salesplan') === 'true' || getSettingValue('admin_see_salesplan') === true}
                        onCheckedChange={(checked) => handleSettingChange('admin_see_salesplan', checked)}
                      />
                      <Label htmlFor="admin_see_salesplan" className="font-normal">
                        Plan sprzedaży
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mt-4">
                  <Label>Pracownicy sklepu widzą</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="worker_see_companies"
                        checked={getSettingValue('worker_see_companies') === 'true' || getSettingValue('worker_see_companies') === true}
                        onCheckedChange={(checked) => handleSettingChange('worker_see_companies', checked)}
                      />
                      <Label htmlFor="worker_see_companies" className="font-normal">
                        Firmy
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="worker_see_installers"
                        checked={getSettingValue('worker_see_installers') === 'true' || getSettingValue('worker_see_installers') === true}
                        onCheckedChange={(checked) => handleSettingChange('worker_see_installers', checked)}
                      />
                      <Label htmlFor="worker_see_installers" className="font-normal">
                        Montażyści
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="worker_see_salesplan"
                        checked={getSettingValue('worker_see_salesplan') === 'true' || getSettingValue('worker_see_salesplan') === true}
                        onCheckedChange={(checked) => handleSettingChange('worker_see_salesplan', checked)}
                      />
                      <Label htmlFor="worker_see_salesplan" className="font-normal">
                        Plan sprzedaży
                      </Label>
                    </div>
                  </div>
                </div>
              </SettingSection>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}