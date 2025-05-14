import { useState, useEffect, useRef } from 'react';
import { startSpeechRecognition } from '@/utils/speech';
import { Loader2, Mic, MicOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SpeechRecognitionDialogProps {
  onClose: () => void;
  onTextRecognized: (text: string) => void;
  initialText?: string;
}

export function SpeechRecognitionDialog({
  onClose,
  onTextRecognized,
  initialText = ''
}: SpeechRecognitionDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);

  // Inicjalizacja silnika rozpoznawania mowy po załadowaniu komponentu, 
  // ale nie rozpoczynanie nagrywania automatycznie
  useEffect(() => {
    // Focus na textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    
    // Inicjalizuj ale nie uruchamiaj automatycznie nagrywania
    initSpeechRecognition();
    
    // Czyszczenie przy odmontowaniu
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const initSpeechRecognition = () => {
    setError(null);
    
    try {
      recognitionRef.current = startSpeechRecognition(
        // Po rozpoznaniu tekstu (pełne zdanie)
        (newText) => {
          // Całkowicie zastępujemy poprzedni tekst - koniec z dopisywaniem
          setText(newText);
        },
        // Obsługa błędu
        (errorMessage) => {
          setError(errorMessage);
          setIsRecording(false);
        },
        // Po zakończeniu
        () => {
          setIsRecording(false);
        },
        // Nie uruchamiaj automatycznie
        false
      );
    } catch (error) {
      console.error('Speech recognition initialization error:', error);
      setError('Nie udało się zainicjalizować rozpoznawania mowy');
    }
  };
  
  const startRecording = () => {
    setIsRecording(true);
    setError(null);
    
    if (!recognitionRef.current) {
      initSpeechRecognition();
    }
    
    // Uruchom nagrywanie w odpowiedzi na interakcję użytkownika
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError('Nie można uruchomić rozpoznawania mowy. Spróbuj ponownie.');
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Dodajmy przycisk resetowania, który czyści tekst całkowicie
      startRecording();
    }
  };
  
  // Funkcja resetowania tekstu
  const resetText = () => {
    setText('');
  };

  const handleConfirm = () => {
    onTextRecognized(text);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Dyktowanie opisu reklamacji</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4 flex-1 overflow-auto">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
              {error}
            </div>
          )}
          
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[200px] p-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Zacznij mówić lub wpisz tekst ręcznie..."
          />
          
          <div className="flex justify-center mt-6">
            <Button 
              onClick={toggleRecording}
              variant={isRecording ? "destructive" : "default"}
              size="lg"
              className="rounded-full w-24 h-24 shadow-lg flex items-center justify-center"
            >
              {isRecording ? (
                <MicOff className="h-10 w-10" />
              ) : (
                <Mic className="h-10 w-10" />
              )}
            </Button>
          </div>
          
          <div className="text-center mt-4">
            {isRecording ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center text-red-500 text-lg font-medium">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Nagrywanie...
                </div>
                <p className="text-gray-600 mt-2">
                  Mów teraz. Kliknij ponownie, aby zatrzymać.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <p className="text-gray-700 font-medium text-lg">
                  {error ? 'Spróbuj ponownie...' : (text ? "Nagrywanie zatrzymane" : "Gotowy do nagrywania")}
                </p>
                <p className="text-gray-600 mt-1">
                  Kliknij duży przycisk mikrofonu, aby {text ? "wznowić" : "rozpocząć"} nagrywanie
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="border-t p-4 flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              size="lg"
              className="flex-1 sm:flex-initial"
            >
              Anuluj
            </Button>
            
            <Button 
              variant="secondary"
              onClick={resetText} 
              size="lg"
              className="flex-1 sm:flex-initial"
              disabled={!text.trim()}
            >
              Wyczyść
            </Button>
          </div>
          
          <Button 
            onClick={handleConfirm} 
            size="lg"
            className="flex-1 sm:flex-initial"
            disabled={!text.trim()}
          >
            Zatwierdź tekst
          </Button>
        </div>
      </div>
    </div>
  );
}