/**
 * Konfiguracja globalna aplikacji
 */

export const version = {
  major: 2,
  minor: 1,
  patch: 21, // Zgodnie z obecną wersją 2.1.003
  toString() {
    return `v.${this.major}.${this.minor}.${String(this.patch).padStart(3, '0')}`;
  }
};

export default {
  version,
  // Można dodać inne globalne ustawienia aplikacji
};