import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ActiveFilter } from './FilterButtons';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';

interface SaveFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeFilters: ActiveFilter[];
  onFilterSaved: () => void;
}

const SaveFilterDialog: React.FC<SaveFilterDialogProps> = ({
  open,
  onOpenChange,
  activeFilters,
  onFilterSaved
}) => {
  const [filterName, setFilterName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast({
        title: "Błąd",
        description: "Nazwa filtru jest wymagana",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    console.log(`Rozpoczęcie zapisywania filtru "${filterName}" (domyślny: ${isDefault})`);

    try {
      // Jeśli użytkownik jest zalogowany, zapisujemy tylko w bazie danych
      if (user) {
        try {
          console.log('Sprawdzam istniejące filtry użytkownika przed zapisaniem nowego');
          const response = await fetch('/api/filters');
          
          if (response.ok) {
            const existingFilters = await response.json();
            console.log('Istniejące filtry użytkownika:', existingFilters);
            
            // Jeśli zaznaczono "domyślny", znajdź i wyłącz wszystkie inne domyślne filtry
            if (isDefault) {
              console.log('Wyszukiwanie domyślnych filtrów do wyłączenia');
              const defaultFilters = existingFilters.filter((f: any) => f.isDefault);
              
              for (const defaultFilter of defaultFilters) {
                console.log(`Wyłączanie domyślnego filtru ID ${defaultFilter.id}`);
                await apiRequest('PUT', `/api/filters/${defaultFilter.id}`, {
                  name: defaultFilter.name,
                  isDefault: false,
                  filtersData: defaultFilter.filtersData
                });
              }
            }
          }

          // Teraz możemy bezpiecznie utworzyć nowy filtr
          console.log('Tworzenie nowego filtru w bazie danych');
          await apiRequest('POST', '/api/user/filters', {
            name: filterName,
            isDefault,
            filtersData: activeFilters
          });
          
          console.log("Filtr pomyślnie zapisany w bazie danych");
          
          // Synchronizuj lokalne storage z tym co jest w bazie
          const filterStorage = await import('@/utils/filterStorage');
          
          // Dodaj nowy filtr tylko lokalnie dla szybszego dostępu (bez flagi domyślny)
          // będzie to sync z bazą danych 
          filterStorage.addNamedFilter(filterName, activeFilters, false);
          
          toast({
            title: "Sukces",
            description: "Filtr został pomyślnie zapisany",
          });
        } catch (err) {
          console.error("Błąd zapisywania w bazie:", err);
          toast({
            title: "Błąd",
            description: "Nie udało się zapisać filtru w bazie danych",
            variant: "destructive"
          });
          return; // przerwij operację w przypadku błędu z bazą danych
        }
      } else {
        // Jeśli użytkownik nie jest zalogowany, zapisujemy tylko lokalnie
        console.log('Użytkownik nie jest zalogowany, zapisuję filtr tylko lokalnie');
        const filterStorage = await import('@/utils/filterStorage');
        filterStorage.addNamedFilter(filterName, activeFilters, isDefault);
        
        toast({
          title: "Sukces",
          description: "Filtr został pomyślnie zapisany lokalnie",
        });
      }
      
      // Zresetuj formularz i zamknij dialog
      setFilterName('');
      setIsDefault(false);
      onOpenChange(false);
      onFilterSaved();
    } catch (error) {
      console.error('Error saving filter:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać filtru. Spróbuj ponownie.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Zapisz filtr</DialogTitle>
          <DialogDescription>
            Zapisz bieżący zestaw filtrów do ponownego użycia
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="filterName" className="text-right">
              Nazwa
            </Label>
            <Input
              id="filterName"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="col-span-3"
              placeholder="Mój filtr"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="isDefault" className="text-right">
              Domyślny
            </Label>
            <div className="flex items-center col-span-3">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="mr-2"
              />
              <Label htmlFor="isDefault">Ustaw jako domyślny filtr</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSaveFilter}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Zapisywanie..." : "Zapisz filtr"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveFilterDialog;