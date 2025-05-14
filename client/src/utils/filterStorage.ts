import { ActiveFilter } from "@/components/FilterButtons";

// Klucz do przechowywania filtrów w localStorage
const FILTERS_STORAGE_KEY = 'belpol_active_filters';

/**
 * Zapisuje aktywne filtry do localStorage
 */
export function saveFiltersToLocalStorage(filters: ActiveFilter[]) {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    return true;
  } catch (error) {
    console.error('Error saving filters to localStorage:', error);
    return false;
  }
}

/**
 * Wczytuje aktywne filtry z localStorage
 */
export function loadFiltersFromLocalStorage(): ActiveFilter[] | null {
  try {
    const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!savedFilters) return null;
    
    return JSON.parse(savedFilters);
  } catch (error) {
    console.error('Error loading filters from localStorage:', error);
    return null;
  }
}

/**
 * Zapisuje nazwane filtry do localStorage
 */
export function saveNamedFiltersToLocalStorage(
  namedFilters: { id: number, name: string, filtersData: ActiveFilter[], isDefault: boolean }[]
) {
  try {
    localStorage.setItem('belpol_named_filters', JSON.stringify(namedFilters));
    return true;
  } catch (error) {
    console.error('Error saving named filters to localStorage:', error);
    return false;
  }
}

/**
 * Wczytuje nazwane filtry z localStorage
 */
export function loadNamedFiltersFromLocalStorage() {
  try {
    const savedFilters = localStorage.getItem('belpol_named_filters');
    if (!savedFilters) return [];
    
    return JSON.parse(savedFilters);
  } catch (error) {
    console.error('Error loading named filters from localStorage:', error);
    return [];
  }
}

/**
 * Dodaje nowy nazwany filtr do localStorage
 */
export function addNamedFilter(name: string, filtersData: ActiveFilter[], isDefault: boolean = false) {
  const currentFilters = loadNamedFiltersFromLocalStorage();
  
  // Generuj prosty unikalny ID bazujący na czasie
  const id = Date.now();
  
  // Jeśli filtr ma być domyślny, usuń flagę isDefault z innych filtrów
  const updatedFilters = isDefault 
    ? currentFilters.map((filter: { id: number, name: string, filtersData: ActiveFilter[], isDefault: boolean }) => ({ 
        ...filter, 
        isDefault: false 
      }))
    : [...currentFilters];
  
  // Dodaj nowy filtr
  updatedFilters.push({ id, name, filtersData, isDefault });
  
  // Zapisz zaktualizowaną listę
  return saveNamedFiltersToLocalStorage(updatedFilters);
}

/**
 * Ustawia filtr jako domyślny
 */
export function setDefaultFilter(id: number) {
  const currentFilters = loadNamedFiltersFromLocalStorage();
  
  // Usuń flagę isDefault ze wszystkich filtrów i ustaw ją tylko dla wybranego
  const updatedFilters = currentFilters.map((filter: { id: number, name: string, filtersData: ActiveFilter[], isDefault: boolean }) => ({
    ...filter,
    isDefault: filter.id === id
  }));
  
  // Zapisz zaktualizowaną listę
  return saveNamedFiltersToLocalStorage(updatedFilters);
}

/**
 * Usuwa filtr o podanym ID
 */
export function deleteNamedFilter(id: number) {
  const currentFilters = loadNamedFiltersFromLocalStorage();
  
  // Usuń filtr o podanym ID
  const updatedFilters = currentFilters.filter(filter => filter.id !== id);
  
  // Zapisz zaktualizowaną listę
  return saveNamedFiltersToLocalStorage(updatedFilters);
}

/**
 * Pobiera domyślny filtr
 */
export function getDefaultFilter() {
  const currentFilters = loadNamedFiltersFromLocalStorage();
  return currentFilters.find(filter => filter.isDefault);
}