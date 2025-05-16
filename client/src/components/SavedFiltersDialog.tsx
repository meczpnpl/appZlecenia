import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Trash2, ArrowRight } from 'lucide-react';
import { ActiveFilter } from './FilterButtons';
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';

interface UserFilter {
  id: number;
  name: string;
  filtersData: ActiveFilter[];
  isDefault: boolean;
}

interface SavedFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilter: (filters: ActiveFilter[]) => void;
}

const SavedFiltersDialog: React.FC<SavedFiltersDialogProps> = ({
  open,
  onOpenChange,
  onApplyFilter
}) => {
  const [savedFilters, setSavedFilters] = useState<UserFilter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [isSettingDefault, setIsSettingDefault] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFilters = async () => {
    setIsLoading(true);
    try {
      // Pobierz z bazy danych jeśli użytkownik jest zalogowany
      if (user) {
        try {
          const response = await apiRequest('GET', '/api/filters');
          const data = await response.json();
          setSavedFilters(data);
          return;
        } catch (err) {
          console.error('Error fetching filters from API:', err);
          // W przypadku błędu pobierz lokalnie
        }
      }
      
      // Pobierz z localStorage jeśli brak użytkownika lub wystąpił błąd API
      const filterStorage = await import('@/utils/filterStorage');
      const localFilters = filterStorage.loadNamedFiltersFromLocalStorage();
      setSavedFilters(localFilters);
    } catch (error) {
      console.error('Error fetching filters:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać zapisanych filtrów",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFilters();
    }
  }, [open, user]);

  const handleApplyFilter = (filter: UserFilter) => {
    // Konwertujemy daty w filtrach
    const parsedFilters = filter.filtersData.map((filterItem: ActiveFilter) => {
      if (filterItem.type === 'dateRange' && typeof filterItem.value === 'object') {
        return {
          ...filterItem,
          value: {
            from: filterItem.value.from ? new Date(filterItem.value.from) : undefined,
            to: filterItem.value.to ? new Date(filterItem.value.to) : undefined
          }
        };
      }
      return filterItem;
    });
    
    // Zapisujemy do localStorage jako aktywne filtry
    localStorage.setItem('orderFilters', JSON.stringify(parsedFilters));
    
    // Aplikujemy filtr do interfejsu
    onApplyFilter(parsedFilters);
    onOpenChange(false);
    
    toast({
      title: "Filtr zastosowany",
      description: `Zastosowano filtr: ${filter.name}`
    });
  };

  const handleDeleteFilter = async (id: number) => {
    setIsDeleting(id);
    try {
      // Próba usunięcia z bazy danych jeśli użytkownik jest zalogowany
      if (user) {
        try {
          const response = await apiRequest('DELETE', `/api/user/filters/${id}`);
          const result = await response.json();
          
          // Jeśli usunięty filtr był domyślny, czyścimy także localStorage
          if (result.wasDefault) {
            localStorage.removeItem('orderFilters');
            console.log('Usunięto domyślny filtr - wyczyszczono localStorage');
          }
        } catch (err) {
          console.error('Error deleting filter from API:', err);
          // Kontynuujemy, aby usunąć lokalnie nawet jeśli nie udało się usunąć z bazy
        }
      }

      // Zawsze usuwamy lokalnie
      const filterStorage = await import('@/utils/filterStorage');
      filterStorage.deleteNamedFilter(id);
      
      // Odśwież listę filtrów
      fetchFilters();
      
      toast({
        title: "Sukces",
        description: "Filtr został usunięty"
      });
    } catch (error) {
      console.error('Error deleting filter:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć filtru",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSetDefaultFilter = async (id: number) => {
    setIsSettingDefault(id);
    try {
      // Próba aktualizacji w bazie danych jeśli użytkownik jest zalogowany
      if (user) {
        try {
          await apiRequest('POST', `/api/user/filters/${id}/set-default`);
        } catch (err) {
          console.error('Error setting default filter in API:', err);
          // Kontynuujemy, aby ustawić lokalnie nawet jeśli nie udało się w bazie
        }
      }

      // Zawsze ustawiamy lokalnie
      const filterStorage = await import('@/utils/filterStorage');
      filterStorage.setDefaultFilter(id);
      
      // Znajdujemy filtr i ustawiamy go również jako aktywny
      const namedFilters = filterStorage.loadNamedFiltersFromLocalStorage();
      const defaultFilter = namedFilters.find((filter: any) => filter.id === id);
      
      if (defaultFilter && defaultFilter.filtersData) {
        // Konwertujemy daty w filtrach na obiekty Date
        const parsedFilters = defaultFilter.filtersData.map((filter: ActiveFilter) => {
          if (filter.type === 'dateRange' && typeof filter.value === 'object') {
            return {
              ...filter,
              value: {
                from: filter.value.from ? new Date(filter.value.from) : undefined,
                to: filter.value.to ? new Date(filter.value.to) : undefined
              }
            };
          }
          return filter;
        });
        
        // Zapisujemy do localStorage jako aktywne filtry
        localStorage.setItem('orderFilters', JSON.stringify(parsedFilters));
      }
      
      // Odśwież listę filtrów
      fetchFilters();
      
      toast({
        title: "Sukces",
        description: "Filtr został ustawiony jako domyślny"
      });
    } catch (error) {
      console.error('Error setting default filter:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się ustawić filtru jako domyślnego",
        variant: "destructive"
      });
    } finally {
      setIsSettingDefault(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Zapisane filtry</DialogTitle>
          <DialogDescription>
            Wybierz jeden z zapisanych filtrów
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {isLoading ? (
            <div className="text-center py-4">Ładowanie filtrów...</div>
          ) : savedFilters.length === 0 ? (
            <div className="text-center py-4">Brak zapisanych filtrów</div>
          ) : (
            <div className="space-y-3">
              {savedFilters.map(filter => (
                <Card key={filter.id} className="p-3 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{filter.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {filter.filtersData.length} {filter.filtersData.length === 1 ? 'filtr' : 
                          filter.filtersData.length > 1 && filter.filtersData.length < 5 ? 'filtry' : 'filtrów'}
                      </div>
                      {filter.isDefault && (
                        <div className="text-xs text-green-600 flex items-center mt-1">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Domyślny
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {!filter.isDefault && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefaultFilter(filter.id)}
                          disabled={isSettingDefault === filter.id}
                        >
                          {isSettingDefault === filter.id ? "..." : "Ustaw domyślny"}
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="icon"
                        onClick={() => handleDeleteFilter(filter.id)}
                        disabled={isDeleting === filter.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        onClick={() => handleApplyFilter(filter)}
                      >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Użyj
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SavedFiltersDialog;