import { useState } from 'react';
import { useUserFilters } from '@/hooks/useUserFilters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Bookmark, BookmarkCheck, Save, Trash2, Check, ChevronDown, 
  Star, Settings, PlusCircle, AlertCircle 
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Typ dla aktywnego filtra (zgodny z interfejsem z Orders.tsx)
export interface ActiveFilter {
  id: string;
  type: 'status' | 'transportStatus' | 'installationDate' | 'transportDate' | 'dateRange' | 'serviceType' | 'settlement' | 'transport' | 'store';
  label: string;
  value: string | { from?: Date, to?: Date } | boolean | number;
}

interface SavedFiltersProps {
  activeFilters: ActiveFilter[];
  onApplyFilter: (filters: ActiveFilter[]) => void;
  className?: string;
}

export function SavedFilters({ activeFilters, onApplyFilter, className = '' }: SavedFiltersProps) {
  const { toast } = useToast();
  const { 
    userFilters, 
    defaultFilter,
    saveFilter, 
    updateFilter, 
    deleteFilter, 
    setDefaultFilter,
    isSaving,
    isUpdating,
    isDeleting,
    isSettingDefault
  } = useUserFilters();
  
  const [isNewFilterDialogOpen, setIsNewFilterDialogOpen] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [shouldSetDefaultFilter, setShouldSetDefaultFilter] = useState(false);
  const [filterToDelete, setFilterToDelete] = useState<number | null>(null);
  const [isLoadingFilter, setIsLoadingFilter] = useState(false);
  
  // Zapisywanie obecnego zestawu filtrów
  const handleSaveFilter = () => {
    if (!newFilterName.trim()) {
      toast({
        title: "Błąd",
        description: "Nazwa filtru jest wymagana",
        variant: "destructive"
      });
      return;
    }
    
    // Przygotuj filtry do zapisania
    saveFilter({
      name: newFilterName,
      filtersData: activeFilters,
      isDefault: shouldSetDefaultFilter
    });
    
    // Zresetuj formularz i zamknij dialog
    setNewFilterName('');
    setShouldSetDefaultFilter(false);
    setIsNewFilterDialogOpen(false);
  };
  
  // Aktualizacja istniejącego filtru
  const handleUpdateFilter = (filterId: number) => {
    updateFilter({
      id: filterId,
      data: {
        filtersData: activeFilters
      }
    });
  };
  
  // Ładowanie zapisanego filtru
  const handleLoadFilter = (filterId: number) => {
    const filter = userFilters.find(f => f.id === filterId);
    if (filter && filter.filtersData) {
      setIsLoadingFilter(true);
      // Zastosuj zapisany filtr
      onApplyFilter(filter.filtersData);
      setIsLoadingFilter(false);
      
      toast({
        title: "Sukces",
        description: `Wczytano filtr "${filter.name}"`
      });
    }
  };
  
  // Ustawienie filtru jako domyślnego
  const handleSetDefaultFilter = (filterId: number) => {
    setDefaultFilter(filterId);
  };
  
  // Usuwanie filtru
  const handleDeleteFilter = () => {
    if (filterToDelete !== null) {
      deleteFilter(filterToDelete);
      setFilterToDelete(null);
    }
  };
  
  // Sprawdzenie czy są zapisane filtry
  const hasSavedFilters = userFilters.length > 0;
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Dropdown menu z zapisanymi filtrami */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1 whitespace-nowrap"
            disabled={!hasSavedFilters}
          >
            <Bookmark className="h-4 w-4" />
            Zapisane filtry
            <ChevronDown className="h-3 w-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Zapisane filtry</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {userFilters.length === 0 ? (
            <div className="px-2 py-3 text-sm text-center text-muted-foreground">
              <AlertCircle className="h-4 w-4 mx-auto mb-1" />
              Brak zapisanych filtrów
            </div>
          ) : (
            userFilters.map(filter => (
              <div key={filter.id} className="relative">
                <DropdownMenuItem 
                  onClick={() => handleLoadFilter(filter.id)}
                  className="flex items-center justify-between cursor-pointer py-2"
                >
                  <div className="flex items-center gap-2">
                    {filter.isDefault ? (
                      <BookmarkCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                    <span>{filter.name}</span>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-44">
                      <DropdownMenuItem onClick={() => handleUpdateFilter(filter.id)}>
                        <Save className="h-4 w-4 mr-2" />
                        Aktualizuj filtrem bieżącym
                      </DropdownMenuItem>
                      
                      {!filter.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefaultFilter(filter.id)}>
                          <Star className="h-4 w-4 mr-2" />
                          Ustaw jako domyślny
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        onClick={() => setFilterToDelete(filter.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Usuń filtr
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </DropdownMenuItem>
                
                {filter.isDefault && (
                  <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
                    <span className="text-xs text-primary-foreground bg-primary px-1.5 py-0.5 rounded-sm">
                      Domyślny
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsNewFilterDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Zapisz bieżący filtr
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Przycisk zapisywania nowego filtru */}
      <Dialog open={isNewFilterDialogOpen} onOpenChange={setIsNewFilterDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className="flex items-center gap-1"
            disabled={activeFilters.length === 0}
          >
            <Save className="h-4 w-4" />
            Zapisz filtr
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zapisz bieżący filtr</DialogTitle>
            <DialogDescription>
              Zapisane filtry będą dostępne na liście zapisanych filtrów.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="filter-name" className="text-sm font-medium">
                Nazwa filtru
              </label>
              <Input 
                id="filter-name" 
                placeholder="Nazwa filtru" 
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="set-as-default" 
                checked={shouldSetDefaultFilter}
                onCheckedChange={(checked) => setShouldSetDefaultFilter(checked === true)}
              />
              <label htmlFor="set-as-default" className="text-sm font-medium">
                Ustaw jako filtr domyślny
              </label>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setNewFilterName('');
                setShouldSetDefaultFilter(false);
                setIsNewFilterDialogOpen(false);
              }}
            >
              Anuluj
            </Button>
            <Button 
              type="submit"
              onClick={handleSaveFilter}
              disabled={isSaving || !newFilterName.trim() || activeFilters.length === 0}
            >
              {isSaving ? (
                <>Zapisywanie...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Zapisz filtr
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog 
        open={filterToDelete !== null} 
        onOpenChange={(open) => !open && setFilterToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten filtr? Ta operacja jest nieodwracalna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFilter} className="bg-destructive text-destructive-foreground">
              {isDeleting ? 'Usuwanie...' : 'Usuń filtr'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}