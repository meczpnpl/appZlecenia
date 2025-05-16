import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LockKeyhole, Building2, Store, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminName, setAdminName] = useState('Tomek Arso');
  const [adminEmail, setAdminEmail] = useState('tomekarso@gmail.com');
  const [adminPassword, setAdminPassword] = useState('ToM01111965');
  const [adminSetupError, setAdminSetupError] = useState('');
  const [isAdminSetupLoading, setIsAdminSetupLoading] = useState(false);
  
  // Obsługa formularza logowania
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    if (!email || !password) {
      setError('Wprowadź email i hasło');
      setIsLoading(false);
      return;
    }
    
    try {
      console.log("Próba logowania dla:", email);
      
      // Spróbuj zalogować się
      await login(email, password);
      
      // Przekieruj użytkownika do głównej strony
      toast({
        title: "Zalogowano pomyślnie",
        description: "Witamy w systemie zarządzania zleceniami Bel-Pol",
      });
      
      // Krótkie opóźnienie, aby toast zdążył się pokazać
      setTimeout(() => {
        setLocation('/');
      }, 500);
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Niepoprawny email lub hasło. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Obsługa formularza konfiguracji administratora
  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSetupError('');
    setIsAdminSetupLoading(true);
    
    if (!adminName || !adminEmail || !adminPassword) {
      setAdminSetupError('Wszystkie pola są wymagane');
      setIsAdminSetupLoading(false);
      return;
    }
    
    if (adminPassword.length < 6) {
      setAdminSetupError('Hasło musi mieć co najmniej 6 znaków');
      setIsAdminSetupLoading(false);
      return;
    }
    
    try {
      console.log("Tworzenie konta administratora:", { name: adminName, email: adminEmail });
      
      const response = await fetch('/api/auth/setup-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword
        }),
      });
      
      const responseText = await response.text();
      console.log("Status odpowiedzi:", response.status);
      console.log("Odpowiedź serwera:", responseText);
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error("JSON parse error:", parseError, "Response was:", responseText);
        throw new Error('Nieprawidłowa odpowiedź serwera. Spróbuj ponownie później.');
      }
      
      if (!response.ok) {
        console.error("Server error response:", data);
        throw new Error(data.message || 'Błąd podczas tworzenia konta administratora');
      }
      
      // Automatycznie zaloguj na utworzone konto
      console.log("Konto administratora utworzone, próba logowania...");
      await login(adminEmail, adminPassword);
      
      setLocation('/');
      
      toast({
        title: "Konto administratora utworzone",
        description: "Twoje konto administratora zostało utworzone pomyślnie. Witamy w systemie Bel-Pol.",
      });
    } catch (err: any) {
      console.error('Admin setup error:', err);
      setAdminSetupError(err.message || 'Błąd podczas tworzenia konta administratora. Spróbuj ponownie.');
    } finally {
      setIsAdminSetupLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 px-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="space-y-1 text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-800 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              BP
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Bel-Pol</CardTitle>
          <CardDescription className="text-lg">
            System zarządzania zleceniami
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="flex justify-center space-x-6 mb-6 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Store size={24} className="text-blue-800" />
              </div>
              <span className="text-sm">Santocka 39</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Store size={24} className="text-blue-800" />
              </div>
              <span className="text-sm">Struga 31A</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Building2 size={24} className="text-blue-800" />
              </div>
              <span className="text-sm">Montaż</span>
            </div>
          </div>
          
          {showAdminSetup ? (
            // Formularz konfiguracji administratora
            <div>
              <h3 className="font-medium text-lg mb-4">Konfiguracja konta administratora</h3>
              <form onSubmit={handleAdminSetup} className="space-y-4">
                {adminSetupError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
                    {adminSetupError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-name">
                    Imię i nazwisko
                  </label>
                  <Input 
                    id="admin-name"
                    type="text" 
                    placeholder="Jan Kowalski" 
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)} 
                    disabled={isAdminSetupLoading}
                    className="py-5"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-email">
                    Email
                  </label>
                  <Input 
                    id="admin-email"
                    type="email" 
                    placeholder="admin@belpol.pl" 
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)} 
                    disabled={isAdminSetupLoading}
                    className="py-5"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="admin-password">
                    Hasło
                  </label>
                  <Input 
                    id="admin-password"
                    type="password" 
                    placeholder="••••••••" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)} 
                    disabled={isAdminSetupLoading}
                    className="py-5"
                  />
                </div>
                
                <div className="flex space-x-2 pt-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    className="flex-1" 
                    onClick={() => setShowAdminSetup(false)}
                    disabled={isAdminSetupLoading}
                  >
                    Powrót
                  </Button>
                  
                  <Button 
                    type="submit" 
                    className="flex-1 bg-blue-700 hover:bg-blue-800" 
                    disabled={isAdminSetupLoading}
                  >
                    {isAdminSetupLoading ? (
                      <div className="flex items-center">
                        <div className="w-4 h-4 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                        Tworzenie...
                      </div>
                    ) : "Utwórz administratora"}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            // Standardowy formularz logowania
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="twoj@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)} 
                  disabled={isLoading}
                  className="py-5"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Hasło
                </label>
                <Input 
                  id="password"
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)} 
                  disabled={isLoading}
                  className="py-5"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full py-5 text-base bg-blue-700 hover:bg-blue-800" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin mr-2"></div>
                    Logowanie...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <LockKeyhole className="h-5 w-5 mr-2" />
                    Zaloguj się
                  </div>
                )}
              </Button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdminSetup(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  Pierwsze uruchomienie? Kliknij, aby skonfigurować konto administratora
                </button>
              </div>
            </form>
          )}
        </CardContent>
        
        <CardFooter className="border-t pt-4">
          <p className="text-xs text-center w-full text-gray-500">
            Dostęp do systemu możliwy tylko dla uprawnionych użytkowników Bel-Pol.<br/>
            Skontaktuj się z administratorem w sprawie dostępu.<br/>
            <span className="mt-2 inline-block">Wersja aplikacji: 2.1.003</span>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
