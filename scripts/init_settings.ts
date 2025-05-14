import { db } from "../server/db";
import { settings } from "../shared/schema";

// Inicjalizacja ustawień SMTP i innych podstawowych wartości
async function initializeSettings() {
  console.log("Inicjalizacja ustawień systemowych...");

  try {
    // Ustawienia powiadomień email
    await db.insert(settings).values({
      category: "notifications",
      key: "smtp_host",
      value: "mail.ligazzpn.pl",
      description: "Host serwera SMTP"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "mail.ligazzpn.pl" }
    });

    await db.insert(settings).values({
      category: "notifications",
      key: "smtp_port",
      value: "465",
      description: "Port serwera SMTP"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "465" }
    });

    await db.insert(settings).values({
      category: "notifications",
      key: "smtp_user",
      value: "info-belpol@ligazzpn.pl",
      description: "Użytkownik SMTP"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "info-belpol@ligazzpn.pl" }
    });

    await db.insert(settings).values({
      category: "notifications",
      key: "smtp_pass",
      value: "E8R6YBdAJj5qjH",
      description: "Hasło SMTP"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "E8R6YBdAJj5qjH" }
    });

    await db.insert(settings).values({
      category: "notifications",
      key: "email_from",
      value: "info-belpol@ligazzpn.pl",
      description: "Adres nadawcy email"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "info-belpol@ligazzpn.pl" }
    });

    await db.insert(settings).values({
      category: "notifications",
      key: "smtp_secure",
      value: "true",
      description: "Czy używać bezpiecznego połączenia SSL/TLS"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "true" }
    });

    // Podstawowe ustawienia firmy
    await db.insert(settings).values({
      category: "company",
      key: "company_name",
      value: "Bel-Pol",
      description: "Nazwa firmy"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "Bel-Pol" }
    });

    // Ustawienia zleceń
    await db.insert(settings).values({
      category: "order",
      key: "order_number_prefix",
      value: "ZM/",
      description: "Prefiks numeru zlecenia"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "ZM/" }
    });

    await db.insert(settings).values({
      category: "order",
      key: "default_order_status",
      value: "złożone",
      description: "Domyślny status zlecenia"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "złożone" }
    });

    // Ustawienia powiadomień
    await db.insert(settings).values({
      category: "notifications",
      key: "notify_new_order",
      value: "true",
      description: "Czy wysyłać powiadomienia o nowych zleceniach"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "true" }
    });

    await db.insert(settings).values({
      category: "notifications",
      key: "notify_status_change",
      value: "true",
      description: "Czy wysyłać powiadomienia o zmianach statusu zlecenia"
    }).onConflictDoUpdate({
      target: [settings.key],
      set: { value: "true" }
    });

    console.log("Ustawienia zostały zainicjalizowane pomyślnie!");
  } catch (error) {
    console.error("Błąd podczas inicjalizacji ustawień:", error);
  }
}

// Uruchomienie skryptu
initializeSettings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Błąd podczas wykonywania skryptu:", error);
    process.exit(1);
  });