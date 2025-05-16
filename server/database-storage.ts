import { users, companies, orders, salesPlans, notifications, subscriptions, photos, stores, settings, companyStores, userFilters } from "@shared/schema";
import type { User, InsertUser, Company, InsertCompany, Order, InsertOrder, SalesPlan, InsertSalesPlan, Notification, InsertNotification, Subscription, InsertSubscription, UpdateOrderStatus, AssignInstaller, AssignTransporter, Photo, InsertPhoto, Store, InsertStore, Setting, InsertSetting, CompanyStore, InsertCompanyStore, UserFilter, InsertUserFilter } from "@shared/schema";
import { db, pool } from "./db";
import { eq, asc, desc, and, like, or, isNull, SQL, sql, ne } from "drizzle-orm";
import fs from 'fs';
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, role));
  }
  
  async getUsers(searchTerm?: string): Promise<User[]> {
    if (searchTerm) {
      const searchLike = `%${searchTerm}%`;
      return await db.select().from(users).where(
        or(
          like(users.name, searchLike),
          like(users.email, searchLike),
          like(users.position || "", searchLike),
          like(users.companyName || "", searchLike)
        )
      );
    }
    return await db.select().from(users);
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set({
        ...userData,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const [deletedUser] = await db.delete(users)
      .where(eq(users.id, id))
      .returning();
    return !!deletedUser;
  }
  
  // Store methods
  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }
  
  async getStores(): Promise<Store[]> {
    console.log("Pobieranie listy sklepów"); 
    const results = await db.select().from(stores);
    console.log(`Znaleziono ${results.length} sklepów`);
    return results;
  }
  
  async createStore(storeData: InsertStore): Promise<Store> {
    const [store] = await db.insert(stores).values({
      ...storeData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return store;
  }
  
  async updateStore(id: number, storeData: Partial<InsertStore>): Promise<Store | undefined> {
    const [updatedStore] = await db.update(stores)
      .set({
        ...storeData,
        updatedAt: new Date()
      })
      .where(eq(stores.id, id))
      .returning();
    return updatedStore;
  }
  
  async deleteStore(id: number): Promise<boolean> {
    // Zamiast rzeczywistego usuwania, oznaczamy sklep jako nieaktywny
    const [deactivatedStore] = await db.update(stores)
      .set({ 
        status: "inactive",
        updatedAt: new Date()
      })
      .where(eq(stores.id, id))
      .returning();
    return !!deactivatedStore;
  }
  
  // Company methods
  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }
  
  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }
  
  async createCompany(companyData: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values({
      ...companyData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return company;
  }
  
  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updatedCompany] = await db.update(companies)
      .set({
        ...companyData,
        updatedAt: new Date()
      })
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany;
  }
  
  async deleteCompany(id: number): Promise<boolean> {
    const [deletedCompany] = await db.delete(companies)
      .where(eq(companies.id, id))
      .returning();
    return !!deletedCompany;
  }
  
  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }
  
  async getOrders(filters?: { 
    search?: string, 
    status?: string, 
    installationStatus?: string, 
    storeId?: number, 
    companyId?: number,
    installerId?: number,
    installerWithCompany?: boolean,
    installationDateFrom?: Date,
    installationDateTo?: Date,
    transportDateFrom?: Date,
    transportDateTo?: Date,
    transportStatus?: string
  }): Promise<Order[]> {
    if (filters?.search && filters.search.trim()) {
      // Wyszukiwanie tekstu
      try {
        // Buduj zapytanie SQL z parametrami
        const searchTerm = `%${filters.search.toLowerCase()}%`;

        // Tworzymy tablicę parametrów, zaczynając od parametru wyszukiwania
        const params = [searchTerm];
        
        // Budujemy zapytanie podstawowe
        let query = `
          SELECT * FROM orders 
          WHERE (LOWER(client_name) LIKE $1 OR 
                 LOWER(order_number) LIKE $1 OR 
                 LOWER(installation_address) LIKE $1 OR 
                 LOWER(client_phone) LIKE $1)
        `;
        
        // Jeśli mamy dodatkowe filtry, dodajemy je do zapytania
        const conditions = [];
        let paramIndex = 2; // Startujemy od drugiego parametru
        
        if (filters.status || filters.installationStatus) {
          conditions.push(`installation_status = $${paramIndex}`);
          params.push(filters.status || filters.installationStatus);
          paramIndex++;
        }
        
        if (filters.storeId) {
          conditions.push(`store_id = $${paramIndex}`);
          params.push(filters.storeId);
          paramIndex++;
        }
        
        if (filters.installerWithCompany && filters.installerId && filters.companyId) {
          conditions.push(`(installer_id = $${paramIndex} OR company_id = $${paramIndex + 1})`);
          params.push(filters.installerId, filters.companyId);
          paramIndex += 2;
        } else {
          if (filters.companyId !== undefined && filters.companyId !== null) {
            conditions.push(`company_id = $${paramIndex}`);
            params.push(filters.companyId);
            paramIndex++;
          }
          
          if (filters.installerId) {
            conditions.push(`installer_id = $${paramIndex}`);
            params.push(filters.installerId);
            paramIndex++;
          }
        }
        
        // Status transportu
        if (filters.transportStatus) {
          conditions.push(`transport_status = $${paramIndex}`);
          params.push(filters.transportStatus);
          paramIndex++;
        }
        
        // Filtrowanie po datach instalacji
        if (filters.installationDateFrom) {
          conditions.push(`installation_date >= $${paramIndex}`);
          params.push(filters.installationDateFrom.toISOString());
          paramIndex++;
        }
        
        if (filters.installationDateTo) {
          conditions.push(`installation_date <= $${paramIndex}`);
          params.push(filters.installationDateTo.toISOString());
          paramIndex++;
        }
        
        // Filtrowanie po datach transportu
        if (filters.transportDateFrom) {
          conditions.push(`transport_date >= $${paramIndex}`);
          params.push(filters.transportDateFrom.toISOString());
          paramIndex++;
        }
        
        if (filters.transportDateTo) {
          conditions.push(`transport_date <= $${paramIndex}`);
          params.push(filters.transportDateTo.toISOString());
          paramIndex++;
        }
        
        // Dodajemy warunki do zapytania głównego
        if (conditions.length > 0) {
          query += ` AND ${conditions.join(' AND ')}`;
        }
        
        // Dodajemy sortowanie
        query += ` ORDER BY created_at DESC`;
        
        console.log("Zapytanie SQL:", query);
        console.log("Parametry:", params);
        
        // Używamy bezpośrednio pool.query zamiast db.execute
        const result = await pool.query(query, params);
        return result.rows as Order[];
      } catch (error) {
        console.error("Błąd podczas wyszukiwania:", error);
        return [];
      }
    } else {
      try {
        // Standardowe zapytanie bez wyszukiwania - również używamy podejścia SQL
        // Parametry zapytania
        const params: any[] = [];
        
        // Budujemy zapytanie
        let query = `SELECT * FROM orders WHERE 1=1`;
        
        // Status
        if (filters?.status || filters?.installationStatus) {
          query += ` AND installation_status = $${params.length + 1}`;
          params.push(filters?.status || filters?.installationStatus);
        }
        
        // Sklep
        if (filters?.storeId) {
          query += ` AND store_id = $${params.length + 1}`;
          params.push(filters.storeId);
        }
        
        // Montażysta-właściciel firmy
        if (filters?.installerWithCompany && filters.installerId && filters.companyId) {
          query += ` AND (installer_id = $${params.length + 1} OR company_id = $${params.length + 2})`;
          params.push(filters.installerId, filters.companyId);
        } else {
          // Firma
          if (filters?.companyId !== undefined && filters.companyId !== null) {
            query += ` AND company_id = $${params.length + 1}`;
            params.push(filters.companyId);
          }
          
          // Montażysta
          if (filters?.installerId) {
            query += ` AND installer_id = $${params.length + 1}`;
            params.push(filters.installerId);
          }
        }
        
        // Status transportu
        if (filters?.transportStatus) {
          query += ` AND transport_status = $${params.length + 1}`;
          params.push(filters.transportStatus);
        }
        
        // Filtrowanie po datach instalacji
        if (filters?.installationDateFrom) {
          query += ` AND installation_date >= $${params.length + 1}`;
          params.push(filters.installationDateFrom.toISOString());
        }
        
        if (filters?.installationDateTo) {
          query += ` AND installation_date <= $${params.length + 1}`;
          params.push(filters.installationDateTo.toISOString());
        }
        
        // Filtrowanie po datach transportu
        if (filters?.transportDateFrom) {
          query += ` AND transport_date >= $${params.length + 1}`;
          params.push(filters.transportDateFrom.toISOString());
        }
        
        if (filters?.transportDateTo) {
          query += ` AND transport_date <= $${params.length + 1}`;
          params.push(filters.transportDateTo.toISOString());
        }
        
        // Sortowanie
        query += ` ORDER BY created_at DESC`;
        
        console.log("Zapytanie SQL (bez wyszukiwania):", query);
        console.log("Parametry:", params);
        
        // Wykonanie zapytania
        const result = await pool.query(query, params);
        return result.rows as Order[];
      } catch (error) {
        console.error("Błąd podczas filtrowania:", error);
        return [];
      }
    }
  }
  
  async getRecentOrders(limit: number = 5): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }
  
  async createOrder(orderData: InsertOrder): Promise<Order> {
    // Używaj orderNumber z danych wejściowych, jeśli istnieje
    const orderNumber = orderData.orderNumber || `ZM/${new Date().getFullYear()}/${Math.floor(Math.random() * 10000)}`;
    
    // Ustaw odpowiednie statusy zgodnie z wymaganiami
    const status = "nowe";
    
    // Jeśli zlecenie ma transport, ustaw status transportu
    const transportStatus = orderData.withTransport ? "gotowe do transportu" : undefined;
    
    // Ustaw status montażu domyślnie jako "nowe" (małe litery)
    const installationStatus = "nowe";
    
    const [order] = await db.insert(orders).values({
      ...orderData,
      orderNumber,
      status,
      transportStatus,
      installationStatus, // Dodajemy domyślny status montażu
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    return order;
  }
  
  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set({
        ...orderData,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }
  
  async updateOrderStatus(id: number, data: UpdateOrderStatus): Promise<Order | undefined> {
    // First get the existing order to access its current notes
    const [existingOrder] = await db.select().from(orders).where(eq(orders.id, id));
    
    if (!existingOrder) {
      return undefined;
    }
    
    let updatedFields: any = {
      updatedAt: new Date()
    };
    
    // Używamy installationStatus jako statusu dla montażu
    if (data.installationStatus) {
      updatedFields.installationStatus = data.installationStatus;
      // Nie aktualizujemy już przestarzałego pola status
    }
    
    // Obsługa nowych pól statusów dla transportu
    if (data.transportStatus) {
      updatedFields.transportStatus = data.transportStatus;
    }
    
    // Nie potrzebujemy tego bloku, ponieważ status montażu jest już ustawiony powyżej
    
    // Obsługa zdjęć reklamacji
    if (data.complaintPhotos) {
      console.log("Aktualizuję zdjęcia reklamacji:", data.complaintPhotos);
      updatedFields.complaintPhotos = data.complaintPhotos;
    }
    
    // Obsługa opisu reklamacji
    if (data.complaintNotes !== undefined) {
      console.log("Aktualizuję opis reklamacji:", data.complaintNotes);
      updatedFields.complaintNotes = data.complaintNotes;
    }
    
    // Obsługa daty montażu
    if (data.installationDate !== undefined) {
      console.log("Aktualizuję datę montażu:", data.installationDate);
      updatedFields.installationDate = data.installationDate;
      
      // Automatycznie zmień status montażu na "zaplanowany", jeśli ustawiona jest data montażu
      // i obecny status to "nowe" lub nie ma żadnego statusu montażu
      if (data.installationDate && 
          (existingOrder.installationStatus === 'nowe' || !existingOrder.installationStatus)) {
        console.log("Automatyczna aktualizacja statusu montażu na 'zaplanowany'");
        updatedFields.installationStatus = 'zaplanowany';
        // Nie aktualizujemy już przestarzałego pola status
      }
    }
    
    // Obsługa pól finansowych
    if (data.willBeSettled !== undefined) {
      updatedFields.willBeSettled = data.willBeSettled;
    }
    
    if (data.invoiceIssued !== undefined) {
      updatedFields.invoiceIssued = data.invoiceIssued;
    }
    
    // Obsługa komentarzy i reklamacji
    if (data.comments) {
      if (data.installationStatus === 'Reklamacja') {
        updatedFields.complaintNotes = data.complaintNotes || data.comments;
      } else {
        updatedFields.notes = existingOrder.notes 
          ? `${existingOrder.notes}\n${data.comments}` 
          : data.comments;
      }
    } else if (data.complaintNotes) {
      updatedFields.complaintNotes = data.complaintNotes;
    }
    
    const [updatedOrder] = await db.update(orders)
      .set(updatedFields)
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }
  
  async assignInstallerToOrder(id: number, data: AssignInstaller): Promise<Order | undefined> {
    const [existingOrder] = await db.select()
      .from(orders)
      .where(eq(orders.id, id));
    
    if (!existingOrder) {
      return undefined;
    }
    
    // Pobierz dane montażysty, aby uzyskać jego nazwę
    const [installer] = await db.select()
      .from(users)
      .where(eq(users.id, data.installerId));
    
    if (!installer) {
      throw new Error("Nie znaleziono montażysty o podanym ID");
    }
    
    // Sprawdź, czy montażysta należy do firmy odpowiedzialnej za to zlecenie
    if (existingOrder.companyId && installer.companyId !== existingOrder.companyId) {
      throw new Error("Montażysta nie należy do firmy przypisanej do tego zlecenia");
    }
    
    // Sprawdzenie, czy montażysta ma odpowiednią specjalizację do typu zlecenia
    if (existingOrder.serviceType && installer.services && Array.isArray(installer.services)) {
      // Mapowanie typu usługi zlecenia na wymaganą specjalizację montażysty
      let requiredSpecialization = '';
      if (existingOrder.serviceType.toLowerCase().includes('drzwi')) {
        requiredSpecialization = 'Montaż drzwi';
      } else if (existingOrder.serviceType.toLowerCase().includes('podłog')) {
        requiredSpecialization = 'Montaż podłogi';
      }
      
      // Sprawdzenie, czy montażysta ma wymaganą specjalizację
      if (requiredSpecialization) {
        const hasRequiredSpecialization = installer.services.some(
          service => service === requiredSpecialization
        );
        
        if (!hasRequiredSpecialization) {
          throw new Error(`Montażysta nie ma wymaganej specjalizacji (${requiredSpecialization}) do tego typu zlecenia (${existingOrder.serviceType})`);
        }
      }
    }
    
    // Ustawiamy tylko status montażu bez statusu ogólnego
    const installationStatus = 'zaplanowany';
    
    const [updatedOrder] = await db.update(orders)
      .set({
        installerId: data.installerId,
        installerName: installer.name,
        installationDate: new Date(data.installationDate),
        installationStatus: installationStatus,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }
  
  async assignTransporterToOrder(id: number, data: AssignTransporter): Promise<Order | undefined> {
    const [existingOrder] = await db.select()
      .from(orders)
      .where(eq(orders.id, id));
    
    if (!existingOrder) {
      return undefined;
    }
    
    // Dodatkowa logika dla firm jednoosobowych
    // Jeśli jest to firma jednoosobowa (zakładamy, że montażysta i transporter to ta sama osoba)
    if (existingOrder.companyId && existingOrder.installerId) {
      const [installer] = await db.select()
        .from(users)
        .where(eq(users.id, existingOrder.installerId));
      
      if (installer && installer.companyId === existingOrder.companyId) {
        console.log(`Sprawdzam czy montażysta ${installer.id} (${installer.name}) jest właścicielem firmy jednoosobowej...`);
        
        // Sprawdź, czy montażysta ma usługę transportu
        const hasTransportService = installer.services && 
          installer.services.some(s => typeof s === 'string' && s.toLowerCase().includes('transport'));
        
        console.log(`Montażysta ${installer.id} ma usługę transportu: ${hasTransportService}`);
        console.log(`Usługi montażysty: ${JSON.stringify(installer.services || [])}`);
        
        if (hasTransportService) {
          console.log(`Automatycznie przypisuję właściciela firmy jednoosobowej ${installer.id} jako transportera`);
          
          // Użyj statusu transportu z przekazanych danych lub domyślnego
          const transportStatus = data.transportStatus || 'zaplanowany';
          console.log(`FIRMA JEDNOOSOBOWA: Ustawianie statusu transportu: ${transportStatus}`);
          
          // Przygotuj pola do aktualizacji
          const updateFields: any = {
            transporterId: installer.id,
            transporterName: installer.name,
            transportStatus: transportStatus,
            // Usuwamy niepotrzebny status ogólny - używamy tylko statusu transportu
            updatedAt: new Date()
          };
          
          // Jeśli nie podano konkretnej daty, ustaw transport dzień przed montażem
          if (!data.transportDate && existingOrder.installationDate) {
            const installDate = new Date(existingOrder.installationDate);
            installDate.setDate(installDate.getDate() - 1);
            updateFields.transportDate = installDate;
            console.log(`Przypisuję automatycznie datę transportu: ${updateFields.transportDate}`);
          } else if (data.transportDate) {
            updateFields.transportDate = new Date(data.transportDate);
          }
          
          // Aktualizuj zlecenie
          const [updatedOrder] = await db.update(orders)
            .set(updateFields)
            .where(eq(orders.id, id))
            .returning();
            
          console.log(`FIRMA JEDNOOSOBOWA: Przypisano montażystę ${installer.id} również jako transportera`);
          return updatedOrder;
        }
      }
    }
    
    // Standardowa logika jeśli nie jest to firma jednoosobowa
    // Pobierz dane transportera, aby uzyskać jego nazwę
    const [transporter] = await db.select()
      .from(users)
      .where(eq(users.id, data.transporterId));
    
    if (!transporter) {
      throw new Error("Nie znaleziono transportera o podanym ID");
    }
    
    // Sprawdź, czy transporter należy do firmy odpowiedzialnej za to zlecenie
    if (existingOrder.companyId && transporter.companyId !== existingOrder.companyId) {
      throw new Error("Transporter nie należy do firmy przypisanej do tego zlecenia");
    }
    
    // Sprawdź, czy transporter ma w usługach "transport" lub "Transport"
    if (!transporter.services) {
      throw new Error("Wybrany montażysta nie ma zdefiniowanych usług");
    }
    
    console.log(`Usługi transportera ${transporter.id} (${transporter.name}):`, transporter.services);
    
    // Dodajmy szczegółowe logowanie dla celów debugowania
    if (transporter.services && Array.isArray(transporter.services)) {
      console.log("Czy services jest tablicą:", Array.isArray(transporter.services));
      console.log("Liczba elementów w services:", transporter.services.length);
      
      for (let i = 0; i < transporter.services.length; i++) {
        const service = transporter.services[i];
        console.log(`Usługa ${i+1}:`, service);
        console.log(`  - typ: ${typeof service}`);
        console.log(`  - zawiera 'transport': ${service.toLowerCase().includes('transport')}`);
        console.log(`  - dokładne dopasowanie 'transport': ${service === 'transport'}`);
        console.log(`  - dokładne dopasowanie 'Transport': ${service === 'Transport'}`);
      }
    }
    
    // Używamy niezależnej od wielkości liter weryfikacji, szukamy usługi zawierającej "transport"
    const hasTransportPermission = transporter.services && transporter.services.some(
      service => typeof service === 'string' && service.toLowerCase().includes('transport')
    );
    
    if (!hasTransportPermission) {
      throw new Error("Wybrany montażysta nie ma uprawnień do wykonywania transportu");
    }
    
    const transportDate = new Date(data.transportDate);
    
    // Sprawdź reguły dla daty transportu
    console.log('Sprawdzanie reguł biznesowych dla transportu:');
    console.log('- Zlecenie ID:', id);
    console.log('- Typ usługi:', existingOrder.serviceType);
    console.log('- Data transportu:', transportDate);
    console.log('- Data montażu:', existingOrder.installationDate);
    
    // Sprawdź, czy typ usługi dotyczy podłogi (niezależnie od wielkości liter)
    const isPodlogaService = existingOrder.serviceType && 
                           existingOrder.serviceType.toLowerCase().includes('podłog');
    
    console.log('- Czy dotyczy podłogi:', isPodlogaService);
    
    if (isPodlogaService && existingOrder.installationDate) {
      const installationDate = new Date(existingOrder.installationDate);
      const minTransportDate = new Date(installationDate);
      minTransportDate.setDate(minTransportDate.getDate() - 2);
      
      console.log('- Data montażu:', installationDate);
      console.log('- Min. data transportu (2 dni przed):', minTransportDate);
      console.log('- Czy transport > montaż:', transportDate > installationDate);
      console.log('- Czy transport w niedozwolonym okresie:', 
                transportDate > minTransportDate && transportDate < installationDate);
      
      if (transportDate > installationDate) {
        throw new Error("Data transportu nie może być późniejsza niż data montażu");
      }
      
      if (transportDate > minTransportDate && transportDate < installationDate) {
        throw new Error("Dla montażu podłogi transport musi być minimum 2 dni przed montażem");
      }
    } else if (existingOrder.installationDate) {
      // Dla drzwi lub innych typów usług
      const installationDate = new Date(existingOrder.installationDate);
      
      console.log('- Data montażu:', installationDate);
      console.log('- Czy transport > montaż:', transportDate > installationDate);
      
      if (transportDate > installationDate) {
        throw new Error("Data transportu nie może być późniejsza niż data montażu");
      }
    }
    
    // Użyj statusu transportu z przekazanych danych lub domyślnego
    const transportStatus = data.transportStatus || 'zaplanowany';
    console.log(`Ustawianie statusu transportu: ${transportStatus}`);
    
    // Przygotuj pola do aktualizacji
    const updateFields: any = {
      transporterId: data.transporterId,
      transporterName: transporter.name,
      transportDate: transportDate,
      transportStatus: transportStatus,
      updatedAt: new Date()
    };
    
    // Usuwamy aktualizację statusu głównego - używamy tylko statusów montażu i transportu
    
    const [updatedOrder] = await db.update(orders)
      .set(updateFields)
      .where(eq(orders.id, id))
      .returning();
    
    return updatedOrder;
  }
  
  async assignCompanyToOrder(id: number, companyId: number): Promise<Order | undefined> {
    console.log(`\n===> PRZYPISYWANIE FIRMY: Zlecenie ${id}, Firma ${companyId} <===`);
    
    const [existingOrder] = await db.select()
      .from(orders)
      .where(eq(orders.id, id));
    
    if (!existingOrder) {
      console.log(`[assignCompanyToOrder] Nie znaleziono zlecenia ${id}`);
      return undefined;
    }
    
    console.log(`[assignCompanyToOrder] Aktualne dane zlecenia:`, {
      id: existingOrder.id,
      serviceType: existingOrder.serviceType,
      withTransport: existingOrder.withTransport,
      transportStatus: existingOrder.transportStatus,
      installerId: existingOrder.installerId,
      transporterId: existingOrder.transporterId
    });
    
    // Pobierz dane firmy, aby uzyskać jej nazwę
    const [company] = await db.select()
      .from(companies)
      .where(eq(companies.id, companyId));
    
    if (!company) {
      throw new Error("Nie znaleziono firmy o podanym ID");
    }
    
    // Przygotuj dane do aktualizacji
    const updateData: any = {
      companyId: companyId,
      companyName: company.name,
      updatedAt: new Date()
    };
    
    // Sprawdź czy to firma jednosobowa - szukamy użytkownika, który jest jednocześnie montażystą i ma przypisaną firmę
    console.log(`[assignCompanyToOrder] Sprawdzam czy firma ${companyId} (${company.name}) jest firmą jednosobową...`);
    
    const onePersonCompanyUsers = await db.select()
      .from(users)
      .where(
        and(
          eq(users.role, 'installer'),
          eq(users.companyId, companyId)
        )
      );
      
    // Sprawdzając firmę jednosobową, interesują nas tylko użytkownicy, którzy mają przypisaną firmę
    // oraz mają rolę 'installer' - to wskazuje, że są właścicielami firmy
    console.log(`[assignCompanyToOrder] Znaleziono ${onePersonCompanyUsers.length} użytkowników z rolą 'installer' przypisanych do firmy ${company.name}`);
    
    // Dla każdego użytkownika, wypisz jego usługi
    if (onePersonCompanyUsers.length > 0) {
      onePersonCompanyUsers.forEach(user => {
        console.log(`- Użytkownik ID=${user.id}, Imię=${user.name}, Usługi=${JSON.stringify(user.services || [])}`);
      });
    }
    
    // Jeśli znaleziono użytkowników z rolą 'installer' przypisanych do tej firmy
    if (onePersonCompanyUsers.length > 0) {
      // Dla uproszczenia - zakładamy, że pierwszy użytkownik to właściciel firmy jednosobowej
      const onePersonUser = onePersonCompanyUsers[0];
      
      console.log(`[assignCompanyToOrder] Znaleziono firmę jednosobową: ${companyId}, właściciel: ${onePersonUser.id} (${onePersonUser.name})`);
      console.log(`[assignCompanyToOrder] Usługi właściciela: ${JSON.stringify(onePersonUser.services || [])}`);
      
      // Sprawdź czy ma usługi montażowe i transportowe
      // Użytkownika traktujemy jako montażystę, jeśli ma jakiekolwiek usługi (oprócz transportu)
      const isInstaller = onePersonUser.services && (
        onePersonUser.services.length > 0 &&
        (onePersonUser.services.length > 1 || !onePersonUser.services.some(s => 
          typeof s === 'string' && s.toLowerCase().includes('transport')))
      );
      
      const isTransporter = onePersonUser.services && 
        onePersonUser.services.some(s => 
          typeof s === 'string' && s.toLowerCase().includes('transport'));
      
      console.log(`[assignCompanyToOrder] Usługi właściciela firmy jednosobowej: montaż=${isInstaller}, transport=${isTransporter}`);
      
      // Automatycznie przypisz użytkownika jako montażystę
      if (isInstaller) {
        console.log(`[assignCompanyToOrder] Automatycznie przypisuję właściciela ${onePersonUser.id} jako montażystę`);
        updateData.installerId = onePersonUser.id;
        updateData.installerName = onePersonUser.name;
        updateData.installationStatus = 'Zaplanowane';
        
        // Jeśli nie ma jeszcze daty montażu, ustaw ją na dwa dni od teraz
        if (!existingOrder.installationDate) {
          const installDate = new Date();
          installDate.setDate(installDate.getDate() + 2);
          updateData.installationDate = installDate;
        }
      }
      
      // Automatycznie przypisz użytkownika jako transportera
      if (isTransporter && existingOrder.withTransport) {
        console.log(`[assignCompanyToOrder] Automatycznie przypisuję właściciela ${onePersonUser.id} jako transportera dla zlecenia, które wymaga transportu`);
        updateData.transporterId = onePersonUser.id;
        updateData.transporterName = onePersonUser.name;
        updateData.transportStatus = 'zaplanowany';
        
        // Jeśli jest data montażu, ustaw transport na dzień przed montażem
        if (existingOrder.installationDate || updateData.installationDate) {
          const installDate = new Date(existingOrder.installationDate || updateData.installationDate);
          
          // Dla podłóg, transport musi być przynajmniej 2 dni przed montażem
          const isPodlogaService = existingOrder.serviceType && 
                                 existingOrder.serviceType.toLowerCase().includes('podłog');
          
          if (isPodlogaService) {
            const transportDate = new Date(installDate);
            transportDate.setDate(transportDate.getDate() - 2);
            updateData.transportDate = transportDate;
          } else {
            // Dla innych typów usług, transport może być dzień przed montażem
            const transportDate = new Date(installDate);
            transportDate.setDate(transportDate.getDate() - 1);
            updateData.transportDate = transportDate;
          }
        } else {
          // Jeśli nie ma daty montażu, ustaw transport na jutro
          const transportDate = new Date();
          transportDate.setDate(transportDate.getDate() + 1);
          updateData.transportDate = transportDate;
        }
      }
    } else {
      // Jeśli to nie firma jednosobowa, zachowaj standardowe zachowanie
      if (!existingOrder.installerId) {
        // Znajdź installerów należących do tej firmy
        const installers = await db.select()
          .from(users)
          .where(
            and(
              eq(users.role, 'installer'),
              eq(users.companyId, companyId)
            )
          );
        
        // Jeśli znaleziono installerów z tej firmy, przypisz pierwszego do zlecenia
        if (installers.length > 0) {
          const installer = installers[0];
          updateData.installerId = installer.id;
          updateData.installerName = installer.name;
        }
      }
    }
    
    console.log(`[assignCompanyToOrder] Aktualizuję zlecenie ${id} z następującymi danymi:`, updateData);
    
    // Jeśli przypisano firmę jednoosobową, dodajemy informację w logach
    if (updateData.installerId && updateData.transporterId && 
        updateData.installerId === updateData.transporterId) {
      console.log(`[assignCompanyToOrder] FIRMA JEDNOOSOBOWA: Przypisano tego samego użytkownika ${updateData.installerId} (${updateData.installerName}) jako montażystę i transportera!`);
    }
    
    const [updatedOrder] = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    
    console.log(`[assignCompanyToOrder] Aktualizacja zlecenia ${id} zakończona, nowe dane:`, {
      id: updatedOrder.id,
      companyId: updatedOrder.companyId,
      companyName: updatedOrder.companyName,
      installerId: updatedOrder.installerId,
      installerName: updatedOrder.installerName,
      transporterId: updatedOrder.transporterId,
      transporterName: updatedOrder.transporterName,
      transportStatus: updatedOrder.transportStatus,
      transportDate: updatedOrder.transportDate,
      withTransport: updatedOrder.withTransport
    });
    
    return updatedOrder;
  }
  
  async deleteOrder(id: number): Promise<boolean> {
    const [deletedOrder] = await db.delete(orders)
      .where(eq(orders.id, id))
      .returning();
    return !!deletedOrder;
  }
  
  // Sales Plan methods
  async getSalesPlan(year: number, month: number, storeId?: number): Promise<SalesPlan[]> {
    let conditions: SQL[] = [
      eq(salesPlans.year, year),
      eq(salesPlans.month, month)
    ];
    
    if (storeId) {
      conditions.push(eq(salesPlans.storeId, storeId));
    }
    
    return await db.select().from(salesPlans).where(and(...conditions));
  }
  
  async createSalesPlan(planData: InsertSalesPlan): Promise<SalesPlan> {
    const [plan] = await db.insert(salesPlans).values({
      ...planData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return plan;
  }
  
  async updateSalesPlan(id: number, planData: Partial<InsertSalesPlan>): Promise<SalesPlan | undefined> {
    const [updatedPlan] = await db.update(salesPlans)
      .set({
        ...planData,
        updatedAt: new Date()
      })
      .where(eq(salesPlans.id, id))
      .returning();
    return updatedPlan;
  }
  
  // Notification methods
  async getNotifications(userId: number): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }
  
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values({
      ...notificationData,
      createdAt: new Date()
    }).returning();
    return notification;
  }
  
  async markNotificationAsRead(id: number): Promise<boolean> {
    const [updatedNotification] = await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return !!updatedNotification;
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    const [deletedNotification] = await db.delete(notifications)
      .where(eq(notifications.id, id))
      .returning();
    return !!deletedNotification;
  }
  
  // Subscription methods
  async getSubscription(userId: number): Promise<Subscription | undefined> {
    const [subscription] = await db.select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return subscription;
  }
  
  async createSubscription(subscriptionData: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db.insert(subscriptions).values({
      ...subscriptionData,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return subscription;
  }
  
  async deleteSubscription(id: number): Promise<boolean> {
    const [deletedSubscription] = await db.delete(subscriptions)
      .where(eq(subscriptions.id, id))
      .returning();
    return !!deletedSubscription;
  }
  
  // Photo methods
  async getOrderPhotos(orderId: number): Promise<Photo[]> {
    return await db.select()
      .from(photos)
      .where(eq(photos.orderId, orderId))
      .orderBy(asc(photos.id));
  }
  
  async getPhoto(id: number): Promise<Photo | undefined> {
    console.log(`DatabaseStorage.getPhoto: Pobieranie zdjęcia o ID=${id}`);
    try {
      const [photo] = await db.select()
        .from(photos)
        .where(eq(photos.id, id));
        
      console.log(`DatabaseStorage.getPhoto: ${photo ? 'Znaleziono' : 'Nie znaleziono'} zdjęcie o ID=${id}`);
      if (photo) {
        console.log('DatabaseStorage.getPhoto: Szczegóły zdjęcia:', {
          id: photo.id,
          orderId: photo.orderId,
          filename: photo.filename,
          originalFilename: photo.originalFilename,
          mimetype: photo.mimetype,
          filePath: photo.filePath,
          fileSize: photo.fileSize
        });
      }
      
      return photo;
    } catch (error) {
      console.error(`DatabaseStorage.getPhoto: Błąd przy pobieraniu zdjęcia ID=${id}:`, error);
      throw error;
    }
  }
  
  async savePhoto(photoData: InsertPhoto): Promise<Photo> {
    console.log(`DatabaseStorage.savePhoto: Zapisywanie zdjęcia dla zlecenia ${photoData.orderId}`);
    console.log(`DatabaseStorage.savePhoto: Dane zdjęcia:`, {
      filename: photoData.filename,
      originalFilename: photoData.originalFilename,
      mimetype: photoData.mimetype,
      filePath: photoData.filePath,
      fileSize: photoData.fileSize
    });
    
    try {
      const [photo] = await db.insert(photos).values({
        ...photoData,
        createdAt: new Date()
      }).returning();
      
      console.log(`DatabaseStorage.savePhoto: Zapisano zdjęcie w bazie danych, ID=${photo.id}`);
      return photo;
    } catch (error) {
      console.error(`DatabaseStorage.savePhoto: Błąd przy zapisywaniu zdjęcia:`, error);
      throw error;
    }
  }
  
  async deletePhoto(id: number): Promise<boolean> {
    console.log(`DatabaseStorage.deletePhoto: Usuwanie zdjęcia o ID=${id}`);
    try {
      // Najpierw pobierz informacje o zdjęciu, aby znać ścieżkę pliku
      const photo = await this.getPhoto(id);
      if (!photo) {
        console.log(`DatabaseStorage.deletePhoto: Nie znaleziono zdjęcia o ID=${id}`);
        return false;
      }
      
      // Usuń plik z dysku, jeśli istnieje
      if (photo.filePath && fs.existsSync(photo.filePath)) {
        console.log(`DatabaseStorage.deletePhoto: Usuwanie pliku z dysku: ${photo.filePath}`);
        fs.unlinkSync(photo.filePath);
        console.log(`DatabaseStorage.deletePhoto: Plik usunięty z dysku`);
      } else {
        console.log(`DatabaseStorage.deletePhoto: Plik nie istnieje na dysku: ${photo.filePath}`);
      }
      
      // Usuń wpis z bazy danych
      const [deletedPhoto] = await db.delete(photos)
        .where(eq(photos.id, id))
        .returning();
      
      console.log(`DatabaseStorage.deletePhoto: ${deletedPhoto ? 'Usunięto' : 'Nie usunięto'} wpis z bazy danych`);
      return !!deletedPhoto;
    } catch (error) {
      console.error(`DatabaseStorage.deletePhoto: Błąd przy usuwaniu zdjęcia ID=${id}:`, error);
      throw error;
    }
  }
  
  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    try {
      const [setting] = await db.select().from(settings).where(eq(settings.key, key));
      return setting;
    } catch (error) {
      console.error(`DatabaseStorage.getSetting: Błąd przy pobieraniu ustawienia key=${key}:`, error);
      throw error;
    }
  }
  
  async getSettingsByCategory(category: string): Promise<Setting[]> {
    try {
      return await db.select().from(settings).where(eq(settings.category, category));
    } catch (error) {
      console.error(`DatabaseStorage.getSettingsByCategory: Błąd przy pobieraniu ustawień z kategorii=${category}:`, error);
      throw error;
    }
  }
  
  async getAllSettings(): Promise<Setting[]> {
    try {
      return await db.select().from(settings).orderBy(asc(settings.category), asc(settings.key));
    } catch (error) {
      console.error("DatabaseStorage.getAllSettings: Błąd przy pobieraniu wszystkich ustawień:", error);
      throw error;
    }
  }
  
  async createSetting(settingData: InsertSetting): Promise<Setting> {
    try {
      // Sprawdź czy ustawienie już istnieje
      const existingSetting = await this.getSetting(settingData.key);
      
      if (existingSetting) {
        // Jeśli istnieje, zaktualizuj
        return this.updateSetting(settingData.key, settingData.value || settingData.valueJson) as Promise<Setting>;
      }
      
      // Jeśli nie istnieje, utwórz nowe
      const [setting] = await db.insert(settings).values({
        ...settingData,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      return setting;
    } catch (error) {
      console.error(`DatabaseStorage.createSetting: Błąd przy tworzeniu ustawienia key=${settingData.key}:`, error);
      throw error;
    }
  }
  
  async updateSetting(key: string, value: string | object | null): Promise<Setting | undefined> {
    try {
      let updateData: any = { updatedAt: new Date() };
      
      if (typeof value === 'object' && value !== null) {
        updateData.valueJson = value;
        updateData.value = null;
      } else {
        updateData.value = value as string;
        updateData.valueJson = null;
      }
      
      const [updatedSetting] = await db.update(settings)
        .set(updateData)
        .where(eq(settings.key, key))
        .returning();
        
      return updatedSetting;
    } catch (error) {
      console.error(`DatabaseStorage.updateSetting: Błąd przy aktualizacji ustawienia key=${key}:`, error);
      throw error;
    }
  }
  
  async deleteSetting(key: string): Promise<boolean> {
    try {
      const [deletedSetting] = await db.delete(settings)
        .where(eq(settings.key, key))
        .returning();
        
      return !!deletedSetting;
    } catch (error) {
      console.error(`DatabaseStorage.deleteSetting: Błąd przy usuwaniu ustawienia key=${key}:`, error);
      throw error;
    }
  }
  
  // Company-Store relations methods
  async getCompanyStores(companyId: number): Promise<Store[]> {
    try {
      // Pobierz wszystkie sklepy przypisane do danej firmy
      const relations = await db
        .select({
          store: stores
        })
        .from(companyStores)
        .innerJoin(stores, eq(companyStores.storeId, stores.id))
        .where(eq(companyStores.companyId, companyId));
      
      return relations.map(rel => rel.store);
    } catch (error) {
      console.error(`DatabaseStorage.getCompanyStores: Błąd przy pobieraniu sklepów dla firmy id=${companyId}:`, error);
      throw error;
    }
  }
  
  async getStoreCompanies(storeId: number): Promise<Company[]> {
    try {
      // Pobierz wszystkie firmy przypisane do danego sklepu
      const relations = await db
        .select({
          company: companies
        })
        .from(companyStores)
        .innerJoin(companies, eq(companyStores.companyId, companies.id))
        .where(eq(companyStores.storeId, storeId));
      
      return relations.map(rel => rel.company);
    } catch (error) {
      console.error(`DatabaseStorage.getStoreCompanies: Błąd przy pobieraniu firm dla sklepu id=${storeId}:`, error);
      throw error;
    }
  }
  
  async addCompanyStore(companyId: number, storeId: number): Promise<CompanyStore> {
    try {
      // Sprawdź, czy relacja już istnieje
      const existing = await db
        .select()
        .from(companyStores)
        .where(and(
          eq(companyStores.companyId, companyId),
          eq(companyStores.storeId, storeId)
        ));
      
      if (existing.length > 0) {
        return existing[0];
      }
      
      // Jeśli nie istnieje, utwórz nową relację
      const [relation] = await db
        .insert(companyStores)
        .values({
          companyId,
          storeId
        })
        .returning();
      
      return relation;
    } catch (error) {
      console.error(`DatabaseStorage.addCompanyStore: Błąd przy dodawaniu relacji między firmą ${companyId} a sklepem ${storeId}:`, error);
      throw error;
    }
  }
  
  async removeCompanyStore(companyId: number, storeId: number): Promise<boolean> {
    try {
      // Usuń relację między firmą a sklepem
      const deleted = await db
        .delete(companyStores)
        .where(and(
          eq(companyStores.companyId, companyId),
          eq(companyStores.storeId, storeId)
        ))
        .returning();
      
      return deleted.length > 0;
    } catch (error) {
      console.error(`DatabaseStorage.removeCompanyStore: Błąd przy usuwaniu relacji między firmą ${companyId} a sklepem ${storeId}:`, error);
      throw error;
    }
  }
  
  async updateCompanyStores(companyId: number, storeIds: number[]): Promise<CompanyStore[]> {
    try {
      // Pobierz aktualne relacje
      const currentRelations = await db
        .select()
        .from(companyStores)
        .where(eq(companyStores.companyId, companyId));
      
      // Identyfikuj sklepy do usunięcia (te, które są w bazie, ale nie ma ich w nowej liście)
      const currentStoreIds = currentRelations.map(rel => rel.storeId);
      const storeIdsToRemove = currentStoreIds.filter(id => !storeIds.includes(id));
      
      // Identyfikuj sklepy do dodania (te, które są w nowej liście, ale nie ma ich w bazie)
      const storeIdsToAdd = storeIds.filter(id => !currentStoreIds.includes(id));
      
      // Usuń zbędne relacje
      if (storeIdsToRemove.length > 0) {
        await db
          .delete(companyStores)
          .where(and(
            eq(companyStores.companyId, companyId),
            sql`${companyStores.storeId} IN (${storeIdsToRemove.join(',')})`
          ));
      }
      
      // Dodaj nowe relacje
      const newRelations: CompanyStore[] = [];
      for (const storeId of storeIdsToAdd) {
        const [relation] = await db
          .insert(companyStores)
          .values({
            companyId,
            storeId
          })
          .returning();
        
        newRelations.push(relation);
      }
      
      // Zwróć wszystkie aktualne relacje po zmianach
      return await db
        .select()
        .from(companyStores)
        .where(eq(companyStores.companyId, companyId));
    } catch (error) {
      console.error(`DatabaseStorage.updateCompanyStores: Błąd przy aktualizacji sklepów dla firmy ${companyId}:`, error);
      throw error;
    }
  }

  // User Filters methods
  async getUserFilters(userId: number): Promise<UserFilter[]> {
    try {
      return await db
        .select()
        .from(userFilters)
        .where(eq(userFilters.userId, userId))
        .orderBy(desc(userFilters.isDefault), asc(userFilters.name));
    } catch (error) {
      console.error(`DatabaseStorage.getUserFilters: Błąd przy pobieraniu filtrów użytkownika ${userId}:`, error);
      throw error;
    }
  }

  async getUserFilterById(id: number): Promise<UserFilter | undefined> {
    try {
      const [filter] = await db
        .select()
        .from(userFilters)
        .where(eq(userFilters.id, id));
      return filter;
    } catch (error) {
      console.error(`DatabaseStorage.getUserFilterById: Błąd przy pobieraniu filtra ${id}:`, error);
      throw error;
    }
  }

  async getUserDefaultFilter(userId: number): Promise<UserFilter | undefined> {
    try {
      const [filter] = await db
        .select()
        .from(userFilters)
        .where(and(
          eq(userFilters.userId, userId),
          eq(userFilters.isDefault, true)
        ));
      return filter;
    } catch (error) {
      console.error(`DatabaseStorage.getUserDefaultFilter: Błąd przy pobieraniu domyślnego filtra użytkownika ${userId}:`, error);
      throw error;
    }
  }

  async createUserFilter(filterData: InsertUserFilter): Promise<UserFilter> {
    try {
      // Jeśli ustawiamy ten filtr jako domyślny, musimy zresetować inne domyślne filtry
      if (filterData.isDefault) {
        await db
          .update(userFilters)
          .set({ isDefault: false })
          .where(and(
            eq(userFilters.userId, filterData.userId),
            eq(userFilters.isDefault, true)
          ));
      }
      
      const [filter] = await db
        .insert(userFilters)
        .values({ ...filterData, updatedAt: new Date() })
        .returning();
      return filter;
    } catch (error) {
      console.error(`DatabaseStorage.createUserFilter: Błąd przy tworzeniu filtra dla użytkownika ${filterData.userId}:`, error);
      throw error;
    }
  }

  async updateUserFilter(id: number, filterData: Partial<InsertUserFilter>): Promise<UserFilter | undefined> {
    try {
      // Jeśli ustawiamy ten filtr jako domyślny, musimy zresetować inne domyślne filtry
      if (filterData.isDefault) {
        const [filter] = await db
          .select()
          .from(userFilters)
          .where(eq(userFilters.id, id));
        
        if (filter) {
          await db
            .update(userFilters)
            .set({ isDefault: false })
            .where(and(
              eq(userFilters.userId, filter.userId),
              eq(userFilters.isDefault, true),
              ne(userFilters.id, id)
            ));
        }
      }
      
      const [updatedFilter] = await db
        .update(userFilters)
        .set({ ...filterData, updatedAt: new Date() })
        .where(eq(userFilters.id, id))
        .returning();
      return updatedFilter;
    } catch (error) {
      console.error(`DatabaseStorage.updateUserFilter: Błąd przy aktualizacji filtra ${id}:`, error);
      throw error;
    }
  }

  async setUserDefaultFilter(userId: number, filterId: number): Promise<boolean> {
    try {
      // Najpierw resetujemy wszystkie domyślne filtry tego użytkownika
      await db
        .update(userFilters)
        .set({ isDefault: false })
        .where(and(
          eq(userFilters.userId, userId),
          eq(userFilters.isDefault, true)
        ));
      
      // Następnie ustawiamy wskazany filtr jako domyślny
      const [updatedFilter] = await db
        .update(userFilters)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(and(
          eq(userFilters.id, filterId),
          eq(userFilters.userId, userId)
        ))
        .returning();
      
      return !!updatedFilter;
    } catch (error) {
      console.error(`DatabaseStorage.setUserDefaultFilter: Błąd przy ustawianiu domyślnego filtra ${filterId} dla użytkownika ${userId}:`, error);
      throw error;
    }
  }

  async deleteUserFilter(id: number): Promise<boolean> {
    try {
      const [deletedFilter] = await db
        .delete(userFilters)
        .where(eq(userFilters.id, id))
        .returning();
      
      return !!deletedFilter;
    } catch (error) {
      console.error(`DatabaseStorage.deleteUserFilter: Błąd przy usuwaniu filtra ${id}:`, error);
      throw error;
    }
  }
}