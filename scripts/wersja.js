#!/usr/bin/env node

/**
 * Prosty skrypt do aktualizacji wersji aplikacji
 * Użycie:
 * - node scripts/wersja.js patch  - zwiększa wersję patch (2.0.1 -> 2.0.2)
 * - node scripts/wersja.js minor  - zwiększa wersję minor (2.0.1 -> 2.1.0)
 * - node scripts/wersja.js major  - zwiększa wersję major (2.0.1 -> 3.0.0)
 * - node scripts/wersja.js set X.Y.Z  - ustawia konkretną wersję
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ustaw ścieżki
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../shared/config.ts');

try {
  // Odczytaj plik konfiguracyjny
  const configContent = fs.readFileSync(configPath, 'utf8');

  // Wyodrębnij aktualne wartości za pomocą wyrażeń regularnych
  const majorRegex = /major:\s*(\d+)/;
  const minorRegex = /minor:\s*(\d+)/;
  const patchRegex = /patch:\s*(\d+)/;

  const majorMatch = configContent.match(majorRegex);
  const minorMatch = configContent.match(minorRegex);
  const patchMatch = configContent.match(patchRegex);

  if (!majorMatch || !minorMatch || !patchMatch) {
    console.error('Nie można znaleźć wartości wersji w pliku konfiguracyjnym');
    process.exit(1);
  }

  // Pobierz aktualne wartości
  let major = parseInt(majorMatch[1]);
  let minor = parseInt(minorMatch[1]);
  let patch = parseInt(patchMatch[1]);

  // Pobierz argument z linii komend
  const args = process.argv.slice(2);
  const command = args[0] || 'patch';
  const value = args[1];

  // Aktualizuj wersję
  switch (command) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
    case 'set':
      if (!value) {
        console.error('Brak wartości dla komendy "set". Użyj: node wersja.js set X.Y.Z');
        process.exit(1);
      }
      
      const parts = value.split('.');
      if (parts.length !== 3) {
        console.error('Niewłaściwy format wersji. Użyj formatu X.Y.Z');
        process.exit(1);
      }
      
      major = parseInt(parts[0]);
      minor = parseInt(parts[1]);
      patch = parseInt(parts[2]);
      
      if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
        console.error('Niewłaściwy format wersji. Wszystkie części muszą być liczbami');
        process.exit(1);
      }
      break;
    default:
      console.error('Nieznana komenda. Użyj: major, minor, patch lub set');
      process.exit(1);
  }

  // Zastąp wartości w pliku konfiguracyjnym
  const updatedContent = configContent
    .replace(majorRegex, `major: ${major}`)
    .replace(minorRegex, `minor: ${minor}`)
    .replace(patchRegex, `patch: ${patch}`);

  // Zapisz zaktualizowany plik
  fs.writeFileSync(configPath, updatedContent);
  
  // Przygotuj nową wersję w formacie string
  const newVersion = `v.${major}.${minor}.${String(patch).padStart(3, '0')}`;
  
  // Funkcja do aktualizacji wersji w plikach HTML
  function updateVersionInHtmlFiles() {
    try {
      // Aktualizacja dla login.html
      const loginPath = path.resolve(__dirname, '../client/public/login.html');
      if (fs.existsSync(loginPath)) {
        let loginContent = fs.readFileSync(loginPath, 'utf8');
        loginContent = loginContent.replace(
          /&copy; \d{4} Zlecenia v\.\d+\.\d+\.\d+ - System zarządzania zleceniami/g,
          `&copy; 2025 Zlecenia ${newVersion} - System zarządzania zleceniami`
        );
        fs.writeFileSync(loginPath, loginContent);
        console.log(`\x1b[32mZaktualizowano wersję w login.html\x1b[0m`);
      }
      
      // Aktualizacja dla dashboard.html
      const dashboardPath = path.resolve(__dirname, '../server/static/dashboard.html');
      if (fs.existsSync(dashboardPath)) {
        let dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
        dashboardContent = dashboardContent.replace(
          /&copy; \d{4} Zlecenia v\.\d+\.\d+\.\d+ - System zarządzania zleceniami/g,
          `&copy; 2025 Zlecenia ${newVersion} - System zarządzania zleceniami`
        );
        fs.writeFileSync(dashboardPath, dashboardContent);
        console.log(`\x1b[32mZaktualizowano wersję w dashboard.html\x1b[0m`);
      }
    } catch (err) {
      console.error(`\x1b[31mBłąd podczas aktualizacji wersji w plikach HTML: ${err.message}\x1b[0m`);
    }
  }
  
  // Wywołaj funkcję aktualizacji
  updateVersionInHtmlFiles();

  // Wyświetl informację o nowej wersji
  console.log(`\x1b[32mWersja zaktualizowana do: ${newVersion}\x1b[0m`);

} catch (error) {
  console.error(`\x1b[31mBłąd: ${error.message}\x1b[0m`);
  process.exit(1);
}