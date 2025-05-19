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
    // Dodaj nagłówki zapobiegające cachowaniu
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Version-Timestamp', Date.now().toString());
    
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
    
    // Tworzymy unikalny identyfikator zapytania
    const requestId = Math.random().toString(36).substring(2, 12);
    
    // Czytamy aktualne wartości bezpośrednio z pliku konfiguracyjnego
    let configPath = path.resolve(process.cwd(), 'shared', 'config.ts');
    let configContent = '';
    
    try {
      configContent = fs.readFileSync(configPath, 'utf8');
      
      // Analiza pliku config.ts aby wydobyć aktualne wartości
      const majorMatch = configContent.match(/major:\s*(\d+)/);
      const minorMatch = configContent.match(/minor:\s*(\d+)/);
      const patchMatch = configContent.match(/patch:\s*(\d+)/);
      
      const major = majorMatch ? parseInt(majorMatch[1]) : version.major;
      const minor = minorMatch ? parseInt(minorMatch[1]) : version.minor;
      const patch = patchMatch ? parseInt(patchMatch[1]) : version.patch;
      
      // Ręczne utworzenie wartości toString() zgodne z implementacją w config.ts
      const versionString = `v.${major}.${minor}.${String(patch).padStart(3, '0')}`;
      
      console.log(`Odczytana wersja z pliku config.ts: ${versionString} (${major}.${minor}.${patch})`);
      
      res.json({
        version: versionString,
        major: major,
        minor: minor,
        patch: patch,
        serviceWorkerVersion: serviceWorkerVersion,
        serverInstanceId: SERVER_INSTANCE_ID,
        timestamp: new Date().toISOString(),
        requestId: requestId,
        fromFile: true
      });
    } catch (configError) {
      console.error('Błąd odczytu config.ts:', configError);
      
      // Jeśli nie udało się odczytać z pliku, użyj wartości załadowanej przez import
      res.json({
        version: version.toString(),
        major: version.major,
        minor: version.minor,
        patch: version.patch,
        serviceWorkerVersion: serviceWorkerVersion,
        serverInstanceId: SERVER_INSTANCE_ID,
        timestamp: new Date().toISOString(),
        requestId: requestId,
        fromFile: false
      });
    }
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({ message: 'Nie udało się pobrać informacji o wersji' });
  }
});