import React from 'react';
import { MapPin, Navigation, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface ClickableAddressProps {
  address: string;
  className?: string;
  iconSize?: number;
  withIcon?: boolean;
  withTooltip?: boolean;
}

const ClickableAddress: React.FC<ClickableAddressProps> = ({
  address,
  className = '',
  iconSize = 16,
  withIcon = true,
  withTooltip = true,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  
  if (!address || address.trim() === '') {
    return <span className={className}>Brak adresu</span>;
  }

  const handleOpenNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Koduj adres do URL
    const encodedAddress = encodeURIComponent(address);
    
    // Otwórz Google Maps z nawigacją
    const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    window.open(mapUrl, '_blank');
    
    toast({
      title: "Otwarto nawigację",
      description: "Google Maps zostało otwarte w nowej karcie"
    });
  };

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    navigator.clipboard.writeText(address)
      .then(() => {
        setCopied(true);
        toast({
          title: "Skopiowano adres",
          description: address
        });
        
        // Po 2 sekundach zresetuj stan kopiowania
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Błąd podczas kopiowania adresu', err);
        toast({
          title: "Błąd kopiowania",
          description: "Nie można skopiować adresu do schowka",
          variant: "destructive"
        });
      });
  };

  const renderAddress = () => (
    <span className={`flex items-center gap-1 ${className}`}>
      {withIcon && <MapPin size={iconSize} className="text-blue-600" />}
      <span 
        className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline"
        onClick={handleOpenNavigation}
      >
        {address}
      </span>
    </span>
  );

  if (withTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {renderAddress()}
          </TooltipTrigger>
          <TooltipContent>
            <p>Kliknij adres, aby otworzyć w Google Maps</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return renderAddress();
};

export default ClickableAddress;