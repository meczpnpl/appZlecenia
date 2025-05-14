import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Upewnij się, że katalog uploads istnieje
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
console.log("Ścieżka katalogu uploads:", uploadDir);

if (!fs.existsSync(uploadDir)) {
  console.log("Tworzenie katalogu uploads:", uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
}
console.log("Katalog uploads istnieje:", fs.existsSync(uploadDir));

// Konfiguracja storage dla multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Generuj unikalną nazwę pliku używając uuid + oryginalnego rozszerzenia
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Filtr - tylko obrazy
const fileFilter = function(req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Konfiguracja multer
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // limit 10MB
  }
});