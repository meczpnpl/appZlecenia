// Interfejs dla funkcji przetwarzania rozpoznanego tekstu
export type SpeechRecognitionCallback = (text: string) => void;

// Sprawdza czy przeglądarka obsługuje Web Speech API
export function isSpeechRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

// Rozpoczyna słuchanie i rozpoznawanie mowy
export function startSpeechRecognition(
  onRecognize: SpeechRecognitionCallback,
  onError?: (error: string) => void,
  onEnd?: () => void,
  autoStart: boolean = false
): { 
  stop: () => void;
  start: () => void;
} {
  // Sprawdzenie czy przeglądarka obsługuje Web Speech API
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError('Twoja przeglądarka nie obsługuje rozpoznawania mowy');
    return { 
      stop: () => {},
      start: () => {}
    };
  }

  try {
    // Inicjalizacja obiektu rozpoznawania mowy
    // @ts-ignore - ignorujemy błąd TypeScript ponieważ jest to API specyficzne dla przeglądarki
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Konfiguracja rozpoznawania mowy
    recognition.lang = 'pl-PL';
    recognition.interimResults = true; // Zmiana na true, aby otrzymywać tymczasowe wyniki
    recognition.continuous = true; // Tryb ciągły dla lepszej obsługi na mobilnych
    
    // Zdarzenie rozpoznania
    // Całkowicie przeprojektowany handler rezultatów rozpoznawania
    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      
      // Interesuje nas tylko ostateczny, finalny wynik
      if (event.results[lastResultIndex].isFinal) {
        // Pobieramy czysty transkrypt z ostatniego wyniku
        const transcript = event.results[lastResultIndex][0].transcript.trim();
        
        // Upewniamy się, że mamy sensowny tekst do przekazania
        if (transcript && onRecognize) {
          // Przekazujemy tylko czysty, finalny tekst bez duplikacji
          onRecognize(transcript);
        }
      }
    };
    
    // Zdarzenie błędu
    recognition.onerror = (event: any) => {
      console.log('Speech recognition error:', event.error);
      if (onError) onError(event.error || 'Błąd rozpoznawania mowy');
    };
    
    // Zdarzenie zakończenia
    recognition.onend = () => {
      if (onEnd) onEnd();
    };
    
    // Funkcja start, którą można wywołać na żądanie (np. po kliknięciu przycisku)
    const startRecognition = () => {
      try {
        // Po prostu uruchamiamy nowe rozpoznawanie - każde wywołanie onresult
        // będzie teraz zwracać niezależny, finalny tekst
        recognition.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);
        if (onError) onError('Nie można uruchomić rozpoznawania mowy. Spróbuj ponownie.');
      }
    };
    
    // Rozpocznij nasłuchiwanie jeśli ustawiono autoStart na true
    if (autoStart) {
      startRecognition();
    }
    
    // Zwróć funkcje do kontroli rozpoznawania
    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (e) {
          console.error('Error stopping speech recognition:', e);
        }
      },
      start: startRecognition
    };
  } catch (error) {
    console.error('Speech recognition initialization error:', error);
    if (onError) onError('Wystąpił błąd podczas inicjalizacji rozpoznawania mowy');
    return { 
      stop: () => {},
      start: () => {}
    };
  }
}