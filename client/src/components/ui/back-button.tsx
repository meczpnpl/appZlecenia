import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
  label?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Przycisk powrotu, który wykorzystuje historię przeglądarki do nawigacji wstecz.
 * Jeśli nie ma poprzedniej strony, przekieruje na fallbackPath (domyślnie '/').
 */
export function BackButton({
  fallbackPath = '/',
  className = '',
  label = 'Powrót',
  variant = 'ghost',
  size = 'sm'
}: BackButtonProps) {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    // Jeśli jest historia, cofnij się
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // W przeciwnym razie przekieruj na stronę główną lub inną podaną
      setLocation(fallbackPath);
    }
  };

  return (
    <Button
      onClick={handleBack}
      variant={variant}
      size={size}
      className={`flex items-center ${className}`}
    >
      <ArrowLeft className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );
}