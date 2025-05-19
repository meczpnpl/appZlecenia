import { Router } from 'express';
import { version } from '@shared/config';
import fs from 'fs';
import path from 'path';

export const versionRouter = Router();

// Przechowuje unikalny identyfikator wersji serwera (zmienia się przy każdym restarcie)
const SERVER_INSTANCE_ID = Date.now().toString();

// Endpoint API dla wersji aplikacji - dostępny publicznie
versionRouter.get('/', (req, res) => {
  try {
    // Pobranie aktualnej wersji z service-worker.js
    let serviceWorkerVersion = '';
    try {
      const serviceWorkerPath = path.resolve(process.cwd(), 'public', 'service-worker.js');
      const serviceWorkerContent = fs.readFileSync(serviceWorkerPath, 'utf8');
      const match = serviceWorkerContent.match(/const APP_VERSION = ['"](.+?)['"]/);
      if (match && match[1]) {
        serviceWorkerVersion = match[1];
      }
    } catch (err) {
      console.error('Błąd odczytu wersji z service-worker.js:', err);
    }
    
    res.json({
      version: version.toString(),
      major: version.major,
      minor: version.minor,
      patch: version.patch,
      serviceWorkerVersion: serviceWorkerVersion,
      serverInstanceId: SERVER_INSTANCE_ID,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ message: 'Nie udało się pobrać informacji o wersji' });
  }
});