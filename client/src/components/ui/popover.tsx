import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

// Używamy oryginalnego komponentu
const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  // Kluczowa funkcja, która będzie nasłuchiwać kliknięć globalnie
  React.useEffect(() => {
    // Funkcja dla globalnego nasłuchiwacza kliknięć
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Jeśli kliknięto element kalendarza z klasą .rdp-day
      if (target.classList && 
         (target.classList.contains('rdp-day') || 
          target.closest('.rdp-day_selected') || 
          target.closest('.rdp-day'))) {
        
        // Dajemy czas na aktualizację stanu
        setTimeout(() => {
          // Ukrywamy wszystkie otwarte popovery zawierające kalendarz
          document.querySelectorAll('[data-radix-popover-content]').forEach(element => {
            if (element.querySelector('.rdp')) {
              // Symulujemy kliknięcie poza popoverem, aby go zamknąć
              document.body.click();
            }
          });
        }, 100);
      }
    };
    
    // Dodajemy nasłuchiwacz na poziomie dokumentu
    document.addEventListener('click', handleDocumentClick, true);
    
    // Cleaning up
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);
  
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
