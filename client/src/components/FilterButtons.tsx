import React from 'react';
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Filter, Download } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, 
  DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, 
  DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
// Definiujemy potrzebny typ lokalnie
export interface ActiveFilter {
  id: string;
  type: 'status' | 'transportStatus' | 'installationDate' | 'transportDate' | 'dateRange' | 'serviceType' | 'settlement' | 'transport' | 'store';
  label: string;
  value: string | { from?: Date, to?: Date } | boolean | number;
}

interface FilterButtonsProps {
  activeFilters: ActiveFilter[];
  onOpenAdvancedFilter: () => void;
  onSaveFilter: () => void;
  onOpenSavedFilters: () => void;
  isMobile?: boolean;
}

const FilterButtons: React.FC<FilterButtonsProps> = ({
  activeFilters,
  onOpenAdvancedFilter,
  onSaveFilter,
  onOpenSavedFilters,
  isMobile = false
}) => {
  // Dostosowanie wyglądu przycisków w zależności od urządzenia

  return (
    <div className="flex items-center gap-2">
      {/* Przycisk filtrowania - responsywny */}
      <Button 
        variant="outline" 
        size="sm"
        className={isMobile ? "flex items-center" : "hidden md:flex items-center"}
        onClick={onOpenAdvancedFilter}
      >
        <SlidersHorizontal className="h-4 w-4 mr-2" />
        Filtruj
      </Button>
      
      {/* Przycisk zapisywania filtrów - tylko jeśli są aktywne filtry */}
      {activeFilters.length > 0 && (
        <Button 
          variant="outline" 
          size="sm"
          className={isMobile ? "flex items-center" : "hidden md:flex items-center"}
          onClick={onSaveFilter}
        >
          <Download className="h-4 w-4 mr-2" />
          {isMobile ? "Zapisz" : "Zapisz filtry"}
        </Button>
      )}
      
      {/* Przycisk wczytywania zapisanych filtrów */}
      <Button 
        variant="outline" 
        size="sm"
        className={isMobile ? "flex items-center" : "hidden md:flex items-center"}
        onClick={onOpenSavedFilters}
      >
        <Filter className="h-4 w-4 mr-2" />
        {isMobile ? "Filtry" : "Moje filtry"}
      </Button>
    </div>
  );
};

export default FilterButtons;