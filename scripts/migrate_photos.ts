// Skrypt do migracji zdjęć z base64 w bazie danych do plików fizycznych
// Wymaga Node.js i dostępu do bazy danych

import { db } from '../server/db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Upewnij się, że katalog uploads istnieje
if (!fs.existsSync(UPLOADS_DIR)) {
  console.log(`Tworzenie katalogu uploads: ${UPLOADS_DIR}`);
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function migratePhotos() {
  try {
    console.log('Pobieranie zdjęć z bazy danych...');
    const allPhotos = await db.select().from(photos);
    
    console.log(`Znaleziono ${allPhotos.length} zdjęć do migracji`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const photo of allPhotos) {
      try {
        // @ts-ignore - ignorujemy błąd TS, ponieważ wiemy, że kolumna data istnieje w bazie
        if (!photo.data) {
          console.log(`Zdjęcie ID=${photo.id} nie ma danych base64, pomijam`);
          continue;
        }
        
        // Dekoduj dane base64 do bufora
        console.log(`Dekodowanie danych base64 dla zdjęcia ID=${photo.id}`);
        // @ts-ignore - ignorujemy błąd TS
        const matches = photo.data.match(/^data:(.+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
          console.log(`Nieprawidłowy format base64 dla zdjęcia ID=${photo.id}, pomijam`);
          continue;
        }
        
        const mimetype = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generuj unikalną nazwę pliku z zachowaniem oryginalnego rozszerzenia
        const ext = path.extname(photo.filename);
        const uniqueFilename = `${uuidv4()}${ext}`;
        const filePath = path.join(UPLOADS_DIR, uniqueFilename);
        
        console.log(`Zapisywanie pliku: ${filePath}`);
        fs.writeFileSync(filePath, buffer);
        
        // Aktualizuj rekord w bazie danych
        console.log(`Aktualizacja rekordu w bazie danych dla zdjęcia ID=${photo.id}`);
        await db.update(photos)
          .set({
            filename: uniqueFilename,
            filePath: filePath,
            fileSize: buffer.length,
            // Zachowaj oryginalne dane
            // @ts-ignore - ignorujemy błąd TS
            data: null // Opcjonalnie usuń dane base64, aby zmniejszyć rozmiar bazy danych
          })
          .where(eq(photos.id, photo.id));
        
        successCount++;
        console.log(`Pomyślnie zmigrowano zdjęcie ID=${photo.id}`);
        
      } catch (photoError) {
        errorCount++;
        console.error(`Błąd podczas migracji zdjęcia ID=${photo.id}:`, photoError);
      }
    }
    
    console.log(`Migracja zakończona. Pomyślnie zmigrowano ${successCount} zdjęć, błędy: ${errorCount}`);
    
  } catch (error) {
    console.error('Błąd podczas migracji zdjęć:', error);
  }
}

// Uruchom migrację
migratePhotos().then(() => {
  console.log('Skrypt migracji zakończony');
  process.exit(0);
}).catch((error) => {
  console.error('Nieoczekiwany błąd:', error);
  process.exit(1);
});