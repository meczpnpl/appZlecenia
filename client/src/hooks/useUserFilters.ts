import { useQuery, useMutation, UseQueryOptions } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Definiujemy interfejs dla zapisanego filtra użytkownika
export interface UserFilter {
  id: number;
  name: string;
  isDefault: boolean;
  filtersData: any; // JSON z ustawieniami filtrów
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// Hook do zarządzania zapisanymi filtrami użytkownika
export function useUserFilters() {
  const { toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState<UserFilter | null>(null);
  
  // Pobieranie wszystkich filtrów użytkownika
  const { 
    data: userFilters = [] as UserFilter[], 
    isLoading,
    error,
    refetch
  } = useQuery<UserFilter[], Error>({
    queryKey: ['/api/filters'],
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minut
  });

  // Pobieranie domyślnego filtra użytkownika
  const { 
    data: defaultFilter,
    isLoading: isDefaultFilterLoading
  } = useQuery<UserFilter, Error>({
    queryKey: ['/api/filters/default'],
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minut
    enabled: userFilters.length > 0,
  });

  // Zapisywanie nowego filtra
  const saveFilterMutation = useMutation({
    mutationFn: (newFilter: { name: string, filtersData: any, isDefault: boolean }) => 
      apiRequest('POST', '/api/filters', newFilter),
    onSuccess: () => {
      toast({
        title: 'Sukces',
        description: 'Filtr został zapisany'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/filters'] });
    },
    onError: () => {
      toast({
        title: 'Błąd',
        description: 'Nie udało się zapisać filtra',
        variant: 'destructive'
      });
    }
  });

  // Aktualizacja istniejącego filtra
  const updateFilterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<UserFilter> }) => 
      apiRequest('PUT', `/api/filters/${id}`, data),
    onSuccess: () => {
      toast({
        title: 'Sukces',
        description: 'Filtr został zaktualizowany'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/filters'] });
    },
    onError: () => {
      toast({
        title: 'Błąd',
        description: 'Nie udało się zaktualizować filtra',
        variant: 'destructive'
      });
    }
  });

  // Ustawienie filtra jako domyślnego
  const setDefaultFilterMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('POST', `/api/filters/${id}/default`),
    onSuccess: () => {
      toast({
        title: 'Sukces',
        description: 'Filtr został ustawiony jako domyślny'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/filters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/filters/default'] });
    },
    onError: () => {
      toast({
        title: 'Błąd',
        description: 'Nie udało się ustawić filtra jako domyślnego',
        variant: 'destructive'
      });
    }
  });

  // Usuwanie filtra
  const deleteFilterMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/filters/${id}`),
    onSuccess: () => {
      toast({
        title: 'Sukces',
        description: 'Filtr został usunięty'
      });
      setSelectedFilter(null);
      queryClient.invalidateQueries({ queryKey: ['/api/filters'] });
      queryClient.invalidateQueries({ queryKey: ['/api/filters/default'] });
    },
    onError: () => {
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć filtra',
        variant: 'destructive'
      });
    }
  });

  return {
    userFilters,
    defaultFilter,
    selectedFilter,
    setSelectedFilter,
    isLoading,
    isDefaultFilterLoading,
    error,
    refetch,
    saveFilter: saveFilterMutation.mutate,
    updateFilter: updateFilterMutation.mutate,
    setDefaultFilter: setDefaultFilterMutation.mutate,
    deleteFilter: deleteFilterMutation.mutate,
    isSaving: saveFilterMutation.isPending,
    isUpdating: updateFilterMutation.isPending,
    isSettingDefault: setDefaultFilterMutation.isPending,
    isDeleting: deleteFilterMutation.isPending
  };
}