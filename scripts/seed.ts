import { db } from "../server/db";
import { users, companies } from "../shared/schema";

async function main() {
  try {
    console.log("Rozpoczynam wstawianie danych przykładowych...");

    // Wstaw administratora
    await db.insert(users).values({
      email: "admin@belpol.pl",
      password: "$2b$10$.YnmekKulfAk1eM8Qs5dQOS0Zml/Iprbwp5FbQ65n2o4Lbiw5t9o6", // admin123
      name: "Administrator",
      role: "admin",
      phone: "500600700",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Utworzono użytkownika administratora");

    // Wstaw firmy montażowe
    await db.insert(companies).values({
      name: "Drzwi-Mont s.c.",
      nip: "9511230498",
      address: "ul. Rzemieślnicza 14, 70-893 Szczecin",
      contactName: "Jan Nowak",
      email: "biuro@drzwi-mont.pl",
      phone: "500123456",
      services: ["Montaż drzwi", "Transport"],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.insert(companies).values({
      name: "Podłogi Expert",
      nip: "8881234567",
      address: "ul. Parkowa 22, 70-100 Szczecin",
      contactName: "Adam Kowalski",
      email: "podlogi@expert.pl",
      phone: "500234567",
      services: ["Montaż podłogi"],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.insert(companies).values({
      name: "TransExpress",
      nip: "7771234568",
      address: "ul. Transportowa 8, 70-200 Szczecin",
      contactName: "Maria Wiśniewska",
      email: "transport@express.pl",
      phone: "500345678",
      services: ["Transport"],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("Utworzono firmy montażowe");

    // Tutaj możesz dodać więcej danych
    
    console.log("Wszystkie dane zostały pomyślnie wstawione!");
  } catch (error) {
    console.error("Błąd podczas wstawiania danych:", error);
  } finally {
    // Koniec
    console.log("Zakończono operację");
  }
}

main();