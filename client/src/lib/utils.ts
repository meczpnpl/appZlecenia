import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatuje datę na format polski
 * @param dateString - string daty lub obiekt Date do sformatowania
 * @returns sformatowany string daty w formacie polskim
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('pl-PL');
  } catch (error) {
    console.error("Błąd formatowania daty:", error);
    return "N/A";
  }
}

/**
 * Formatuje wartość pieniężną na format polski
 * @param amount - kwota do sformatowania
 * @returns sformatowany string kwoty w formacie polskim
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "0,00 zł";
  
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Dodaje określoną liczbę dni do daty
 * @param date - data początkowa
 * @param days - liczba dni do dodania
 * @returns nowa data po dodaniu dni
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Zwraca początek dnia dla podanej daty
 * @param date - data wejściowa
 * @returns data reprezentująca początek dnia (00:00:00)
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Zwraca koniec dnia dla podanej daty
 * @param date - data wejściowa
 * @returns data reprezentująca koniec dnia (23:59:59)
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Sprawdza czy dwie daty reprezentują ten sam dzień
 * @param dateA - pierwsza data
 * @param dateB - druga data
 * @returns true jeśli daty są w tym samym dniu
 */
export function isSameDay(dateA: Date, dateB: Date): boolean {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

/**
 * Sprawdza czy data znajduje się w podanym przedziale
 * @param date - data do sprawdzenia
 * @param interval - przedział czasowy {start, end}
 * @returns true jeśli data znajduje się w przedziale
 */
export function isWithinInterval(date: Date, interval: { start: Date; end: Date }): boolean {
  return date >= interval.start && date <= interval.end;
}
