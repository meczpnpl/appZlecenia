import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from '@/components/ui/back-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building, Store, MapPin, Phone, Link as LinkIcon, Link2Off } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";

// Interfejs dla danych sklepu
interface Store {
  id: number;
  name: string;
  address: string;
  phone: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export default function CompanyStores() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [associatedStores, setAssociatedStores] = useState<number[]>([]);
  const [location] = useLocation();
  
  // Pobieramy ID firmy z parametrów URL, jeśli istnieje
  const urlParams = new URLSearchParams(window.location.search);
  const urlCompanyId = urlParams.get('id');
  
  // Jeśli mamy ID firmy z URL, używamy go, w przeciwnym razie używamy ID z kontekstu użytkownika
  const companyId = urlCompanyId ? parseInt(urlCompanyId) : user?.companyId || user?.id;
  
  console.log("Komponent CompanyStores zainicjalizowany z companyId =", companyId);
  
  // Pobieranie danych firmy
  const { 
    data: company, 
    isLoading: isLoadingCompany 
  } = useQuery({
    queryKey: ["/api/companies", companyId],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!companyId
  });

  // Pobieranie wszystkich sklepów
  const { 
    data: stores = [], 
    isLoading: isLoadingStores 
  } = useQuery<Store[]>({
    queryKey: ["/api/stores"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user && user.role === "admin"
  });

  // Pobieranie sklepów przypisanych do firmy
  const {
    data: companyStores = [],
    isLoading: isLoadingCompanyStores,
    refetch: refetchCompanyStores
  } = useQuery<Store[]>({
    queryKey: ["/api/companies", companyId, "stores"],
    queryFn: async ({ queryKey }) => {
      console.log("Wykonuję zapytanie o sklepy przypisane do firmy:", queryKey);
      const endpoint = `/api/companies/${companyId}/stores`;
      console.log("Endpoint:", endpoint);
      try {
        const response = await fetch(endpoint);
        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Otrzymane dane sklepów przypisanych do firmy:", data);
        return data;
      } catch (error) {
        console.error("Błąd podczas pobierania sklepów firmy:", error);
        throw error;
      }
    },
    enabled: !!companyId
  });

  // Po załadowaniu sklepów firmy, ustaw ich ID w state
  useEffect(() => {
    console.log("useEffect [companyStores] wywołany");
    console.log("companyStores:", companyStores);
    
    if (companyStores && companyStores.length > 0) {
      const storeIds = companyStores.map(store => store.id);
      console.log("Ustawiam associatedStores na:", storeIds);
      setAssociatedStores(storeIds);
    } else {
      console.log("companyStores jest puste, associatedStores pozostaje bez zmian:", associatedStores);
    }
  }, [companyStores]);

  // Filtrowanie sklepów
  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.phone.includes(searchTerm)
  );

