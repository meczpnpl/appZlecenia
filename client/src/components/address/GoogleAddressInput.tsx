import React, { useState, useEffect, useRef, useId } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Check, MapPinOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    google: any;
    initGoogleAddressAutocomplete: (inputId: string, options?: any) => any;
  }
}

interface GoogleAddressInputProps {
  value: string | undefined | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Pole do wprowadzania adresu z podpowiedziami Google Maps
 */
function GoogleAddressInput({
  value,
  onChange,
  placeholder = 'Wpisz adres...',
  className = '',
  disabled = false,
  required = false,
}: GoogleAddressInputProps) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState(value || '');
  const [addressSelected, setAddressSelected] = useState(false);
  const [lastAttemptId, setLastAttemptId] = useState<string>('');
  const [autocompleteLoaded, setAutocompleteLoaded] = useState(false);
  
  // Unikalny identyfikator dla inputu
  const uniqueId = useId().replace(/:/g, '-');
  const inputId = `address-input-${uniqueId}`;
  
  // Referencja do obiektu autocomplete
  const autocompleteRef = useRef<any>(null);

  // Aktualizacja wartości, gdy zewnętrzna wartość się zmienia
  useEffect(() => {
    if (value !== undefined && value !== null) {
      console.log("GoogleAddressInput: Aktualizacja wartości pola na:", value);
      setInputValue(value);
      if (value) {
        setAddressSelected(true);
      }
    }
  }, [value]);

  // Nasłuchiwanie na zdarzenie wybrania adresu z wyszukiwarki Google
  useEffect(() => {
    const handlePlaceSelected = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      // Sprawdź, czy zdarzenie dotyczy tego pola
      if (customEvent.detail && customEvent.detail.inputId === inputId) {
        const place = customEvent.detail.place;
        
        console.log("Odebrano zdarzenie dla tego inputa:", place);
        
        if (place && place.formatted_address) {
          setInputValue(place.formatted_address);
          onChange(place.formatted_address);
          setAddressSelected(true);
          
          toast({
            title: "Adres wybrany",
            description: place.formatted_address
          });
        }
      }
    };
    
    // Dodaj nasłuchiwanie na zdarzenie globalne
    document.addEventListener('autocomplete_place_selected', handlePlaceSelected);
    
    return () => {
      // Usuń nasłuchiwanie przy odmontowaniu
      document.removeEventListener('autocomplete_place_selected', handlePlaceSelected);
    };
  }, [inputId, onChange, toast]);

  // Inicjalizacja Google Maps Autocomplete
  useEffect(() => {
    // Nie inicjalizuj ponownie jeśli już istnieje lub był próba z tym samym ID
    if (autocompleteRef.current || lastAttemptId === inputId) return;
    
    setLastAttemptId(inputId);
    
    // Czekamy aż globalny Google API będzie dostępny
    const checkGoogleApiAndInitialize = () => {
      if (window.google && window.google.maps && window.initGoogleAddressAutocomplete) {
        console.log("Inicjalizacja autocomplete w komponencie dla ID:", inputId);
        
        // inicjalizuj autocomplete z globalnej funkcji
        const autocomplete = window.initGoogleAddressAutocomplete(inputId);
        
        if (autocomplete) {
          autocompleteRef.current = autocomplete;
          setAutocompleteLoaded(true);
          console.log("Autocomplete zainicjalizowane pomyślnie w komponencie");
        } else {
          console.error("Nie udało się zainicjalizować autocomplete w komponencie");
        }
      } else {
        // Jeśli API Google nie jest jeszcze dostępne, spróbuj ponownie za chwilę
        setTimeout(checkGoogleApiAndInitialize, 500);
      }
    };
    
    // Rozpocznij sprawdzanie dostępności API
    checkGoogleApiAndInitialize();
    
  }, [inputId, lastAttemptId]);

  // Obsługa zmiany wartości w polu
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    
    // Jeśli użytkownik edytuje pole, to uznajemy że adres nie jest już "wybrany"
    if (addressSelected) {
      setAddressSelected(false);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <MapPin size={18} className="absolute left-3 text-gray-400 z-10" />
        <Input
          id={inputId}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          className={`pl-10 ${addressSelected ? 'border-green-500 focus-visible:ring-green-500' : ''} ${className}`}
          disabled={disabled}
          required={required}
          autoComplete="off"
        />
        {addressSelected && (
          <div className="absolute right-3 flex items-center text-green-500">
            <Check size={18} />
          </div>
        )}
      </div>
      
      {/* Debug info - tylko w trybie developerskim - usuń później */}
      <div className="text-xs text-gray-400 mt-1 hidden">
        ID: {inputId}
        {autocompleteLoaded ? " (Autocomplete załadowane)" : " (Autocomplete nie załadowane)"}
      </div>
    </div>
  );
}

export default GoogleAddressInput;