  // Mutacja do przypisania sklepu do firmy
  const linkStoreMutation = useMutation({
    mutationFn: async (storeId: number) => {
      console.log(`Próba przypisania sklepu o ID ${storeId} do firmy o ID ${companyId}`);
      try {
        const response = await apiRequest(
          "POST", 
          `/api/companies/${companyId}/stores/${storeId}`
        );
        console.log("Odpowiedź serwera:", response.status);
        const data = await response.json();
        console.log("Dane odpowiedzi:", data);
        return data;
      } catch (error) {
        console.error("Błąd podczas przypisywania sklepu:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Przypisanie powiodło się:", data);
      // Odświeżenie listy sklepów przypisanych do firmy
      refetchCompanyStores();
      toast({
        title: "Sukces",
        description: "Sklep został przypisany do firmy",
      });
    },
    onError: (error: Error) => {
      console.error("Błąd podczas przypisywania sklepu:", error);
      toast({
        title: "Błąd",
        description: `Nie udało się przypisać sklepu: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutacja do odłączenia sklepu od firmy
  const unlinkStoreMutation = useMutation({
    mutationFn: async (storeId: number) => {
      console.log(`Próba odłączenia sklepu o ID ${storeId} od firmy o ID ${companyId}`);
      try {
        const response = await apiRequest(
          "DELETE", 
          `/api/companies/${companyId}/stores/${storeId}`
        );
        console.log("Odpowiedź serwera (DELETE):", response.status);
        const data = await response.json();
        console.log("Dane odpowiedzi (DELETE):", data);
        return data;
      } catch (error) {
        console.error("Błąd podczas odłączania sklepu:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Odłączenie powiodło się:", data);
      // Odświeżenie listy sklepów przypisanych do firmy
      refetchCompanyStores();
      toast({
        title: "Sukces",
        description: "Sklep został odłączony od firmy",
      });
    },
    onError: (error: Error) => {
      console.error("Błąd podczas odłączania sklepu:", error);
      toast({
        title: "Błąd",
        description: `Nie udało się odłączyć sklepu: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Funkcja do obsługi przełączania powiązania sklep-firma
  const handleToggleStoreLink = (storeId: number, isLinked: boolean) => {
    console.log(`handleToggleStoreLink wywołane z: storeId=${storeId}, isLinked=${isLinked}`);
    console.log("associatedStores:", associatedStores);
    
    if (isLinked) {
      console.log(`Próba odłączenia sklepu ${storeId}...`);
      unlinkStoreMutation.mutate(storeId);
    } else {
      console.log(`Próba przypisania sklepu ${storeId}...`);
      linkStoreMutation.mutate(storeId);
    }
  };

  // Sprawdzanie, czy sklep jest już przypisany do firmy
  const isStoreLinked = (storeId: number): boolean => {
    const result = associatedStores.includes(storeId);
    console.log(`isStoreLinked(${storeId}) = ${result}`);
    return result;
  };

  return (
    <div className="pb-16 md:pb-0">
      <BackButton fallbackPath="/companies" className="mb-4" />
      <Card className="w-full">
        <CardHeader className="bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-semibold flex items-center">
                <Building className="mr-2 h-5 w-5" />
                {company?.name ? `Sklepy obsługiwane przez ${company.name}` : 'Sklepy obsługiwane przez firmę'}
              </CardTitle>
              <CardDescription>
                Zarządzaj sklepami, które obsługuje firma montażowa
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Szukaj sklepu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {isLoadingStores || isLoadingCompanyStores ? (
            <div className="py-10 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-4">Ładowanie sklepów...</p>
            </div>
          ) : user?.role !== "admin" ? (
            // Dla użytkowników niebędących administratorami - pokazujemy tylko przypisane sklepy
            <div>
              <h3 className="text-lg font-medium mb-4">Sklepy obsługiwane przez Twoją firmę</h3>
              {companyStores.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-gray-500">Twoja firma nie ma jeszcze przypisanych sklepów.</p>
                  <p className="text-sm text-gray-400 mt-2">Skontaktuj się z administratorem, aby przypisać sklepy.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nazwa sklepu</TableHead>
                        <TableHead>Adres</TableHead>
                        <TableHead>Telefon</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyStores.map((store) => (
                        <TableRow key={store.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              <Store className="mr-2 h-4 w-4 text-primary" />
                              {store.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <MapPin className="mr-2 h-4 w-4 text-gray-500" />
                              {store.address}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Phone className="mr-2 h-4 w-4 text-gray-500" />
                              {store.phone}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            // Dla administratorów - możliwość przypisywania sklepów do firmy
            <div>
              <h3 className="text-lg font-medium mb-4">Wszystkie sklepy</h3>
              {filteredStores.length === 0 ? (
                <div className="py-10 text-center">
                  {searchTerm ? (
                    <p className="text-gray-500">Nie znaleziono sklepów spełniających kryteria.</p>
                  ) : (
                    <p className="text-gray-500">Nie ma jeszcze żadnych sklepów w systemie.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nazwa sklepu</TableHead>
                        <TableHead>Adres</TableHead>
                        <TableHead>Telefon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStores.map((store) => {
                        const linked = isStoreLinked(store.id);
                        return (
                          <TableRow key={store.id} className={store.status === "inactive" ? "opacity-60" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                <Store className="mr-2 h-4 w-4 text-primary" />
                                {store.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <MapPin className="mr-2 h-4 w-4 text-gray-500" />
                                {store.address}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Phone className="mr-2 h-4 w-4 text-gray-500" />
                                {store.phone}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={store.status === "active" ? "success" : "secondary"}>
                                {store.status === "active" ? "Aktywny" : "Nieaktywny"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant={linked ? "destructive" : "outline"} 
                                size="sm"
                                onClick={() => handleToggleStoreLink(store.id, linked)}
                                disabled={linkStoreMutation.isPending || unlinkStoreMutation.isPending}
                              >
                                {linked ? (
                                  <>
                                    <Link2Off className="mr-2 h-4 w-4" />
                                    Odłącz
                                  </>
                                ) : (
                                  <>
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Przypisz
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}