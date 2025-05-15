import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import express from "express";
import fs from "fs";
import path from "path";
import * as uuid from "uuid";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { sendNotification } from "./utils/notifications";
import { format } from "date-fns";
import { 
  authMiddleware, 
  adminOnly, 
  workerOrAdmin, 
  managerOrDeputyOrAdmin,
  managerOnly,
  companyOrAdmin, 
  companyOnly, 
  installerOnly,
  anyWorkerOrAdmin,
  canEditFinancialFields
} from "./middleware/auth";
import { upload } from "./middleware/upload";
import { sendPushNotification, sendEmail } from "./utils/notifications";
import { createInsertSchema } from "drizzle-zod";
import bcrypt from "bcrypt";
import { z } from "zod";
import { insertUserSchema, insertOrderSchema, updateOrderStatusSchema, updateOrderFinancialStatusSchema, insertCompanySchema, insertStoreSchema, InsertOrder, InsertStore, companyStores, assignTransporterSchema, updateTransportStatusSchema, InsertUserFilter } from "@shared/schema";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import session from "express-session";
import MemoryStore from "memorystore";
import { WebSocketServer } from 'ws';
import { registerFilterRoutes } from "./routes/filters";

const SessionStore = MemoryStore(session);

// Funkcja pomocnicza do konwersji starych nazw statusów transportu na nowe
function normalizeTransportStatus(status: string | undefined | null): "skompletowany" | "zaplanowany" | "dostarczony" | undefined {
  if (!status) return undefined;
  
  // Konwersja starych nazw na nowe
  if (status === 'gotowe do transportu') return 'skompletowany';
  if (status === 'transport zaplanowany') return 'zaplanowany';
  if (status === 'transport dostarczony') return 'dostarczony';
  
  // Sprawdź czy status jest już w nowym formacie
  if (['skompletowany', 'zaplanowany', 'dostarczony'].includes(status)) {
    return status as "skompletowany" | "zaplanowany" | "dostarczony";
  }
  
  // Domyślny status
  return 'zaplanowany';
}

// Funkcja pomocnicza do konwersji nazw statusów instalacji na jednolity format
function normalizeInstallationStatus(status: string | undefined | null): "Nowe" | "Zaplanowane" | "W realizacji" | "Zakończone" | "Reklamacja" | undefined {
  if (!status) return undefined;
  
  // Konwersja wielkości liter
  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  
  // Sprawdź czy status jest w prawidłowym formacie
  if (["Nowe", "Zaplanowane", "W realizacji", "Zakończone", "Reklamacja"].includes(normalizedStatus)) {
    return normalizedStatus as "Nowe" | "Zaplanowane" | "W realizacji" | "Zakończone" | "Reklamacja";
  }
  
  // Mapowanie innych możliwych wartości
  if (normalizedStatus === 'Nowy' || normalizedStatus === 'New') return 'Nowe';
  if (normalizedStatus === 'Zaplanowany' || normalizedStatus === 'Planned') return 'Zaplanowane';
  if (normalizedStatus === 'W trakcie' || normalizedStatus === 'In progress') return 'W realizacji';
  if (normalizedStatus === 'Zakończony' || normalizedStatus === 'Completed' || normalizedStatus === 'Done') return 'Zakończone';
  if (normalizedStatus === 'Problem' || normalizedStatus === 'Complaint') return 'Reklamacja';
  
  // Domyślny status
  return 'Nowe';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Rozpoczynamy konfigurację middleware i routingu
  // Use session middleware
  // Poprawka problemu różnych danych sesji w różnych oknach - wspólna sesja
  const sessionConfig: session.SessionOptions = {
    cookie: { 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Must be "lax", "strict", or "none" - string literals only
      path: '/', // Dostępność ciasteczka dla całej domeny
      httpOnly: true, // Ciasteczko dostępne tylko przez HTTP, nie przez JavaScript
    },
    store: new SessionStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    name: 'belpol_session', // Ustawienie stałej nazwy ciasteczka sesyjnego
    resave: true, // Zmienione na true, aby uniknąć problemów z sesją
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || "belpol-app-secret"
  };
  
  app.use(session(sessionConfig));

  // Endpoint to create initial admin account (this would be removed in production)
  app.post("/api/auth/setup-admin", async (req: Request, res: Response) => {
    try {
      // Check if any admin already exists
      const adminUsers = await storage.getUsersByRole("admin");
      if (adminUsers.length > 0) {
        return res.status(400).json({ message: "Konto administratora już istnieje. Funkcja dostępna tylko przy pierwszym uruchomieniu." });
      }
      
      // Validate user data
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, hasło i imię są wymagane" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Użytkownik z tym adresem email już istnieje" });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user (as admin)
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
        role: "admin",
        services: [] // Dodajemy puste services
      });
      
      // Set user in session (log in automatically)
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        storeId: user.storeId || undefined,
        position: user.position || undefined,
        companyId: user.companyId || undefined
      };
      
      // Ensure the session is saved before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Błąd przy zapisie sesji" });
        }
        
        // Return user without password
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Admin setup error:", error);
      res.status(500).json({ message: "Błąd serwera przy tworzeniu administratora" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email i hasło są wymagane" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Nieprawidłowy email lub hasło" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Nieprawidłowy email lub hasło" });
      }

      // Jeśli użytkownik jest typu "company", sprawdź, czy ma powiązanie z tabelą companies
      let updatedUser = { ...user };
      if (user.role === 'company') {
        try {
          // Sprawdź, czy ma już przypisaną firmę
          if (!user.companyId) {
            // Pobierz firmy
            const companies = await storage.getCompanies();
            
            // Sprawdź, czy istnieje firma z takim samym nipem lub emailem
            let existingCompany = null;
            
            if (user.nip) {
              existingCompany = companies.find(company => company.nip === user.nip);
            }
            
            if (!existingCompany && user.email) {
              existingCompany = companies.find(company => company.email === user.email);
            }
            
            if (existingCompany) {
              // Aktualizuj użytkownika z ID istniejącej firmy
              updatedUser = await storage.updateUser(user.id, {
                companyId: existingCompany.id,
                companyName: existingCompany.name
              }) || updatedUser;
            } else {
              // Utwórz nową firmę
              const newCompany = await storage.createCompany({
                name: user.companyName || user.name || '',
                nip: user.nip || '',
                address: user.companyAddress || '',
                contactName: user.name || '',
                email: user.email,
                phone: user.phone || '',
                services: user.services || [],
                status: 'active'
              });
              
              // Aktualizuj użytkownika z ID nowej firmy
              updatedUser = await storage.updateUser(user.id, {
                companyId: newCompany.id,
                companyName: newCompany.name
              }) || updatedUser;
            }
          }
        } catch (syncError) {
          console.error("Błąd synchronizacji company:", syncError);
          // Kontynuuj mimo błędu
        }
      }

      // Set user in session
      req.session.user = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        storeId: updatedUser.storeId || undefined,
        position: updatedUser.position || undefined,
        companyId: updatedUser.companyId || undefined,
        companyName: updatedUser.companyName || undefined,
        services: updatedUser.services || []
      };
      
      console.log("Zapisane dane sesji:", JSON.stringify(req.session.user, null, 2));

      // Ensure the session is saved before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Błąd przy zapisie sesji" });
        }
        
        // Return user without password
        const { password: _, ...userWithoutPassword } = updatedUser;
        res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Błąd serwera przy logowaniu" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    console.log("Otrzymano żądanie wylogowania");
    
    // Dodaj nagłówki zapobiegające cachowaniu
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Wyczyść sesję
    if (req.session) {
      console.log("Sesja istnieje, rozpoczynam czyszczenie");
      
      // Najpierw spróbuj usunąć dane użytkownika
      req.session.user = undefined;
      
      // Następnie zniszcz całą sesję
      req.session.destroy((err) => {
        if (err) {
          console.error("Błąd podczas niszczenia sesji:", err);
          return res.status(500).json({ message: "Błąd podczas wylogowywania" });
        }
        
        console.log("Sesja zniszczona pomyślnie");
        
        // Wyczyść wszystkie możliwe ciasteczka sesyjne
        res.clearCookie("belpol_session", { path: '/' });
        res.clearCookie("connect.sid", { path: '/' });
        res.clearCookie("sid", { path: '/' });
        
        console.log("Ciasteczka sesji wyczyszczone");
        res.status(200).json({ message: "Wylogowano pomyślnie" });
      });
    } else {
      console.log("Brak sesji, ale odpowiadam pomyślnie");
      res.status(200).json({ message: "Wylogowano pomyślnie" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Nie jesteś zalogowany" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Użytkownik nie znaleziony" });
      }

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // User endpoints
  app.get("/api/users", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const searchTerm = req.query.search as string | undefined;
      const users = await storage.getUsers(searchTerm);
      
      // Remove passwords from response
      const safeUsers = users.map(({ password, ...rest }) => rest);
      
      res.status(200).json(safeUsers);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.post("/api/users", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      // Ensure services is an array
      if (req.body.services && typeof req.body.services === 'string') {
        req.body.services = [req.body.services];
      } else if (!req.body.services) {
        req.body.services = [];
      }
      
      // Konwersja storeId i companyId z string na number
      // Usunięto ręczną konwersję - teraz obsługiwane przez schemat Zod w insertUserSchema
      
      const userData = insertUserSchema.parse(req.body);
      console.log("Parsed user data:", JSON.stringify(userData, null, 2));
      
      // Sprawdzenie czy email już istnieje
      const existingUser = await storage.getUserByEmail(userData.email);
      
      let user;
      
      if (existingUser) {
        // Jeśli użytkownik już istnieje, sprawdź czy jest to firma/montażysta
        if (existingUser.role === 'company' && userData.role === 'installer') {
          // To jest przypadek dodawania instalatora dla istniejącej firmy
          console.log("Użytkownik z emailem już istnieje, dodajemy role montażysty do firmy");
          
          // Aktualizujemy usługi jeśli podano
          if (userData.services && userData.services.length > 0) {
            const updatedServices = [...(existingUser.services || [])];
            userData.services.forEach(service => {
              if (!updatedServices.includes(service)) {
                updatedServices.push(service);
              }
            });
            
            // Aktualizacja usług
            await storage.updateUser(existingUser.id, { 
              services: updatedServices 
            });
          }
          
          user = existingUser;
        } else if (existingUser.role === 'installer' && userData.role === 'company') {
          // To jest przypadek dodawania firmy dla istniejącego instalatora
          console.log("Użytkownik z emailem już istnieje, dodajemy role firmy do montażysty");
          
          // Aktualizacja użytkownika (zmiana roli)
          await storage.updateUser(existingUser.id, { 
            role: 'company',
            nip: userData.nip || '',
            companyAddress: userData.companyAddress || '',
          });
          
          user = existingUser;
        } else {
          return res.status(400).json({ message: "Użytkownik z tym adresem email już istnieje" });
        }
      } else {
        // Standardowe tworzenie nowego użytkownika
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        user = await storage.createUser({
          ...userData,
          password: hashedPassword
        });
      }
      
      // Jeśli użytkownik jest firmą (company), dodajemy wpis do tabeli companies
      if (userData.role === 'company') {
        try {
          // Sprawdź, czy firma już istnieje
          const companies = await storage.getCompanies();
          const existingCompany = companies.find(company => company.nip === userData.nip);
          
          if (!existingCompany) {
            // Utwórz nową firmę
            const company = await storage.createCompany({
              name: userData.companyName || userData.name,
              nip: userData.nip || '',
              address: userData.companyAddress || '',
              contactName: userData.name,
              email: userData.email,
              phone: userData.phone || '',
              services: userData.services,
              status: 'active'
            });
            
            // Aktualizuj użytkownika z ID firmy
            await storage.updateUser(user.id, {
              companyId: company.id
            });
            
            // Zaktualizuj obiekt użytkownika
            user.companyId = company.id;
          } else {
            // Jeśli firma już istnieje, powiąż użytkownika z tą firmą
            await storage.updateUser(user.id, {
              companyId: existingCompany.id
            });
            
            // Zaktualizuj obiekt użytkownika
            user.companyId = existingCompany.id;
          }
        } catch (companyError) {
          console.error("Błąd przy tworzeniu firmy:", companyError);
          // Kontynuuj mimo błędu - użytkownik został utworzony
        }
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Zod validation error:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Nieprawidłowe dane", errors: error.errors });
      }
      console.error("User creation error:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      const { role, companyId } = req.session.user!;
      
      // Validate user existence
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Użytkownik nie znaleziony" });
      }
      
      // Sprawdzenie uprawnień - tylko admin lub firma dla swoich montażystów
      if (role !== 'admin') {
        // Jeśli użytkownik jest firmą, może edytować tylko montażystów przypisanych do swojej firmy
        if (role === 'company') {
          // Jeśli edytowany użytkownik nie jest montażystą lub nie należy do tej firmy
          if (existingUser.role !== 'installer' || existingUser.companyId !== companyId) {
            return res.status(403).json({ message: "Brak uprawnień do edycji tego użytkownika" });
          }
          
          // Firma nie może zmieniać roli ani przypisania do firmy
          delete userData.role;
          delete userData.companyId;
        } else {
          // Inne role nie mają dostępu do edycji użytkowników
          return res.status(403).json({ message: "Brak uprawnień do edycji użytkowników" });
        }
      }
      
      // Hash password if provided
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      } else {
        // Remove password from update data if empty
        delete userData.password;
      }
      
      // Konwersja pustych stringów na null dla pól liczbowych
      if (userData.storeId === '') {
        userData.storeId = null;
      } else if (typeof userData.storeId === 'string' && userData.storeId) {
        userData.storeId = parseInt(userData.storeId, 10);
      }
      
      if (userData.companyId === '') {
        userData.companyId = null;
      } else if (typeof userData.companyId === 'string' && userData.companyId) {
        userData.companyId = parseInt(userData.companyId, 10);
      }
      
      console.log("Aktualizacja użytkownika:", userId, "z danymi:", userData);
      
      const updatedUser = await storage.updateUser(userId, userData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "Użytkownik nie znaleziony" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const { role, companyId } = req.session.user!;
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Użytkownik nie znaleziony" });
      }
      
      // Check if user is not trying to delete themself
      if (userId === req.session.user?.id) {
        return res.status(400).json({ message: "Nie możesz usunąć swojego konta" });
      }
      
      // Sprawdzenie uprawnień - tylko admin lub firma dla swoich montażystów
      if (role !== 'admin') {
        // Jeśli użytkownik jest firmą, może usuwać tylko montażystów przypisanych do swojej firmy
        if (role === 'company') {
          // Jeśli usuwany użytkownik nie jest montażystą lub nie należy do tej firmy
          if (user.role !== 'installer' || user.companyId !== companyId) {
            return res.status(403).json({ message: "Brak uprawnień do usunięcia tego użytkownika" });
          }
        } else {
          // Inne role nie mają dostępu do usuwania użytkowników
          return res.status(403).json({ message: "Brak uprawnień do usuwania użytkowników" });
        }
      }
      
      console.log("Usuwanie użytkownika:", userId, "przez", role);
      
      const deleted = await storage.deleteUser(userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Użytkownik nie znaleziony" });
      }
      
      res.status(200).json({ message: "Użytkownik usunięty pomyślnie" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpointy do obsługi filtrów użytkownika
  
  // Pobieranie wszystkich filtrów użytkownika
  app.get('/api/user/filters', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const filters = await storage.getUserFilters(userId);
      res.json(filters);
    } catch (error) {
      console.error('Błąd przy pobieraniu filtrów użytkownika:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });
  
  // Pobieranie domyślnego filtra użytkownika
  app.get('/api/user/filters/default', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const filter = await storage.getUserDefaultFilter(userId);
      if (!filter) {
        return res.status(404).json({ message: "Nie znaleziono domyślnego filtra" });
      }
      
      res.json(filter);
    } catch (error) {
      console.error('Błąd przy pobieraniu domyślnego filtra użytkownika:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });
  
  // Pobieranie konkretnego filtra użytkownika
  app.get('/api/user/filters/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }
      
      const filter = await storage.getUserFilterById(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Nie znaleziono filtra" });
      }
      
      // Sprawdź, czy filtr należy do zalogowanego użytkownika
      if (filter.userId !== userId) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }
      
      res.json(filter);
    } catch (error) {
      console.error('Błąd przy pobieraniu filtra:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });
  
  // Tworzenie nowego filtra
  app.post('/api/user/filters', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { name, filtersData, isDefault = false } = req.body;
      
      if (!name || !filtersData) {
        return res.status(400).json({ message: "Brakujące dane filtra" });
      }
      
      console.log(`Tworzenie nowego filtru o nazwie "${name}", isDefault=${isDefault}`);
      
      // Sprawdź czy istnieje już filtr o takiej samej nazwie dla tego użytkownika
      const userFilters = await storage.getUserFilters(userId);
      const existingFilter = userFilters.find(f => f.name === name);
      
      if (existingFilter) {
        console.log(`Znaleziono istniejący filtr o nazwie "${name}" (ID: ${existingFilter.id}), aktualizuję zamiast tworzyć nowy`);
        
        // Aktualizuj istniejący filtr zamiast tworzyć nowy
        const updatedFilter = await storage.updateUserFilter(existingFilter.id, {
          filtersData,
          isDefault
        });
        
        // Jeśli filtr ma być domyślny, usuń flagę domyślną z innych filtrów
        if (isDefault) {
          console.log('Ustawianie filtru jako domyślny, resetowanie innych filtrów domyślnych');
          await storage.setUserDefaultFilter(userId, existingFilter.id);
        }
        
        res.status(200).json(updatedFilter);
        return;
      }
      
      // Jeśli filtr ma być domyślny, najpierw usuń flagę z innych filtrów
      if (isDefault) {
        console.log('Resetowanie istniejących filtrów domyślnych przed utworzeniem nowego');
        const defaultFilters = userFilters.filter(f => f.isDefault);
        
        for (const df of defaultFilters) {
          console.log(`Usuwanie flagi domyślnej z filtru ID ${df.id}`);
          await storage.updateUserFilter(df.id, { isDefault: false });
        }
      }
      
      // Utwórz nowy filtr
      console.log('Tworzenie nowego filtru...');
      const newFilter = await storage.createUserFilter({
        userId,
        name,
        filtersData,
        isDefault
      });
      
      console.log(`Utworzono nowy filtr o ID ${newFilter.id}`);
      res.status(201).json(newFilter);
    } catch (error) {
      console.error('Błąd przy tworzeniu filtra:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });
  
  // Aktualizacja filtra
  app.put('/api/user/filters/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }
      
      // Sprawdź, czy filtr istnieje i należy do użytkownika
      const existingFilter = await storage.getUserFilterById(filterId);
      if (!existingFilter) {
        return res.status(404).json({ message: "Nie znaleziono filtra" });
      }
      
      if (existingFilter.userId !== userId) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }
      
      const { name, filtersData, isDefault } = req.body;
      
      console.log(`Aktualizacja filtru ID ${filterId}, isDefault=${isDefault}`);
      
      // Jeśli ustawiamy filtr jako domyślny, wyłącz wcześniejsze domyślne filtry
      if (isDefault === true) {
        console.log('Ustawianie filtru jako domyślny, resetowanie innych filtrów');
        
        // Pobierz wszystkie filtry użytkownika
        const userFilters = await storage.getUserFilters(userId);
        const defaultFilters = userFilters.filter(f => f.isDefault && f.id !== filterId);
        
        // Wyłącz wszystkie inne domyślne filtry
        for (const defaultFilter of defaultFilters) {
          console.log(`Wyłączanie domyślnego filtru ID ${defaultFilter.id}`);
          await storage.updateUserFilter(defaultFilter.id, {
            isDefault: false
          });
        }
      }
      
      // Aktualizuj filtr
      console.log(`Aktualizacja danych filtru ID ${filterId}`);
      const updatedFilter = await storage.updateUserFilter(filterId, {
        name,
        filtersData,
        isDefault
      });
      
      res.json(updatedFilter);
    } catch (error) {
      console.error('Błąd przy aktualizacji filtra:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });
  
  // Ustawianie filtra jako domyślnego
  app.post('/api/user/filters/:id/set-default', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }
      
      // Sprawdź, czy filtr istnieje i należy do użytkownika
      const existingFilter = await storage.getUserFilterById(filterId);
      if (!existingFilter) {
        return res.status(404).json({ message: "Nie znaleziono filtra" });
      }
      
      if (existingFilter.userId !== userId) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }
      
      await storage.setUserDefaultFilter(userId, filterId);
      
      res.json({ success: true, message: "Ustawiono filtr jako domyślny" });
    } catch (error) {
      console.error('Błąd przy ustawianiu domyślnego filtra:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });
  
  // Usuwanie filtra
  app.delete('/api/user/filters/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }
      
      // Sprawdź, czy filtr istnieje i należy do użytkownika
      const existingFilter = await storage.getUserFilterById(filterId);
      if (!existingFilter) {
        return res.status(404).json({ message: "Nie znaleziono filtra" });
      }
      
      if (existingFilter.userId !== userId) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }
      
      // Zapisujemy informację czy filtr był domyślny
      const wasDefault = existingFilter.isDefault;
      
      await storage.deleteUserFilter(filterId);
      
      res.json({ 
        success: true, 
        message: "Filtr został usunięty",
        wasDefault // Dodajemy informację, czy usunięty filtr był domyślny 
      });
    } catch (error) {
      console.error('Błąd przy usuwaniu filtra:', error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });

  // Company endpoints
  app.get("/api/companies", authMiddleware, async (req: Request, res: Response) => {
    try {
      // Parametr opcjonalny: storeId - pobiera tylko firmy przypisane do danego sklepu
      const { storeId } = req.query;
      
      if (storeId && !isNaN(Number(storeId))) {
        const storeIdNum = Number(storeId);
        const companies = await storage.getStoreCompanies(storeIdNum);
        return res.status(200).json(companies);
      }
      
      const companies = await storage.getCompanies();
      res.status(200).json(companies);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // UWAGA: Najpierw definiujemy bardziej szczegółowe ścieżki (z performance), a dopiero potem ogólne (/:id)
  app.get("/api/companies/performance", authMiddleware, async (req: Request, res: Response) => {
    console.log("Otrzymano zapytanie na /api/companies/performance");
    try {
      // Sprawdzamy limit, ale nie zwracamy błędu jeśli limit nie istnieje
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      console.log("Limit:", limit);
      
      // Pobieramy firmy z bazy danych
      console.log("Pobieranie firm z bazy danych...");
      const companies = await storage.getCompanies();
      console.log(`Pobrano firm: ${companies?.length || 0}`);
      
      if (!companies || !Array.isArray(companies) || companies.length === 0) {
        console.log("Brak firm do wyświetlenia, zwracam pustą tablicę");
        return res.status(200).json([]);
      }
      
      // Dodajemy metryki wydajności (symulujemy dane, w produkcji byłyby obliczane z prawdziwych zamówień)
      console.log("Dodawanie metryk wydajności dla firm...");
      const companiesWithPerformance = companies.map(company => {
        return {
          ...company,
          completedOrders: Math.floor(Math.random() * 20) + 10,
          totalOrders: Math.floor(Math.random() * 30) + 15,
          timelinessPercent: Math.floor(Math.random() * 20) + 80,
          complaintsPercent: Math.floor(Math.random() * 10),
          lastOrderDate: new Date(Date.now() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000)
        };
      });
      
      console.log(`Przygotowano ${companiesWithPerformance.length} firm z metrykami wydajności`);
      
      if (limit) {
        console.log(`Zastosowano limit ${limit}, zwracam ${Math.min(limit, companiesWithPerformance.length)} firm`);
        return res.status(200).json(companiesWithPerformance.slice(0, limit));
      }
      
      console.log(`Zwracam wszystkie firmy: ${companiesWithPerformance.length}`);
      res.status(200).json(companiesWithPerformance);
    } catch (error) {
      console.error("Błąd podczas pobierania wydajności firm:", error);
      res.status(200).json([]); // Zwracamy pustą tablicę zamiast błędu
    }
  });
  
  // Endpoint do pobierania pojedynczej firmy po ID
  app.get("/api/companies/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID firmy" });
      }
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      res.status(200).json(company);
    } catch (error) {
      console.error("Błąd podczas pobierania firmy:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.post("/api/companies", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      // Ensure services is an array
      if (req.body.services && typeof req.body.services === 'string') {
        req.body.services = [req.body.services];
      } else if (!req.body.services) {
        req.body.services = [];
      }
      
      const companyData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(companyData);
      
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Nieprawidłowe dane firmy", errors: error.errors });
      }
      console.error("Company creation error:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.patch("/api/companies/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Ensure services is an array
      if (req.body.services && typeof req.body.services === 'string') {
        req.body.services = [req.body.services];
      } else if (!req.body.services) {
        req.body.services = [];
      }
      
      // Validate company existence
      const existingCompany = await storage.getCompany(companyId);
      if (!existingCompany) {
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      const updatedCompany = await storage.updateCompany(companyId, req.body);
      
      if (!updatedCompany) {
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      res.status(200).json(updatedCompany);
    } catch (error) {
      console.error("Company update error:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.delete("/api/companies/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Check if company exists
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      // Check if company is in use by orders
      const orders = await storage.getOrders({ storeId: undefined, installationStatus: undefined });
      const companyInUse = orders.some(order => order.companyId === companyId);
      
      if (companyInUse) {
        return res.status(400).json({ message: "Nie można usunąć firmy, ponieważ jest używana w zleceniach" });
      }
      
      const deleted = await storage.deleteCompany(companyId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      res.status(200).json({ message: "Firma usunięta pomyślnie" });
    } catch (error) {
      console.error("Company deletion error:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Endpoint do synchronizacji użytkowników typu company z tabelą companies
  app.post("/api/companies/sync", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      // Pobierz wszystkich użytkowników typu "company"
      const companyUsers = await storage.getUsersByRole('company');
      
      // Pobierz wszystkie istniejące firmy
      const existingCompanies = await storage.getCompanies();
      
      const results = {
        created: 0,
        updated: 0,
        skipped: 0
      };
      
      // Dla każdego użytkownika typu "company"
      for (const user of companyUsers) {
        // Sprawdź, czy firma już istnieje na podstawie NIP
        let existingCompany = null;
        
        if (user.nip) {
          existingCompany = existingCompanies.find(company => company.nip === user.nip);
        }
        
        // Jeśli nie znaleziono na podstawie NIP, sprawdź na podstawie email
        if (!existingCompany && user.email) {
          existingCompany = existingCompanies.find(company => company.email === user.email);
        }
        
        if (!existingCompany) {
          // Utwórz nową firmę
          const newCompany = await storage.createCompany({
            name: user.companyName || user.name,
            nip: user.nip || '',
            address: user.companyAddress || '',
            contactName: user.name,
            email: user.email,
            phone: user.phone || '',
            services: user.services || [],
            status: 'active'
          });
          
          // Aktualizuj użytkownika z ID firmy
          await storage.updateUser(user.id, {
            companyId: newCompany.id,
            companyName: newCompany.name
          });
          
          results.created++;
        } else {
          // Aktualizuj użytkownika, jeśli nie ma jeszcze ID firmy
          if (!user.companyId || user.companyId !== existingCompany.id) {
            await storage.updateUser(user.id, {
              companyId: existingCompany.id,
              companyName: existingCompany.name
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        }
      }
      
      res.status(200).json({ 
        message: "Synchronizacja zakończona", 
        results,
        totalCompanyUsers: companyUsers.length
      });
    } catch (error) {
      console.error("Error syncing companies:", error);
      res.status(500).json({ message: "Błąd podczas synchronizacji firm" });
    }
  });
  
  // Endpoint do pobierania montażystów dla firmy z filtrowaniem według specjalizacji
  app.get("/api/installers", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { companyId, serviceType, orderId } = req.query;
      const { role, companyId: userCompanyId } = req.session.user!;
      
      console.log(`Pobieranie montażystów. Rola: ${role}, ID firmy użytkownika: ${userCompanyId}, ID firmy z zapytania: ${companyId}, Typ usługi: ${serviceType}, ID zlecenia: ${orderId}`);
      
      let allInstallers = await storage.getUsersByRole("installer");
      let installers = [];
      let orderServiceType = serviceType as string | undefined;
      
      // Jeśli podano ID zlecenia, pobierz typ usługi z tego zlecenia
      if (orderId) {
        try {
          const order = await storage.getOrder(parseInt(orderId as string));
          if (order) {
            orderServiceType = order.serviceType;
            console.log(`Pobrano typ usługi ze zlecenia: ${orderServiceType}`);
          }
        } catch (err) {
          console.error(`Błąd podczas pobierania zlecenia ${orderId}:`, err);
        }
      }
      
      // Mapowanie rodzaju usługi na odpowiednie umiejętności montażystów
      const getRequiredService = (serviceType: string | undefined) => {
        if (!serviceType) return undefined;
        
        if (serviceType.toLowerCase().includes('drzwi')) {
          return 'Montaż drzwi';
        }
        
        if (serviceType.toLowerCase().includes('podłog')) {
          return 'Montaż podłogi';
        }
        
        if (serviceType.toLowerCase().includes('transport')) {
          return 'Transport';
        }
        
        // Default - jeśli nie rozpoznano typu usługi
        return undefined;
      };
      
      const requiredService = getRequiredService(orderServiceType);
      console.log(`Wymagana usługa: ${requiredService}`);
      
      // Jeśli użytkownik ma rolę firmy, może pobierać tylko swoich montażystów
      if (role === 'company') {
        // Firma pobiera swoich montażystów
        console.log(`Firma o ID ${userCompanyId} pobiera swoich montażystów. Montażyści przed filtrowaniem:`, allInstallers.length);
        
        // Pokaż montażystów dla tej firmy
        installers = allInstallers.filter(user => user.companyId === userCompanyId);
        console.log(`Montażyści dla firmy ${userCompanyId}:`, installers.length);
        
        // Filtruj po typie usługi, jeśli określono
        if (requiredService) {
          const filteredInstallers = installers.filter(installer => 
            installer.services && 
            Array.isArray(installer.services) && 
            installer.services.includes(requiredService)
          );
          
          console.log(`Montażyści z wymaganą usługą '${requiredService}': ${filteredInstallers.length}`);
          installers = filteredInstallers;
        }
      } 
      // Montażysta, który ma przypisaną firmę (firma jednosobowa) może także pobierać montażystów
      else if (role === 'installer' && userCompanyId) {
        console.log(`Montażysta-właściciel firmy o ID ${userCompanyId} pobiera montażystów`);
        
        // Pokaż montażystów dla tej firmy
        installers = allInstallers.filter(user => user.companyId === userCompanyId);
        console.log(`Montażyści dla firmy ${userCompanyId}:`, installers.length);
        
        // Filtruj po typie usługi, jeśli określono
        if (requiredService) {
          const filteredInstallers = installers.filter(installer => 
            installer.services && 
            Array.isArray(installer.services) && 
            installer.services.includes(requiredService)
          );
          
          console.log(`Montażyści z wymaganą usługą '${requiredService}': ${filteredInstallers.length}`);
          installers = filteredInstallers;
        }
      } 
      // Admin może pobierać wszystkich montażystów lub filtrować po companyId
      else if (role === 'admin') {
        installers = companyId
          ? allInstallers.filter(user => user.companyId === parseInt(companyId as string))
          : allInstallers;
          
        // Filtruj po typie usługi, jeśli określono
        if (requiredService) {
          installers = installers.filter(installer => 
            installer.services && 
            Array.isArray(installer.services) && 
            installer.services.includes(requiredService)
          );
        }
      } 
      // Pracownicy sklepu również mogą pobierać montażystów
      else if (role === 'worker') {
        installers = allInstallers;
        
        // Filtruj po typie usługi, jeśli określono
        if (requiredService) {
          installers = installers.filter(installer => 
            installer.services && 
            Array.isArray(installer.services) && 
            installer.services.includes(requiredService)
          );
        }
      }
      else {
        // Inne role nie mają dostępu
        return res.status(403).json({ message: "Brak uprawnień do pobierania montażystów" });
      }
      
      // Usuń hasła przed wysłaniem
      const safeInstallers = installers.map(({ password, ...rest }) => rest);
      return res.json(safeInstallers);
    } catch (error) {
      console.error("Error fetching installers:", error);
      res.status(500).json({ message: "Błąd podczas pobierania montażystów" });
    }
  });

  // Endpoint do pobierania transporterów dla firmy
  app.get("/api/transporters", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { companyId, orderId } = req.query;
      const { role, companyId: userCompanyId } = req.session.user!;
      
      console.log(`Pobieranie transporterów. Rola: ${role}, ID firmy użytkownika: ${userCompanyId}, ID firmy z zapytania: ${companyId}, ID zlecenia: ${orderId}`);
      
      // Pobierz wszystkich użytkowników
      let allUsers = await storage.getUsers();
      let transporters: any[] = [];
      
      // Jeśli podano ID zlecenia, pobierz je w celu uzyskania danych firmy
      let orderCompanyId = undefined;
      if (orderId) {
        try {
          const order = await storage.getOrder(parseInt(orderId as string));
          if (order) {
            orderCompanyId = order.companyId;
            console.log(`Pobrano dane zlecenia: companyId=${orderCompanyId}`);
          }
        } catch (err) {
          console.error(`Błąd podczas pobierania zlecenia ${orderId}:`, err);
        }
      }
      
      // Filtrowanie transporterów na podstawie roli i parametrów
      if (role === 'admin') {
        // Admin widzi wszystkich transporterów lub filtruje po firmie
        if (companyId) {
          transporters = allUsers.filter(user => 
            user.companyId === parseInt(companyId as string) && 
            user.services && 
            (user.services.includes('transport') || user.services.includes('Transport'))
          );
        } else {
          transporters = allUsers.filter(user => 
            user.services && 
            (user.services.includes('transport') || user.services.includes('Transport'))
          );
        }
      } 
      else if (role === 'company') {
        // Firma widzi wszystkich użytkowników swojej firmy, którzy mają uprawnienia do transportu,
        // niezależnie od ich roli (installer, company, itp.)
        transporters = allUsers.filter(user => 
          user.companyId === userCompanyId && 
          user.services && 
          (user.services.includes('transport') || user.services.includes('Transport'))
        );
        
        console.log(`Znaleziono ${transporters.length} transporterów dla firmy ${userCompanyId}`);
        if (transporters.length > 0) {
          console.log("Dane transporterów:", transporters.map(t => ({ 
            id: t.id, 
            email: t.email, 
            role: t.role, 
            services: t.services 
          })));
        }
      }
      // Montażysta, który ma przypisaną firmę (firma jednosobowa) może także pobierać transporterów
      else if (role === 'installer' && userCompanyId) {
        console.log(`Montażysta-właściciel firmy o ID ${userCompanyId} pobiera transporterów`);
        
        // Pokaż transporterów dla tej firmy
        transporters = allUsers.filter(user => 
          user.companyId === userCompanyId && 
          user.services && 
          (user.services.includes('transport') || user.services.includes('Transport'))
        );
        
        console.log(`Znaleziono ${transporters.length} transporterów dla firmy ${userCompanyId} (montażysta-właściciel)`);
        if (transporters.length > 0) {
          console.log("Dane transporterów:", transporters.map(t => ({ 
            id: t.id, 
            email: t.email, 
            role: t.role, 
            services: t.services 
          })));
        }
      }
      else if (role === 'worker') {
        // Pracownik sklepu widzi transporterów dla wybranej firmy lub firmy przypisanej do zlecenia
        if (companyId || orderCompanyId) {
          const targetCompanyId = companyId ? parseInt(companyId as string) : orderCompanyId;
          transporters = allUsers.filter(user => 
            user.companyId === targetCompanyId && 
            user.services && 
            (user.services.includes('transport') || user.services.includes('Transport'))
          );
          
          console.log(`Znaleziono ${transporters.length} transporterów dla firmy ${targetCompanyId} (pracownik sklepu)`);
          if (transporters.length > 0) {
            console.log("Dane transporterów:", transporters.map(t => ({ 
              id: t.id, 
              email: t.email, 
              role: t.role, 
              services: t.services 
            })));
          }
        } else {
          // Bez określonej firmy, zwracamy pustą listę
          transporters = [];
        }
      } 
      else {
        // Inne role nie mają dostępu
        return res.status(403).json({ message: "Brak uprawnień do pobierania transporterów" });
      }
      
      // Usuń hasła przed wysłaniem
      const safeTransporters = transporters.map(({ password, ...rest }) => rest);
      return res.json(safeTransporters);
    } catch (error) {
      console.error("Error fetching transporters:", error);
      res.status(500).json({ message: "Błąd podczas pobierania transporterów" });
    }
  });

  // Order endpoints
  app.get("/api/orders", authMiddleware, async (req: Request, res: Response) => {
    try {
      console.log("Otrzymano zapytanie na /api/orders");
      
      // Wczytujemy wszystkie parametry zapytania
      const { 
        search, status, store, filters: filtersStr,
        installationDateFrom, installationDateTo,
        transportDateFrom, transportDateTo
      } = req.query;
      console.log("Parametry zapytania:", req.query);
      
      // Pobierz dane użytkownika z sesji
      const { role, storeId: userStoreId, companyId, id, companyName } = req.session.user || {};
      const safeStoreId = userStoreId || undefined;
      
      console.log("Dane użytkownika:", { 
        role, 
        id, 
        userStoreId: safeStoreId, 
        companyId, 
        companyName 
      });
      
      // Sprawdź, czy parametr wyszukiwania jest zdefiniowany i nie jest pusty
      // Unikaj false-positive przy "undefined", "null", itp.
      let searchParam = undefined;
      if (search && 
          typeof search === 'string' && 
          search.trim().length > 0 && 
          search !== 'undefined' && 
          search !== 'null') {
        searchParam = search.trim();
        console.log("Parametr wyszukiwania:", searchParam);
      }
      
      // Obsługa zaawansowanych filtrów z frontendu
      let advancedFilters: any = {};
      
      // Obsługa parametrów dat bezpośrednio z zapytania
      if (installationDateFrom && typeof installationDateFrom === 'string') {
        advancedFilters.installationDateFrom = new Date(installationDateFrom);
        console.log("Filtr instalacji od:", advancedFilters.installationDateFrom);
      }
      
      if (installationDateTo && typeof installationDateTo === 'string') {
        advancedFilters.installationDateTo = new Date(installationDateTo);
        console.log("Filtr instalacji do:", advancedFilters.installationDateTo);
      }
      
      if (transportDateFrom && typeof transportDateFrom === 'string') {
        advancedFilters.transportDateFrom = new Date(transportDateFrom);
        console.log("Filtr transportu od:", advancedFilters.transportDateFrom);
      }
      
      if (transportDateTo && typeof transportDateTo === 'string') {
        advancedFilters.transportDateTo = new Date(transportDateTo);
        console.log("Filtr transportu do:", advancedFilters.transportDateTo);
      }
      
      // Obsługa zaawansowanych filtrów z formatu JSON (dla kompatybilności wstecznej)
      if (filtersStr && typeof filtersStr === 'string') {
        try {
          const parsedFilters = JSON.parse(filtersStr);
          console.log("Parsowane filtry zaawansowane:", parsedFilters);
          
          // Przekształć filtry zaawansowane do formatu zrozumiałego dla storage
          const jsonFilters = {
            // Filtry statusu instalacji
            installationStatus: parsedFilters.status?.map((f: any) => f.value),
            
            // Filtry statusu transportu
            transportStatus: parsedFilters.transportStatus?.map((f: any) => f.value),
            
            // Filtry dat instalacji (tylko jeśli nie zostały już dodane z query params)
            ...((!advancedFilters.installationDateFrom && parsedFilters.dateRange?.find((f: any) => 
              f.type === 'dateRange' && f.label.includes('Montaż'))?.value?.from) ? {
              installationDateFrom: parsedFilters.dateRange?.find((f: any) => 
                f.type === 'dateRange' && f.label.includes('Montaż'))?.value?.from
            } : {}),
            
            ...((!advancedFilters.installationDateTo && parsedFilters.dateRange?.find((f: any) => 
              f.type === 'dateRange' && f.label.includes('Montaż'))?.value?.to) ? {
              installationDateTo: parsedFilters.dateRange?.find((f: any) => 
                f.type === 'dateRange' && f.label.includes('Montaż'))?.value?.to
            } : {}),
            
            // Filtry dat transportu (tylko jeśli nie zostały już dodane z query params)
            ...((!advancedFilters.transportDateFrom && parsedFilters.dateRange?.find((f: any) => 
              f.type === 'dateRange' && f.label.includes('Transport'))?.value?.from) ? {
              transportDateFrom: parsedFilters.dateRange?.find((f: any) => 
                f.type === 'dateRange' && f.label.includes('Transport'))?.value?.from
            } : {}),
            
            ...((!advancedFilters.transportDateTo && parsedFilters.dateRange?.find((f: any) => 
              f.type === 'dateRange' && f.label.includes('Transport'))?.value?.to) ? {
              transportDateTo: parsedFilters.dateRange?.find((f: any) => 
                f.type === 'dateRange' && f.label.includes('Transport'))?.value?.to
            } : {}),
            
            // Filtry rozliczenia
            isSettled: parsedFilters.settlement?.map((f: any) => f.value),
            
            // Filtry transportu
            transportNeeded: parsedFilters.transport?.map((f: any) => f.value),
            
            // Filtry typu usługi
            serviceType: parsedFilters.serviceType?.map((f: any) => f.value),
            
            // Filtry sklepu
            storeId: parsedFilters.store?.map((f: any) => f.value),
          };
          
          // Połącz filtry z query params i filtry z JSON
          advancedFilters = {...advancedFilters, ...jsonFilters};
          
          console.log("Przygotowane filtry zaawansowane:", advancedFilters);
        } catch (e) {
          console.error("Błąd parsowania filtrów zaawansowanych:", e);
        }
      }
      
      // Obsługa prostych filtrów (dla kompatybilności wstecznej)
      const realStatus = status === 'all' ? undefined : status as string;
      const storeId = store && store !== 'all' ? parseInt(store as string) : undefined;
      
      // Przygotuj filtry na podstawie roli użytkownika
      let roleBasedFilters: {
        storeId?: number,
        companyId?: number,
        installerId?: number,
        installerWithCompany?: boolean
      } = {};
      
      if (role === 'worker') {
        console.log("Użytkownik jest pracownikiem sklepu - filtrowanie po sklepie:", safeStoreId);
        // Pracownicy widzą tylko zlecenia ze swojego sklepu
        roleBasedFilters.storeId = safeStoreId;
      } else if (role === 'company') {
        console.log("Użytkownik jest firmą - filtrowanie po firmie:", companyId);
        // Firmy widzą tylko zlecenia przypisane do nich
        roleBasedFilters.companyId = companyId;
      } else if (role === 'installer') {
        // Sprawdź czy montażysta ma przypisaną firmę (właściciel)
        console.log("Użytkownik jest montażystą:", id);
        console.log("Dane montażysty:", { companyId, companyName });
        
        if (companyId && companyName) {
          // Montażysta z przypisaną firmą (właściciel) - może widzieć wszystkie zlecenia firmy
          console.log('Montażysta z przypisaną firmą:', id, companyId);
          
          // Przekaż specjalny parametr do metody getOrders
          roleBasedFilters.installerId = id;
          roleBasedFilters.companyId = companyId;
          roleBasedFilters.installerWithCompany = true;
          
          console.log("Filtry oparte na roli montażysty-właściciela firmy:", roleBasedFilters);
        } else {
          // Zwykły montażysta - widzi tylko swoje zlecenia
          console.log("Zwykły montażysta - filtrowanie po id montażysty:", id);
          roleBasedFilters.installerId = id;
        }
      } else {
        console.log("Użytkownik jest adminem - brak filtrowania po roli");
      }
      
      // Połącz wszystkie filtry
      const finalFilters = {
        // Filtry wyszukiwania i proste filtry
        search: searchParam,
        status: realStatus,
        storeId: storeId || roleBasedFilters.storeId,
        
        // Filtry oparte na roli
        ...roleBasedFilters,
        
        // Zaawansowane filtry
        ...advancedFilters,
        
        // Parametry filtrowania dat bezpośrednio z URL
        installationDateFrom: installationDateFrom ? new Date(installationDateFrom as string) : undefined,
        installationDateTo: installationDateTo ? new Date(installationDateTo as string) : undefined,
        transportDateFrom: transportDateFrom ? new Date(transportDateFrom as string) : undefined,
        transportDateTo: transportDateTo ? new Date(transportDateTo as string) : undefined
      };
      
      console.log("Finalne filtry dla zapytania getOrders:", finalFilters);
      
      // Pobierz odpowiednio filtrowane zlecenia
      let orders = await storage.getOrders(finalFilters);
      console.log(`Znaleziono ${orders.length} zleceń dla filtrów:`, finalFilters);
      
      res.status(200).json(orders);
    } catch (error) {
      console.error("Błąd przy pobieraniu zleceń:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.get("/api/orders/recent", authMiddleware, async (req: Request, res: Response) => {
    try {
      console.log("Otrzymano zapytanie na /api/orders/recent");
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      console.log("Limit zleceń:", limit);
      
      // Pobierz dane użytkownika z sesji
      const { role, storeId, companyId, id, companyName } = req.session.user || {};
      console.log("Dane użytkownika:", { role, id, storeId, companyId, companyName });
      
      // Pobierz wszystkie ostatnie zlecenia
      let recentOrders = await storage.getRecentOrders(limit);
      console.log(`Pobrano ${recentOrders.length} ostatnich zleceń`);
      
      // Filtruj zlecenia na podstawie roli użytkownika
      if (role === 'worker') {
        console.log("Filtrowanie dla pracownika sklepu (storeId):", storeId);
        // Pracownicy widzą tylko zlecenia ze swojego sklepu
        recentOrders = recentOrders.filter(order => order.storeId === storeId);
      } else if (role === 'company') {
        console.log("Filtrowanie dla firmy (companyId):", companyId);
        // Firmy widzą tylko zlecenia przypisane do nich
        recentOrders = recentOrders.filter(order => order.companyId === companyId);
      } else if (role === 'installer') {
        console.log("Filtrowanie dla montażysty:", id);
        // Montażyści widzą tylko zlecenia przypisane do nich lub do ich firmy
        // Jeśli montażysta ma przypisaną firmę (właściciel), powinien widzieć wszystkie zlecenia firmy
        if (companyId && companyName) {
          console.log("Montażysta z przypisaną firmą - właściciel:", { installerId: id, companyId });
          // Montażysta z przypisaną firmą - prawdopodobnie właściciel
          const beforeFilter = recentOrders.length;
          recentOrders = recentOrders.filter(order => 
            order.installerId === id || order.companyId === companyId
          );
          console.log(`Filtrowanie: przed=${beforeFilter}, po=${recentOrders.length}`);
          
          // Dla debugowania wypisz zlecenia z firmą
          const companyOrders = recentOrders.filter(order => order.companyId === companyId);
          console.log(`Zlecenia z firmą ${companyId}:`, companyOrders.length);
          if (companyOrders.length > 0) {
            console.log("Przykładowe zlecenie firmy:", JSON.stringify(companyOrders[0], null, 2));
          }
        } else {
          console.log("Zwykły montażysta - filtruje tylko po installerId:", id);
          // Zwykły montażysta - widzi tylko swoje zlecenia
          recentOrders = recentOrders.filter(order => order.installerId === id);
        }
      }
      
      console.log(`Po filtrowaniu znaleziono ${recentOrders.length} zleceń`);
      res.status(200).json(recentOrders);
    } catch (error) {
      console.error("Błąd przy pobieraniu ostatnich zleceń:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpoint do uploadowania zdjęć (obsługuje wiele plików i różne typy: montaż/reklamacja)
  app.post('/api/orders/:id/photos', authMiddleware, upload.array('photos', 5), async (req: Request, res: Response) => {
    try {
      // Sprawdź, czy to zdjęcia reklamacji czy instalacji
      const photoType = req.query.type === 'complaint' ? 'complaint' : 'installation';
      console.log(`Rozpoczęto przesyłanie zdjęć (typ: ${photoType})`);
      
      const orderId = parseInt(req.params.id);
      
      if (isNaN(orderId)) {
        console.log("Nieprawidłowe ID zlecenia:", req.params.id);
        return res.status(400).json({ message: "Nieprawidłowe ID zlecenia" });
      }
      
      console.log("Pobieranie zlecenia:", orderId);
      // Zweryfikuj, czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.log("Zlecenie nie znalezione:", orderId);
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Sprawdź uprawnienia użytkownika
      const userId = req.session.user?.id;
      const userRole = req.session.user?.role;
      const userStoreId = req.session.user?.storeId;
      const userCompanyId = req.session.user?.companyId;
      
      console.log("Dane użytkownika:", { userId, userRole, userStoreId, userCompanyId });
      console.log("Dane zlecenia:", { 
        orderId: order.id, 
        storeId: order.storeId, 
        companyId: order.companyId, 
        installerId: order.installerId 
      });
      
      if (!userId) {
        console.log("Użytkownik nie zalogowany");
        return res.status(401).json({ message: "Nie jesteś zalogowany" });
      }
      
      // Admini, pracownicy sklepu, firmy i przypisani montażyści mogą dodawać zdjęcia
      if (
        userRole !== 'admin' && 
        !(userRole === 'worker' && userStoreId === order.storeId) &&
        !(userRole === 'company' && userCompanyId === order.companyId) &&
        !(userRole === 'installer' && userId === order.installerId)
      ) {
        console.log("Brak uprawnień do dodawania zdjęć do tego zlecenia");
        return res.status(403).json({ message: "Brak uprawnień do dodawania zdjęć do tego zlecenia" });
      }
      
      // Jeśli to zdjęcia reklamacji, sprawdź czy status jest odpowiedni
      if (photoType === 'complaint' && order.installationStatus !== 'reklamacja') {
        console.log("Próba dodania zdjęć reklamacji dla zlecenia bez statusu reklamacji");
        return res.status(400).json({ 
          message: "Nie można dodać zdjęć reklamacji do zlecenia, które nie ma statusu reklamacji" 
        });
      }
      
      console.log("Analizowanie przesłanych plików...");
      console.log("req.files:", req.files);
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        console.log("Nie przesłano żadnych plików");
        return res.status(400).json({ message: "Nie przesłano żadnych plików" });
      }
      
      console.log(`Otrzymano ${files.length} plików:`, files.map(f => f.originalname).join(', '));
      
      // Konwertuj pliki na dane binarne i zapisz je w bazie danych
      const savedPhotoIds = [];
      const savedPhotoUrls = [];
      
      for (const file of files) {
        try {
          console.log(`Przetwarzanie pliku: ${file.originalname}, ścieżka: ${file.path}, rozmiar: ${file.size}B`);
          
          // Sprawdź czy plik istnieje
          if (!fs.existsSync(file.path)) {
            console.error(`Plik nie istnieje pod ścieżką: ${file.path}`);
            continue;
          }
          
          // Generuj unikalną nazwę pliku z zachowaniem oryginalnego rozszerzenia
          const ext = path.extname(file.originalname);
          const uniqueFilename = `${uuid.v4()}${ext}`;
          
          // Docelowa ścieżka pliku w katalogu uploads
          const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
          const targetPath = path.join(uploadsDir, uniqueFilename);
          
          console.log(`Przenoszenie pliku do: ${targetPath}`);
          
          // Upewnij się, że katalog istnieje
          if (!fs.existsSync(uploadsDir)) {
            console.log(`Tworzenie katalogu uploads: ${uploadsDir}`);
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          
          // Przenieś plik z tymczasowej lokalizacji do docelowej
          fs.copyFileSync(file.path, targetPath);
          console.log(`Plik skopiowany do docelowej lokalizacji`);
          
          // Zapisz informacje o zdjęciu w bazie danych
          console.log("Zapisywanie metadanych zdjęcia w bazie danych...");
          const savedPhoto = await storage.savePhoto({
            orderId,
            filename: uniqueFilename,
            originalFilename: file.originalname,
            mimetype: file.mimetype,
            filePath: targetPath,
            fileSize: file.size,
            type: photoType // Zapisz typ zdjęcia
          });
          
          console.log(`Metadane zdjęcia zapisane w bazie danych, ID: ${savedPhoto.id}`);
          savedPhotoIds.push(savedPhoto.id);
          
          // Generuj URL do pobrania zdjęcia
          savedPhotoUrls.push(`/api/photos/${savedPhoto.id}`);
          console.log(`Wygenerowano URL: /api/photos/${savedPhoto.id}`);
          
          // Usuń tymczasowy plik
          fs.unlinkSync(file.path);
          console.log(`Usunięto plik tymczasowy: ${file.path}`);
        } catch (error) {
          console.error("Błąd podczas zapisywania zdjęcia:", error);
        }
      }
      
      // W zależności od typu, aktualizuj odpowiednie pole zdjęć
      if (photoType === 'complaint') {
        // Pobierz obecne zdjęcia reklamacji
        const currentPhotos = order.complaintPhotos || [];
        
        // Połącz stare i nowe zdjęcia
        const updatedPhotos = [...currentPhotos, ...savedPhotoUrls];
        
        // Aktualizuj zlecenie dodając nowe zdjęcia reklamacji
        const updatedOrder = await storage.updateOrderStatus(orderId, {
          installationStatus: normalizeInstallationStatus(order.installationStatus),
          complaintPhotos: updatedPhotos,
          transportStatus: normalizeTransportStatus(order.transportStatus)
        });
        
        if (!updatedOrder) {
          return res.status(500).json({ message: "Nie udało się zaktualizować zdjęć reklamacji" });
        }
        
        res.status(200).json({ 
          photos: updatedPhotos,
          message: "Zdjęcia reklamacji zaktualizowane pomyślnie"
        });
      } else {
        // Zdjęcia instalacji - tylko zapisz informacje o zdjęciach, nie aktualizuj zlecenia
        res.status(200).json({ 
          photoIds: savedPhotoIds,
          photoUrls: savedPhotoUrls,
          message: "Zdjęcia montażu zapisane pomyślnie"
        });
      }
    } catch (error) {
      console.error("Upload photos error:", error);
      res.status(500).json({ message: "Błąd serwera przy przesyłaniu zdjęć" });
    }
  });

  // Endpoint do wyczyszczenia zdjęć reklamacji
  app.delete('/api/orders/:id/photos', authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID zlecenia" });
      }
      
      // Zweryfikuj, czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Sprawdź uprawnienia użytkownika
      const userId = req.session.user?.id;
      const userRole = req.session.user?.role;
      const userStoreId = req.session.user?.storeId;
      const userCompanyId = req.session.user?.companyId;
      
      if (!userId) {
        return res.status(401).json({ message: "Nie jesteś zalogowany" });
      }
      
      // Tylko admin, pracownik sklepu lub firma mogą usuwać zdjęcia
      if (
        userRole !== 'admin' && 
        !(userRole === 'worker' && userStoreId === order.storeId) &&
        !(userRole === 'company' && userCompanyId === order.companyId)
      ) {
        return res.status(403).json({ message: "Brak uprawnień do usuwania zdjęć" });
      }
      
      // Pobierz aktualne zdjęcia
      const currentPhotos = order.complaintPhotos || [];
      
      // Obsługa usuwania po nazwie pliku (teraz po URL)
      if (req.body.photo && typeof req.body.photo === 'string') {
        const photoUrl = req.body.photo;
        console.log(`Usuwanie zdjęcia o URL: ${photoUrl}`);
        
        // Usuń określone zdjęcie po URL
        const updatedPhotos = currentPhotos.filter(photo => photo !== photoUrl);
        
        // Jeśli ilość zdjęć nie zmieniła się, to znaczy że nie znaleziono zdjęcia
        if (updatedPhotos.length === currentPhotos.length) {
          return res.status(404).json({ message: "Nie znaleziono zdjęcia o podanym URL" });
        }
        
        // Jeśli URL zawiera ID zdjęcia (format /api/photos/ID), spróbuj usunąć zdjęcie z bazy danych
        const photoIdMatch = photoUrl.match(/\/api\/photos\/(\d+)/);
        
        if (photoIdMatch && photoIdMatch[1]) {
          const photoId = parseInt(photoIdMatch[1]);
          console.log(`Znaleziono ID zdjęcia: ${photoId}, próba usunięcia z bazy danych`);
          
          try {
            const deleted = await storage.deletePhoto(photoId);
            console.log(`Usunięcie zdjęcia z bazy danych: ${deleted ? 'sukces' : 'niepowodzenie'}`);
          } catch (error) {
            console.error("Błąd przy usuwaniu zdjęcia z bazy danych:", error);
            // Kontynuuj mimo błędu - ważniejsze jest usunięcie referencji
          }
        }
        
        // Aktualizuj zlecenie
        const updatedOrder = await storage.updateOrderStatus(orderId, {
          installationStatus: normalizeInstallationStatus(order.installationStatus || 'Reklamacja'),
          transportStatus: normalizeTransportStatus(order.transportStatus),
          complaintPhotos: updatedPhotos
        });
        
        if (!updatedOrder) {
          return res.status(500).json({ message: "Nie udało się zaktualizować zdjęć reklamacji" });
        }
        
        res.status(200).json({
          photos: updatedPhotos,
          message: "Zdjęcie zostało usunięte"
        });
      }
      // Obsługa usuwania po indeksach
      else if (req.body.photoIndexes && Array.isArray(req.body.photoIndexes)) {
        try {
          const photoIndexes = req.body.photoIndexes;
          console.log(`Usuwanie zdjęć o indeksach: ${photoIndexes.join(', ')}`);
          
          // Wybierz zdjęcia, które mają zostać usunięte
          const photosToDelete = photoIndexes.map((index: number) => currentPhotos[index]).filter(Boolean);
          
          // Usuń zdjęcia z bazy danych, jeśli URL zawiera ID zdjęcia
          for (const photoUrl of photosToDelete) {
            const photoIdMatch = photoUrl?.match(/\/api\/photos\/(\d+)/);
            
            if (photoIdMatch && photoIdMatch[1]) {
              const photoId = parseInt(photoIdMatch[1]);
              console.log(`Znaleziono ID zdjęcia: ${photoId}, próba usunięcia z bazy danych`);
              
              try {
                const deleted = await storage.deletePhoto(photoId);
                console.log(`Usunięcie zdjęcia z bazy danych: ${deleted ? 'sukces' : 'niepowodzenie'}`);
              } catch (error) {
                console.error("Błąd przy usuwaniu zdjęcia z bazy danych:", error);
                // Kontynuuj mimo błędu - ważniejsze jest usunięcie referencji
              }
            }
          }
          
          // Usuń wybrane zdjęcia wg indeksów
          const updatedPhotos = currentPhotos.filter((_: string, index: number) => !photoIndexes.includes(index));
          
          // Aktualizuj zlecenie
          const updatedOrder = await storage.updateOrderStatus(orderId, {
            installationStatus: (order.installationStatus || 'Reklamacja'),
            transportStatus: normalizeTransportStatus(order.transportStatus),
            complaintPhotos: updatedPhotos
          });
          
          if (!updatedOrder) {
            return res.status(500).json({ message: "Nie udało się zaktualizować zdjęć reklamacji" });
          }
          
          res.status(200).json({
            photos: updatedPhotos,
            message: "Wybrane zdjęcia zostały usunięte"
          });
        } catch (error) {
          console.error("Błąd podczas usuwania wybranych zdjęć:", error);
          res.status(500).json({ message: "Wystąpił błąd podczas usuwania zdjęć" });
        }
      } 
      // Usuwanie wszystkich zdjęć
      else {
        try {
          // Pobierz wszystkie zdjęcia dla tego zlecenia
          const orderPhotos = await storage.getOrderPhotos(orderId);
          
          // Usuń każde zdjęcie z bazy danych
          for (const photo of orderPhotos) {
            await storage.deletePhoto(photo.id);
            console.log(`Usunięto zdjęcie z bazy danych: ID=${photo.id}`);
          }
          
          // Usuń wszystkie referencje do zdjęć w zamówieniu
          const updatedOrder = await storage.updateOrderStatus(orderId, {
            installationStatus: normalizeInstallationStatus(order.installationStatus || 'Reklamacja'),
            transportStatus: normalizeTransportStatus(order.transportStatus),
            complaintPhotos: []
          });
          
          if (!updatedOrder) {
            return res.status(500).json({ message: "Nie udało się usunąć zdjęć reklamacji" });
          }
          
          res.status(200).json({
            photos: [],
            message: "Wszystkie zdjęcia zostały usunięte"
          });
        } catch (error) {
          console.error("Błąd podczas usuwania wszystkich zdjęć:", error);
          res.status(500).json({ message: "Wystąpił błąd podczas usuwania zdjęć" });
        }
      }
    } catch (error) {
      console.error("Delete complaint photos error:", error);
      res.status(500).json({ message: "Błąd serwera przy usuwaniu zdjęć reklamacji" });
    }
  });

  // Endpoint do pobierania zdjęć z bazy danych
  app.get('/api/photos/:id', async (req: Request, res: Response) => {
    try {
      console.log("Pobieranie zdjęcia o ID:", req.params.id);
      const photoId = parseInt(req.params.id);
      
      if (isNaN(photoId)) {
        console.log("Nieprawidłowe ID zdjęcia:", req.params.id);
        return res.status(400).json({ message: "Nieprawidłowe ID zdjęcia" });
      }
      
      // Pobierz zdjęcie z bazy danych
      console.log("Szukam zdjęcia w bazie danych, ID:", photoId);
      const photo = await storage.getPhoto(photoId);
      
      if (!photo) {
        console.log("Nie znaleziono zdjęcia o ID:", photoId);
        return res.status(404).json({ message: "Zdjęcie nie znalezione" });
      }
      
      console.log("Znaleziono zdjęcie:", {
        id: photo.id,
        filename: photo.filename,
        originalFilename: photo.originalFilename,
        mimetype: photo.mimetype,
        orderId: photo.orderId,
        filePath: photo.filePath,
        fileSize: photo.fileSize
      });
      
      // Pobierz powiązane zlecenie
      console.log("Pobieranie powiązanego zlecenia o ID:", photo.orderId);
      const order = await storage.getOrder(photo.orderId);
      
      if (!order) {
        console.log("Nie znaleziono powiązanego zlecenia o ID:", photo.orderId);
        return res.status(404).json({ message: "Powiązane zlecenie nie znalezione" });
      }
      
      console.log("Znaleziono powiązane zlecenie:", {
        id: order.id,
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        storeId: order.storeId,
        companyId: order.companyId,
        installerId: order.installerId
      });
      
      // Sprawdź uprawnienia dostępu (opcjonalnie, w zależności od wymagań bezpieczeństwa)
      if (req.session.user) {
        const { role, storeId, companyId, id } = req.session.user;
        console.log("Dane użytkownika próbującego dostępu:", { role, storeId, companyId, id });
        
        // Admin ma dostęp do wszystkich zdjęć
        if (role === 'admin') {
          // noop
        }
        // Pracownik sklepu - dostęp tylko do zleceń ze swojego sklepu
        else if (role === 'worker' && order.storeId !== storeId) {
          return res.status(403).json({ message: "Brak dostępu do tego zdjęcia" });
        }
        // Firma - dostęp tylko do zleceń przypisanych do niej
        else if (role === 'company' && order.companyId !== companyId) {
          return res.status(403).json({ message: "Brak dostępu do tego zdjęcia" });
        }
        // Montażysta - dostęp do zleceń przypisanych do niego
        else if (role === 'installer' && order.installerId !== id) {
          return res.status(403).json({ message: "Brak dostępu do tego zdjęcia" });
        }
      } else {
        // Brak zalogowanego użytkownika - odmówić dostępu
        return res.status(401).json({ message: "Nieautoryzowany dostęp" });
      }
      
      // Odczytaj plik z dysku
      try {
        console.log(`Odczytywanie pliku z dysku: ${photo.filePath}`);
        if (!fs.existsSync(photo.filePath)) {
          console.error(`Plik nie istnieje fizycznie: ${photo.filePath}`);
          return res.status(404).json({ message: "Plik zdjęcia nie został znaleziony na serwerze" });
        }
        
        // Sprawdź rozmiar pliku
        const stat = fs.statSync(photo.filePath);
        console.log(`Plik istnieje, rozmiar: ${stat.size}B`);
        
        // Ustaw odpowiednie nagłówki HTTP
        res.setHeader('Content-Type', photo.mimetype);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${photo.originalFilename}"`);
        
        // Streomowanie pliku jako odpowiedź
        const fileStream = fs.createReadStream(photo.filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error(`Błąd podczas odczytu pliku: ${photo.filePath}`, error);
        return res.status(500).json({ message: "Błąd serwera przy odczycie pliku zdjęcia" });
      }
      
    } catch (error) {
      console.error("Błąd podczas pobierania zdjęcia:", error);
      res.status(500).json({ message: "Błąd serwera przy pobieraniu zdjęcia" });
    }
  });

  app.get("/api/orders/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      console.log(`Otrzymano zapytanie o zlecenie ${orderId}`);
      
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        console.log(`Zlecenie ${orderId} nie znalezione`);
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      console.log(`Znaleziono zlecenie ${orderId}: companyId=${order.companyId}, installerId=${order.installerId}`);
      
      // Check if user has access to this order
      const { role, storeId, companyId, id, companyName } = req.session.user || {};
      console.log(`Dane użytkownika: role=${role}, id=${id}, companyId=${companyId}, companyName=${companyName}, storeId=${storeId}`);
      
      // Pracownik sklepu - dostęp tylko do zleceń ze swojego sklepu
      if (role === 'worker' && order.storeId !== storeId) {
        console.log(`Użytkownik (worker) nie ma dostępu: order.storeId=${order.storeId} !== userStoreId=${storeId}`);
        return res.status(403).json({ message: "Brak dostępu do tego zlecenia" });
      }
      
      // Firma - dostęp tylko do zleceń przypisanych do niej
      if (role === 'company' && order.companyId !== companyId) {
        console.log(`Użytkownik (company) nie ma dostępu: order.companyId=${order.companyId} !== userCompanyId=${companyId}`);
        return res.status(403).json({ message: "Brak dostępu do tego zlecenia" });
      }
      
      // Montażysta - dostęp do zleceń przypisanych do niego lub do jego firmy
      if (role === 'installer') {
        const isInstallerAssigned = order.installerId === id;
        const isCompanyOwner = !!companyId && !!companyName;
        const isOrderAssignedToCompany = isCompanyOwner && order.companyId === companyId;
        
        console.log(`Sprawdzam dostęp montażysty: isInstallerAssigned=${isInstallerAssigned}, isCompanyOwner=${isCompanyOwner}, isOrderAssignedToCompany=${isOrderAssignedToCompany}`);
        console.log(`Dane sprawdzenia: order.installerId=${order.installerId}, userId=${id}, order.companyId=${order.companyId}, userCompanyId=${companyId}`);
        
        if (!isInstallerAssigned && !isOrderAssignedToCompany) {
          console.log(`Użytkownik (installer) nie ma dostępu do zlecenia`);
          return res.status(403).json({ message: "Brak dostępu do tego zlecenia" });
        }
        
        console.log(`Montażysta ma dostęp do zlecenia: ${isInstallerAssigned ? 'przypisany montażysta' : 'właściciel firmy'}`);
        
        // AUTONAPRAWA: Dla firmy jednoosobowej dodajemy automatyczne przypisanie transportera
        // Sprawdzamy, czy zlecenie wymaga transportu, czy firma jednoosobowa jest właścicielem
        // i czy transportera nie ma jeszcze przypisanego
        console.log(`AUTONAPRAWA: Sprawdzam warunki naprawy dla zlecenia ${orderId}`);
        console.log(`isCompanyOwner=${isCompanyOwner}, order.withTransport=${order.withTransport}, !order.transporterId=${!order.transporterId}, req.session.user?.services=${req.session.user?.services}`);
        
        if (isCompanyOwner && order.withTransport && !order.transporterId && req.session.user?.services) {
          console.log(`AUTONAPRAWA: Sprawdzam możliwość przypisania transportera do zlecenia ${orderId}`);
          console.log(`Usługi montażysty: ${JSON.stringify(req.session.user.services)}`);
          
          // Sprawdź czy montażysta ma usługę transportu
          const hasTransportService = req.session.user.services.some(s => 
            typeof s === 'string' && s.toLowerCase().includes('transport'));
          
          console.log(`AUTONAPRAWA: Montażysta ma usługę transportu: ${hasTransportService}`);
          
          if (hasTransportService) {
            console.log(`AUTONAPRAWA: Montażysta ma usługę transportu - przypisuję jako transportera`);
            
            // Data montażu jako jutro jeśli nie jest ustawiona
            const installationDate = order.installationDate ? new Date(order.installationDate) : (() => {
              const date = new Date();
              date.setDate(date.getDate() + 2);
              return date;
            })();
            
            // Ustal datę transportu na podstawie daty montażu lub ustaw na jutro
            const transportDate = new Date();
            transportDate.setDate(transportDate.getDate() + 1);
            
            const transportDateStr = format(transportDate, 'yyyy-MM-dd');
            console.log(`AUTONAPRAWA: Ustawiono datę transportu na ${transportDateStr}`);
            
            // Upewnij się, że id nie jest undefined
            if (!id) {
              return res.status(400).json({ message: "Brak ID transportera" });
            }
            
            const transportData = {
              transporterId: id,
              transportDate: new Date(transportDateStr),
              transportStatus: normalizeTransportStatus('zaplanowany')
            };
            
            console.log(`AUTONAPRAWA: Przypisuję transportera z danymi:`, transportData);
            
            // Przypisz montażystę jako transportera
            const updatedOrder = await storage.assignTransporterToOrder(orderId, transportData);
            
            if (updatedOrder) {
              console.log(`AUTONAPRAWA: Pomyślnie przypisano transportera ${id} do zlecenia ${orderId}`);
              // Zwróć zaktualizowane zlecenie
              return res.status(200).json(updatedOrder);
            }
          }
        }
      }
      
      console.log(`Użytkownik ma dostęp do zlecenia ${orderId}`);
      res.status(200).json(order);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.post("/api/orders", authMiddleware, anyWorkerOrAdmin, async (req: Request, res: Response) => {
    try {
      console.log("Otrzymane dane zamówienia:", req.body);
      
      // Ensure companyId is a string in the input
      if (req.body.companyId && typeof req.body.companyId === 'number') {
        req.body.companyId = req.body.companyId.toString();
      }

      try {
        // Sprawdź czy wybrana firma istnieje
        const companyId = typeof req.body.companyId === 'string' ? parseInt(req.body.companyId) : req.body.companyId;
        
        const company = await storage.getCompany(companyId);
        if (!company) {
          return res.status(400).json({ 
            message: "Wybrana firma nie istnieje",
            errors: [{ path: ["companyId"], message: "Wybrana firma nie istnieje w systemie" }]
          });
        }
        
        // Dodaj nazwę firmy do danych, aby zapewnić kompletność danych
        req.body.companyName = company.name;

        // Validate order data
        const orderData = insertOrderSchema.parse(req.body);
        console.log("Dane zamówienia po walidacji Zod:", orderData);
        
        // Add user information
        const userId = req.session.user?.id;
        if (!userId) {
          return res.status(401).json({ message: "Nie jesteś zalogowany" });
        }
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(401).json({ message: "Użytkownik nie znaleziony" });
        }
        
        // Generate orderNumber
        const currentDate = new Date();
        const orderNumber = `ZL-${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 9000 + 1000)}`;
        
        console.log("Tworzenie zamówienia z danymi:", {
          ...orderData,
          userId,
          userName: user.name || "Unknown User",
          orderNumber
        });
        
        // Create order with all required fields
        const orderToCreate = {
          ...orderData,
          userId,
          userName: user.name || "Unknown User",
          orderNumber,
          installationStatus: "Nowe"  // Dodanie domyślnego statusu
        };
        
        // Sprawdź, czy wybrana firma jest firma montażystą-właścicielem
        if (orderToCreate.companyId) {
          const companyId = typeof orderToCreate.companyId === 'string' 
            ? parseInt(orderToCreate.companyId)
            : orderToCreate.companyId;
            
          console.log(`Sprawdzanie montażysty-właściciela dla firmy ${companyId}...`);
          
          try {
            // Pobierz wszystkich użytkowników z rolą 'installer' 
            const allInstallers = await storage.getUsersByRole('installer');
            console.log(`Znaleziono ${allInstallers.length} montażystów w systemie`);
            
            // Znajdź instalatora który jest właścicielem tej firmy
            const installerOwner = allInstallers.find(installer => 
              installer.companyId === companyId && 
              installer.companyName === orderToCreate.companyName
            );
            
            if (installerOwner) {
              console.log(`Znaleziono montażystę-właściciela: ${installerOwner.name} (ID: ${installerOwner.id}) dla firmy ${orderToCreate.companyName}`);
              
              // Automatyczne przypisanie właściciela jako montażysty
              orderToCreate.installerId = installerOwner.id;
              orderToCreate.installerName = installerOwner.name;
              
              // Zmiana statusu na "w realizacji" gdy przypisujemy montażystę
              orderToCreate.status = "w realizacji";
              
              console.log(`Automatycznie przypisano montażystę-właściciela. Dane zlecenia:`, {
                installerId: orderToCreate.installerId,
                installerName: orderToCreate.installerName,
                installationStatus: orderToCreate.installationStatus
              });
            } else {
              console.log(`Nie znaleziono montażysty-właściciela dla firmy ${orderToCreate.companyName} (ID: ${companyId})`);
            }
          } catch (error) {
            console.error(`Błąd podczas sprawdzania montażysty-właściciela:`, error);
          }
        }
        
        // Create order
        const order = await storage.createOrder(orderToCreate);
        
        // Send notifications
        await sendOrderNotifications(order.id, "new");
        
        res.status(201).json(order);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          console.error("Błąd walidacji Zod:", JSON.stringify(zodError.errors, null, 2));
          return res.status(400).json({ message: "Nieprawidłowe dane", errors: zodError.errors });
        }
        throw zodError;
      }
    } catch (error) {
      console.error("Błąd podczas tworzenia zamówienia:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Błąd serwera" });
    }
  });

  // Endpoint do przypisywania montażysty i terminu montażu do zlecenia
  app.patch("/api/orders/:id/assign-installer", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      // Walidacja danych
      const { installerId, installationDate } = req.body;
      
      if (!installerId || !installationDate) {
        return res.status(400).json({ 
          message: "Brak wymaganych danych", 
          errors: [
            { path: ["installerId"], message: "ID montażysty jest wymagane" },
            { path: ["installationDate"], message: "Data montażu jest wymagana" }
          ]
        });
      }
      
      // Sprawdź czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Sprawdź uprawnienia - admin, firma przypisana do zlecenia lub montażysta-właściciel firmy
      const { role, companyId, companyName, id } = req.session.user!;
      
      console.log(`Sprawdzam uprawnienia: role=${role}, companyId=${companyId}, orderId=${orderId}, order.companyId=${order.companyId}`);
      
      // Montażysta-właściciel firmy jednosobowej (ma przypisaną firmę)
      const isOnePersonCompanyOwner = role === 'installer' && companyId && companyName && order.companyId === companyId;
      
      if (role !== 'admin' && role !== 'company' && !isOnePersonCompanyOwner) {
        console.log(`Brak uprawnień - użytkownik nie jest adminem, firmą ani właścicielem firmy jednosobowej`);
        return res.status(403).json({ message: "Brak uprawnień do przypisania montażysty" });
      }
      
      if (role === 'company' && order.companyId !== companyId) {
        console.log(`Brak uprawnień - firma ${companyId} próbuje edytować zlecenie przypisane do firmy ${order.companyId}`);
        return res.status(403).json({ message: "Możesz przypisać montażystę tylko do zleceń swojej firmy" });
      }
      
      if (isOnePersonCompanyOwner && order.companyId !== companyId) {
        console.log(`Brak uprawnień - właściciel firmy ${companyId} próbuje edytować zlecenie przypisane do firmy ${order.companyId}`);
        return res.status(403).json({ message: "Możesz przypisać montażystę tylko do zleceń swojej firmy" });
      }
      
      // Sprawdź czy montażysta istnieje i należy do firmy
      const installer = await storage.getUser(installerId);
      if (!installer) {
        return res.status(404).json({ message: "Montażysta nie znaleziony" });
      }
      
      if (installer.role !== 'installer') {
        return res.status(400).json({ message: "Wybrany użytkownik nie jest montażystą" });
      }
      
      // Firma może przypisać tylko swoich montażystów
      if (role === 'company' && installer.companyId !== companyId) {
        return res.status(403).json({ message: "Możesz przypisać tylko montażystów ze swojej firmy" });
      }
      
      // Aktualizuj zlecenie - zmieniamy status montażu zgodnie z przesłaną wartością lub używamy domyślnej
      const installationStatus = req.body.installationStatus || "montaż zaplanowany";
      console.log(`Przypisywanie statusu montażu: ${installationStatus}`);
      
      const updatedOrder = await storage.updateOrder(orderId, {
        installerId,
        installerName: installer.name,
        installationDate: new Date(installationDate),
        installationStatus: installationStatus
      });
      
      // Dodatkowe logowanie dla celów diagnostycznych 
      console.log(`Zaktualizowano zlecenie ${orderId}:`, {
        installerId,
        installerName: installer.name,
        installationDate,
        installationStatus: "montaż zaplanowany"
      });
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Wysłanie powiadomienia do montażysty
      await storage.createNotification({
        userId: installerId,
        title: "Nowe przypisane zlecenie",
        message: `Zostałeś przypisany do zlecenia ${order.orderNumber} na dzień ${new Date(installationDate).toLocaleDateString('pl-PL')}`,
        type: "installation_assigned",
        read: false,
        relatedId: orderId
      });
      
      // Wysyłamy powiadomienia o zmianie statusu montażu
      await sendOrderNotifications(orderId, installationStatus);
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      console.error("Error assigning installer:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpoint do przypisywania transportera do zlecenia
  app.patch("/api/orders/:id/assign-transporter", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      console.log(`Otrzymano zapytanie o przypisanie transportera do zlecenia ${orderId}. Dane:`, req.body);
      
      // Pobranie danych użytkownika
      const { role, companyId, companyName, id } = req.session.user!;
      
      // Uproszczenie logiki walidacji dla firmy jednosobowej
      // Sprawdzamy, czy to może być firma jednosobowa i właściciel przypisuje siebie
      const isCompanyOwner = role === 'installer' && companyId && companyName;
      
      let transporterId = req.body.transporterId;
      let transportDate = req.body.transportDate;
      
      // Pobierz zlecenie na początku - będziemy go używać wielokrotnie
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Sprawdź, czy zlecenie zawiera transport
      if (!order.withTransport) {
        return res.status(400).json({ 
          message: "Nie można ustawić daty transportu - to zlecenie nie zawiera usługi transportu" 
        });
      }
      
      // Sprawdźmy, czy to może być firma jednoosobowa - gdzie montażysta jest już przypisany,
      // a teraz przypisujemy tego samego użytkownika jako transportera
      if (isCompanyOwner && order.installerId === id && order.companyId === companyId) {
        console.log(`Wykryto firmę jednoosobową - montażysta ${id} jest już przypisany do zlecenia ${orderId}`);
        console.log(`Automatycznie przypisuję tego samego użytkownika jako transportera`);
        
        // Automatycznie przypisz tego samego użytkownika jako transportera
        try {
          // Pobierz dane montażysty, aby sprawdzić, czy ma usługę transportu
          const installer = await storage.getUser(id);
          
          if (installer && installer.services) {
            console.log(`Usługi montażysty: ${JSON.stringify(installer.services)}`);
            
            // Sprawdź, czy montażysta ma usługę transportu
            const hasTransportService = installer.services.some(
              service => typeof service === 'string' && service.toLowerCase().includes('transport')
            );
            
            if (hasTransportService) {
              console.log(`Montażysta ${id} ma usługę transportu - automatycznie przypisuję go jako transportera`);
              
              // Pobierz status transportu z żądania lub użyj domyślnego
              const transportStatusValue = req.body.transportStatus || 'zaplanowany';
              // Upewnij się, że status transportu jest jednym z dozwolonych wartości
              const validTransportStatuses = ['skompletowany', 'zaplanowany', 'dostarczony'];
              const transportStatus = validTransportStatuses.includes(transportStatusValue) 
                ? transportStatusValue as 'skompletowany' | 'zaplanowany' | 'dostarczony'
                : 'zaplanowany';
              console.log(`Używany status transportu dla firmy jednoosobowej: ${transportStatus}`);
              
              // Przypisz transportera, ale najpierw zapewniamy prawidłowy typ transportStatus
              const validatedTransportStatus = 
                (transportStatus === 'skompletowany' || 
                 transportStatus === 'zaplanowany' || 
                 transportStatus === 'dostarczony') 
                  ? transportStatus as 'skompletowany' | 'zaplanowany' | 'dostarczony'
                  : 'zaplanowany' as const;
              
              const updatedOrder = await storage.assignTransporterToOrder(orderId, {
                transporterId: id,
                transportDate: transportDate || new Date().toISOString(),
                transportStatus: validatedTransportStatus
              });
              
              if (updatedOrder) {
                console.log(`Pomyślnie przypisano montażystę ${id} jako transportera dla zlecenia ${orderId}`);
                return res.status(200).json(updatedOrder);
              }
            }
          }
        } catch (error) {
          console.error(`Błąd przy automatycznym przypisywaniu transportera: ${error}`);
          // Kontynuuj standardową logikę, jeśli automatyczne przypisanie nie zadziałało
        }
      }
      
      // Jeśli to firma jednosobowa przypisująca samą siebie, traktuj to specjalnie
      if (isCompanyOwner && parseInt(transporterId) === id) {
        console.log(`Wykryto firmę jednosobową przypisującą siebie jako transportera`);
        
        // Jeśli nie podano daty transportu, ustaw automatycznie
        if (!transportDate) {
          const today = new Date();
          today.setDate(today.getDate() + 1); // jutro
          transportDate = today.toISOString().split('T')[0];
          console.log(`Automatycznie ustawiam datę transportu na: ${transportDate}`);
        }
      } else {
        // Standardowa walidacja dla zwykłych przypadków
        // Sprawdźmy format daty transportu przed walidacją
        const rawTransportDate = req.body.transportDate;
        console.log(`Surowa wartość transportDate: ${rawTransportDate}, typ: ${typeof rawTransportDate}`);
        if (rawTransportDate) {
          try {
            const parsedDate = new Date(rawTransportDate);
            console.log(`Parsowanie daty: ${parsedDate.toISOString()}, jest prawidłową datą: ${!isNaN(parsedDate.getTime())}`);
          } catch (e) {
            console.log(`Błąd parsowania daty:`, e);
          }
        }
        
        // Walidacja danych
        let validationData;
        try {
          validationData = assignTransporterSchema.parse(req.body);
          transporterId = validationData.transporterId;
          transportDate = validationData.transportDate;
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            console.log("Błąd walidacji danych:", validationError.errors);
            return res.status(400).json({ 
              message: "Nieprawidłowe dane", 
              errors: validationError.errors 
            });
          }
          throw validationError;
        }
      }
      console.log(`Zwalidowane dane: transporterId=${transporterId}, transportDate=${transportDate}, typ transportDate: ${typeof transportDate}`);
      
      console.log(`Sprawdzam uprawnienia dla transportera: role=${role}, companyId=${companyId}, orderId=${orderId}, order.companyId=${order.companyId}`);
      
      // Sprawdź uprawnienia, biorąc pod uwagę również zlecenie
      let canAssignTransporter = false;
      
      if (role === 'admin') {
        canAssignTransporter = true;
      } else if (role === 'company' && order.companyId === companyId) {
        canAssignTransporter = true;
      } else if (isCompanyOwner && order.companyId === companyId) {
        canAssignTransporter = true;
      }
      
      if (!canAssignTransporter) {
        console.log(`Brak uprawnień do przypisania transportera - użytkownik nie ma odpowiednich uprawnień. Role: ${role}, companyId: ${companyId}, orderId: ${orderId}, order.companyId: ${order.companyId}`);
        return res.status(403).json({ message: "Brak uprawnień do przypisania transportera. Możesz przypisywać transportera tylko do zleceń swojej firmy." });
      }
      
      try {
        // Pobierz dane transportera przed przypisaniem dla dodatkowej walidacji
        const transporter = await storage.getUser(transporterId);
        if (!transporter) {
          return res.status(404).json({ message: "Nie znaleziono transportera o podanym ID" });
        }
        
        console.log(`Dane transportera: id=${transporter.id}, name=${transporter.name}, services=${JSON.stringify(transporter.services)}`);
        
        // Sprawdź, czy transporter ma usługę zawierającą "transport" (niezależnie od wielkości liter)
        const hasTransportService = transporter.services && 
          transporter.services.some(service => typeof service === 'string' && service.toLowerCase().includes('transport'));
        
        console.log(`Czy transporter ${transporter.id} ma usługę transportu: ${hasTransportService}`);
        console.log(`Usługi transportera: ${JSON.stringify(transporter.services || [])}`);
        
        if (!hasTransportService) {
          return res.status(400).json({ message: "Wybrany użytkownik nie ma uprawnień do transportu" });
        }
        
        // Pobierz status transportu z żądania lub użyj domyślnej wartości
        const transportStatusValue = req.body.transportStatus || 'zaplanowany';
        // Upewnij się, że status transportu jest jednym z dozwolonych wartości
        const validTransportStatuses = ['skompletowany', 'zaplanowany', 'dostarczony'];
        const transportStatus = validTransportStatuses.includes(transportStatusValue) 
          ? transportStatusValue as 'skompletowany' | 'zaplanowany' | 'dostarczony'
          : 'zaplanowany';
        console.log(`Używany status transportu: ${transportStatus}`);
        
        // Użyj nowej metody assignTransporterToOrder
        const updatedOrder = await storage.assignTransporterToOrder(orderId, { 
          transporterId, 
          transportDate,
          transportStatus
        });
        
        if (!updatedOrder) {
          return res.status(404).json({ message: "Zlecenie nie znalezione" });
        }
        
        // Powiadomienie dla transportera
        await storage.createNotification({
          userId: transporterId,
          title: "Przypisano transport",
          message: `Zostałeś przypisany do transportu dla zlecenia ${order.orderNumber} na dzień ${new Date(transportDate || new Date()).toLocaleDateString('pl-PL')}`,
          type: "transport_assigned",
          read: false,
          relatedId: orderId
        });
        
        // Jeśli istnieje montażysta przypisany do zlecenia, powiadom go również
        if (order.installerId) {
          await storage.createNotification({
            userId: order.installerId,
            title: "Zaplanowano transport",
            message: `Zaplanowano transport dla zlecenia ${order.orderNumber} na dzień ${new Date(transportDate || new Date()).toLocaleDateString('pl-PL')}`,
            type: "transport_scheduled",
            read: false,
            relatedId: orderId
          });
        }
        
        // Pobranie informacji o sklepie
        const store = await storage.getStore(order.storeId);
        
        // Pobierz użytkowników ze sklepu (pracownicy)
        if (store) {
          const storeUsers = (await storage.getUsers()).filter(user => 
            user.storeId === store.id && ['worker', 'admin'].includes(user.role)
          );
          
          // Powiadom pracowników sklepu
          for (const user of storeUsers) {
            await storage.createNotification({
              userId: user.id,
              title: "Zaplanowano transport",
              message: `Zaplanowano transport dla zlecenia ${order.orderNumber} (klient: ${order.clientName}) na dzień ${new Date(transportDate || new Date()).toLocaleDateString('pl-PL')}`,
              type: "transport_scheduled",
              read: false,
              relatedId: orderId
            });
          }
        }
        
        // Wywołaj funkcję do wysyłania powiadomień o zmianie statusu transportu
        await sendTransportStatusNotifications(orderId, transportStatus);
        
        res.status(200).json(updatedOrder);
      } catch (error) {
        // Obsługa błędów walidacji biznesowej z metody assignTransporterToOrder
        if (error instanceof Error) {
          console.log("Błąd przy przypisywaniu transportera:", error.message);
          return res.status(400).json({ message: error.message });
        }
        throw error; // Przekaż dalej, jeśli to nie jest oczekiwany błąd
      }
    } catch (error) {
      console.error("Error assigning transporter:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpoint do przypisywania firmy montażowej do zlecenia
  app.patch("/api/orders/:id/assign-company", authMiddleware, async (req: Request, res: Response) => {
    try {
      console.log("--- POCZĄTEK ENDPOINT ASSIGN-COMPANY ---");
      
      const orderId = parseInt(req.params.id);
      
      // Walidacja danych
      const { companyId } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ 
          message: "Brak wymaganych danych", 
          errors: [
            { path: ["companyId"], message: "ID firmy montażowej jest wymagane" }
          ]
        });
      }
      
      // Sprawdź czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      console.log(`Dane zlecenia przed przypisaniem firmy: withTransport=${order.withTransport}, serviceType=${order.serviceType}`);
      
      // Sprawdź uprawnienia - tylko admin i pracownicy sklepu mogą przypisać firmę montażową
      const { role } = req.session.user!;
      
      if (role !== 'admin' && role !== 'worker') {
        return res.status(403).json({ message: "Brak uprawnień do przypisania firmy montażowej" });
      }
      
      // Sprawdź czy firma istnieje
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Firma montażowa nie znaleziona" });
      }
      
      // Przypisz firmę do zlecenia (teraz automatycznie obsługuje firmy jednosobowe wewnątrz metody)
      console.log(`Przypisywanie firmy ${companyId} do zlecenia ${orderId}`);
      const updatedOrder = await storage.assignCompanyToOrder(orderId, companyId);
      
      // Sprawdź, czy mamy doczynienia z firmą jednoosobową i czy transport jest wymagany
      console.log(`Sprawdzanie czy to firma jednoosobowa i czy potrzebny jest transport: withTransport=${order.withTransport}`);
      
      if (order.withTransport) {
        // Szukamy montażysty, który jest jednocześnie właścicielem firmy
        console.log(`Szukam montażystów dla firmy ${companyId} (${company.name})`);
        const installers = await storage.getUsersByRole('installer');
        const onePersonUser = installers.find(installer => installer.companyId === companyId);
        
        console.log(`Znaleziono montażystę z firmy: ${onePersonUser ? onePersonUser.id : 'nie znaleziono'}`);
        
        if (onePersonUser && onePersonUser.services) {
          console.log(`Usługi montażysty ${onePersonUser.id}: ${JSON.stringify(onePersonUser.services)}`);
          
          // Sprawdź, czy montażysta ma usługę transportu
          const hasTransport = onePersonUser.services.some(service => 
            typeof service === 'string' && service.toLowerCase().includes('transport'));
          
          console.log(`Montażysta ma usługę transportu: ${hasTransport}`);
          
          if (hasTransport) {
            console.log(`Zlecenie wymaga transportu i montażysta ma usługę transportu - przypisujemy jako transportera`);
            
            let transportDate: Date;
            
            // Ustal datę transportu na podstawie daty montażu
            if (updatedOrder.installationDate) {
              transportDate = new Date(updatedOrder.installationDate);
              const isPodlogi = order.serviceType.toLowerCase().includes('podłog');
              
              if (isPodlogi) {
                transportDate.setDate(transportDate.getDate() - 2);
              } else {
                transportDate.setDate(transportDate.getDate() - 1);
              }
            } else {
              // Jeśli nie ma daty montażu, ustaw transport na jutro
              transportDate = new Date();
              transportDate.setDate(transportDate.getDate() + 1);
            }
            
            console.log(`Data transportu: ${transportDate.toISOString()}`);
            
            // Pobierz status transportu z żądania lub użyj domyślnego 
            const transportStatusValue = req.body.transportStatus || 'zaplanowany';
            // Upewnij się, że status transportu jest jednym z dozwolonych wartości
            const validTransportStatuses = ['skompletowany', 'zaplanowany', 'dostarczony'];
            const transportStatus = validTransportStatuses.includes(transportStatusValue) 
              ? transportStatusValue as 'skompletowany' | 'zaplanowany' | 'dostarczony'
              : 'zaplanowany';
            console.log(`Używany status transportu przy przypisywaniu transportera: ${transportStatus}`);
            
            // Przypisz transportera, ale najpierw zapewniamy prawidłowy typ transportStatus
            const validatedTransportStatus = 
              (transportStatus === 'skompletowany' || 
               transportStatus === 'zaplanowany' || 
               transportStatus === 'dostarczony') 
                ? transportStatus as 'skompletowany' | 'zaplanowany' | 'dostarczony'
                : 'zaplanowany' as const;
            
            const transportData = {
              transporterId: onePersonUser.id,
              transportDate: transportDate, // Używamy obiektu Date, nie stringa
              transportStatus: validatedTransportStatus
            };
            
            console.log(`Przypisuję transportera: ${JSON.stringify(transportData)}`);
            
            const orderWithTransport = await storage.assignTransporterToOrder(orderId, transportData);
            
            console.log(`Wynik przypisania transportera:`, {
              id: orderWithTransport?.id,
              transporterId: orderWithTransport?.transporterId,
              transporterName: orderWithTransport?.transporterName,
              transportDate: orderWithTransport?.transportDate
            });
            
            if (orderWithTransport) {
              return res.status(200).json(orderWithTransport);
            }
          }
        }
      }
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Wysłanie powiadomienia do firmy montażowej
      // Znajdź właściciela firmy (role: company)
      const companyOwners = await storage.getUsersByRole('company');
      const companyOwner = companyOwners.find(user => user.companyId === companyId);
      
      if (companyOwner) {
        await storage.createNotification({
          userId: companyOwner.id,
          title: "Nowe zlecenie dla firmy",
          message: `Twojej firmie zostało przypisane nowe zlecenie: ${order.orderNumber}`,
          type: "company_assigned",
          read: false,
          relatedId: orderId
        });
      }
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      console.error("Error assigning company:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.patch("/api/orders/:id/status", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      // Logowanie otrzymanych danych do debugowania
      console.log("Otrzymano dane do aktualizacji statusu:", JSON.stringify(req.body));
      
      // Validate status data
      const statusData = updateOrderStatusSchema.parse(req.body);
      
      // Check if order exists
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Check if user has access to update this order
      const { role, storeId, companyId, id } = req.session.user || {};
      
      // Admin can update any order
      if (role !== 'admin') {
        if (role === 'worker' && order.storeId !== storeId) {
          return res.status(403).json({ message: "Brak uprawnień do aktualizacji tego zlecenia" });
        }
        
        if (role === 'company' && order.companyId !== companyId) {
          return res.status(403).json({ message: "Brak uprawnień do aktualizacji tego zlecenia" });
        }
        
        if (role === 'installer') {
          // Sprawdź czy montażysta jest przypisany do zlecenia
          // LUB czy montażysta ma przypisaną firmę (właściciel) i zlecenie jest przypisane do tej firmy
          const { companyName } = req.session.user || {};
          const isInstallerAssigned = order.installerId === id;
          const isCompanyOwner = companyId && companyName;
          const isOrderAssignedToCompany = isCompanyOwner && order.companyId === companyId;
          
          if (!isInstallerAssigned && !isOrderAssignedToCompany) {
            return res.status(403).json({ message: "Brak uprawnień do aktualizacji tego zlecenia" });
          }
        }
      }
      
      // Update order status
      const updatedOrder = await storage.updateOrderStatus(orderId, statusData);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Send notifications
      await sendOrderNotifications(orderId, statusData.installationStatus);
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Błąd walidacji Zod:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Nieprawidłowe dane statusu", errors: error.errors });
      }
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpoint do aktualizacji tylko statusu transportu
  app.patch("/api/orders/:id/transport-status", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      
      // Logowanie otrzymanych danych do debugowania
      console.log("Otrzymano dane do aktualizacji statusu transportu:", JSON.stringify(req.body));
      
      // Walidacja danych statusu transportu
      const transportData = updateTransportStatusSchema.parse(req.body);
      
      // Sprawdź czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Sprawdź uprawnienia - transporter, admin, pracownik sklepu lub firma jednoosobowa może aktualizować status transportu
      const { role, storeId, id, companyId } = req.session.user || {};
      
      // Sprawdź czy użytkownik ma uprawnienia do aktualizacji statusu transportu
      const isAssignedTransporter = order.transporterId === id;
      const hasAdminAccess = role === 'admin';
      const hasWorkerAccess = role === 'worker' && order.storeId === storeId;
      
      // Sprawdź czy to firma jednoosobowa (montażysta z przypisaną firmą), której zlecenie dotyczy
      const isOnePersonCompany = role === 'installer' && companyId && companyId === order.companyId;
      
      if (!isAssignedTransporter && !hasAdminAccess && !hasWorkerAccess && !isOnePersonCompany) {
        return res.status(403).json({ message: "Brak uprawnień do aktualizacji statusu transportu" });
      }
      
      // Aktualizuj status transportu i komentarz, jeśli został przekazany
      const updateData: Partial<InsertOrder> = {
        transportStatus: normalizeTransportStatus(transportData.transportStatus),
      };
      
      // Notatki do zlecenia
      if (transportData.comments) {
        updateData.notes = transportData.comments; // Zapisujemy komentarz w polu notes
      }
      
      // Dodaj datę transportu do aktualizacji, jeśli została przekazana
      if (transportData.transportDate) {
        updateData.transportDate = transportData.transportDate;
        console.log("Aktualizacja daty transportu na:", transportData.transportDate);
      }
      
      const updatedOrder = await storage.updateOrder(orderId, updateData);
      
      if (!updatedOrder) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Wysyłanie powiadomień o zmianie statusu transportu
      await sendTransportStatusNotifications(orderId, transportData.transportStatus);
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Błąd walidacji Zod przy aktualizacji transportu:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Nieprawidłowe dane statusu transportu", errors: error.errors });
      }
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpoint do aktualizacji statusu finansowego zlecenia (faktura/rozliczenie)
  app.patch("/api/orders/:id/financial-status", authMiddleware, canEditFinancialFields, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const financialData = updateOrderFinancialStatusSchema.parse(req.body);
      
      // Sprawdź czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Uprawnienia są sprawdzane przez middleware canEditFinancialFields
      // Dzięki middleware dostęp do tego endpointu mają:
      // 1. admin
      // 2. wszyscy pracownicy sklepu
      // 3. właściciele firm montażowych
      // 4. firmy jednoosobowe (montażyści z przypisaną firmą) - ale tylko do pola willBeSettled
      
      // Przygotuj obiekt z danymi do aktualizacji
      const updateData: Partial<InsertOrder> = {};
      if (financialData.invoiceIssued !== undefined) updateData.invoiceIssued = financialData.invoiceIssued;
      if (financialData.willBeSettled !== undefined) updateData.willBeSettled = financialData.willBeSettled;
      
      // Aktualizuj zlecenie
      const updatedOrder = await storage.updateOrder(orderId, updateData);
      if (!updatedOrder) {
        return res.status(404).json({ message: "Nie można zaktualizować zlecenia" });
      }
      
      console.log(`Zaktualizowano status finansowy zlecenia ${orderId}: invoiceIssued=${financialData.invoiceIssued}, willBeSettled=${financialData.willBeSettled}`);
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Nieprawidłowe dane statusu finansowego", errors: error.errors });
      }
      console.error("Błąd aktualizacji statusu finansowego:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Dedykowany endpoint tylko do aktualizacji statusu "do rozliczenia"
  // Ten endpoint nie wymaga pełnych uprawnień finansowych, jest dostępny również dla firm jednoosobowych
  app.patch("/api/orders/:id/settlement-status", authMiddleware, async (req: Request, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const { value } = req.body;
      
      // Walidacja danych wejściowych
      if (typeof value !== 'boolean') {
        return res.status(400).json({ message: "Nieprawidłowe dane. Wartość musi być typu boolean." });
      }
      
      // Pobierz dane użytkownika
      const user = req.session.user!;
      
      // Sprawdź czy zlecenie istnieje
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Zlecenie nie znalezione" });
      }
      
      // Sprawdź uprawnienia:
      // 1. Admin ma zawsze dostęp
      // 2. Pracownicy sklepu mają dostęp
      // 3. Firmy montażowe mają dostęp
      // 4. Firmy jednoosobowe (montażyści z przypisaną firmą companyId) mają dostęp do swoich zleceń
      const isAdmin = user.role === 'admin';
      const isWorker = user.role === 'worker';
      const isCompany = user.role === 'company';
      const isOnePersonCompany = user.role === 'installer' && user.companyId !== undefined && user.companyName;
      
      // Sprawdź czy user ma prawo do edycji tego zlecenia
      // Firmy jednoosobowe mogą edytować tylko swoje zlecenia (gdzie companyId = ich companyId)
      if (!isAdmin && !isWorker && !isCompany && 
          !(isOnePersonCompany && order.companyId === user.companyId)) {
        return res.status(403).json({ message: "Brak uprawnień do aktualizacji statusu rozliczenia" });
      }
      
      // Aktualizuj tylko pole willBeSettled
      const updateData: Partial<InsertOrder> = {
        willBeSettled: value
      };
      
      // Aktualizuj zlecenie
      const updatedOrder = await storage.updateOrder(orderId, updateData);
      if (!updatedOrder) {
        return res.status(404).json({ message: "Nie można zaktualizować zlecenia" });
      }
      
      console.log(`Zaktualizowano status "do rozliczenia" zlecenia ${orderId}: willBeSettled=${value}, użytkownik: ${user.id} (${user.role})`);
      
      res.status(200).json(updatedOrder);
    } catch (error) {
      console.error("Błąd aktualizacji statusu 'do rozliczenia':", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Stats endpoint
  app.get("/api/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      
      // This would normally be calculated from the database
      // For this example, we'll return mock stats
      const stats = {
        newOrders: 12,
        completedOrders: 28,
        inProgressOrders: 15,
        complaints: 3
      };
      
      res.status(200).json(stats);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Sales Plan endpoints
  app.get("/api/salesplan", authMiddleware, managerOrDeputyOrAdmin, async (req: Request, res: Response) => {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1;
      const storeId = req.query.storeId ? parseInt(req.query.storeId as string) : undefined;
      
      // Get sales plan data
      const salesPlan = await storage.getSalesPlan(year, month, storeId);
      
      // If no sales plan exists for this period, return mock data
      if (salesPlan.length === 0) {
        // In a real app, we'd create a new sales plan or return an empty one
        // For now, return mock data
        const mockSalesPlan = {
          id: 0,
          year,
          month,
          storeId: storeId || 1,
          storeName: storeId === 2 ? "Struga 31A" : "Santocka 39",
          target: storeId === 2 ? 110000 : 75000,
          actualSales: storeId === 2 ? 68200 : 56250,
          productSales: storeId === 2 ? 45000 : 37500,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        return res.status(200).json(mockSalesPlan);
      }
      
      res.status(200).json(salesPlan[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Push notification subscription endpoint
  app.post("/api/notifications/subscribe", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { endpoint, keys } = req.body;
      
      if (!endpoint || !keys) {
        return res.status(400).json({ message: "Brakujące dane subskrypcji" });
      }
      
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Nie jesteś zalogowany" });
      }
      
      // Check if subscription already exists
      const existingSubscription = await storage.getSubscription(userId);
      
      if (existingSubscription) {
        // Update existing subscription
        await storage.deleteSubscription(existingSubscription.id);
      }
      
      // Create new subscription
      const subscription = await storage.createSubscription({
        userId,
        endpoint,
        keys,
        expirationTime: null
      });
      
      res.status(201).json({ message: "Subskrypcja utworzona pomyślnie" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Endpoint testowy do wysyłania powiadomień (tylko dla administratora)
  app.post("/api/test/notifications", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { userId, subject, message } = req.body;
      
      if (!userId || !subject || !message) {
        return res.status(400).json({ success: false, message: "Brakujące dane: userId, subject lub message" });
      }
      
      // Pobierz użytkownika
      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ success: false, message: "Użytkownik nie znaleziony" });
      }
      
      // Pobierz subskrypcję powiadomień push (jeśli istnieje)
      const subscription = await storage.getSubscription(user.id);
      
      // Wyślij powiadomienia
      const result = await sendNotification(user.email, subscription || null, subject, message, { url: "/" });
      
      // Dodaj powiadomienie do bazy danych (bez relatedId)
      try {
        await storage.createNotification({
          userId: user.id,
          title: subject,
          message,
          data: { url: "/" }
        });
      } catch (dbError) {
        console.error("Błąd przy zapisie powiadomienia w bazie:", dbError);
        // Kontynuujemy mimo błędu, ponieważ e-mail mógł zostać wysłany pomyślnie
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Powiadomienia wysłane", 
        details: { 
          email: result.email ? "Wysłano" : "Błąd",
          push: subscription ? (result.push ? "Wysłano" : "Błąd") : "Brak subskrypcji",
          user: user.email
        } 
      });
    } catch (error) {
      console.error("Błąd podczas wysyłania powiadomień:", error);
      res.status(500).json({ 
        success: false, 
        message: "Błąd serwera", 
        error: error instanceof Error ? error.message : "Nieznany błąd" 
      });
    }
  });

  // Endpoint testowy do wysyłania e-maili (tylko dla administratora)
  app.post("/api/test/send-email", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { to, subject, message } = req.body;
      
      if (!to || !subject || !message) {
        return res.status(400).json({ success: false, message: "Brakujące dane: to, subject lub message" });
      }
      
      // Wysyłanie e-maila testowego
      const result = await sendEmail(to, subject, message);
      
      if (result) {
        res.status(200).json({ 
          success: true, 
          message: "E-mail testowy wysłany pomyślnie", 
          details: { to, subject, message } 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Wystąpił problem podczas wysyłania e-maila", 
          details: { to, subject, message } 
        });
      }
    } catch (error) {
      console.error("Błąd podczas wysyłania testowego e-maila:", error);
      res.status(500).json({ 
        success: false, 
        message: "Błąd serwera", 
        error: error instanceof Error ? error.message : "Nieznany błąd" 
      });
    }
  });

  // Endpoints for notification system
  app.get("/api/notifications/vapid-public-key", authMiddleware, async (req: Request, res: Response) => {
    try {
      // Pobierz klucz VAPID z bazy danych
      const vapidPublicKeySetting = await storage.getSetting("vapid_public_key");
      
      // Jeśli klucz istnieje, zwróć go
      if (vapidPublicKeySetting?.value) {
        res.status(200).json({ publicKey: vapidPublicKeySetting.value });
      } else {
        // Fallback - używamy klucza z ENV lub hardcoded dla kompatybilności wstecznej
        const publicKey = process.env.VAPID_PUBLIC_KEY || 'BA7O2xxZqzR-LheuFch1WgO48tBu1kGfQLSJkwwkO4WFOWxIfvfZAVskTiF62qUIeL405eNPF6DQhr4wK--Vovk';
        res.status(200).json({ publicKey });
      }
    } catch (error) {
      console.error("Error sending VAPID public key:", error);
      res.status(500).json({ message: "Wystąpił błąd serwera" });
    }
  });

  app.get("/api/notifications", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const notifications = await storage.getNotifications(userId);
      res.status(200).json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas pobierania powiadomień" });
    }
  });

  app.post("/api/notifications/subscribe", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const subscription = req.body;
      
      // Sprawdź czy subskrypcja jest prawidłowa
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ message: "Nieprawidłowa subskrypcja" });
      }
      
      // Zapisz subskrypcję w bazie danych
      await storage.createSubscription({
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });
      
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Error saving subscription:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas zapisywania subskrypcji" });
    }
  });

  app.delete("/api/notifications/unsubscribe", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const subscription = await storage.getSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "Subskrypcja nie znaleziona" });
      }
      
      // Usuń subskrypcję z bazy danych
      const result = await storage.deleteSubscription(subscription.id);
      
      if (result) {
        res.status(200).json({ success: true });
      } else {
        res.status(500).json({ message: "Nie udało się usunąć subskrypcji" });
      }
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas usuwania subskrypcji" });
    }
  });
  
  // Endpoint do usuwania pojedynczego powiadomienia
  app.delete("/api/notifications/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      const userId = req.session.user!.id;
      
      // Sprawdź, czy powiadomienie istnieje i należy do tego użytkownika
      const notifications = await storage.getNotifications(userId);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ 
          success: false, 
          message: "Powiadomienie nie znalezione lub brak uprawnień" 
        });
      }
      
      // Usuń powiadomienie z bazy danych
      await storage.deleteNotification(notificationId);
      
      return res.status(200).json({ 
        success: true, 
        message: "Powiadomienie usunięte pomyślnie" 
      });
    } catch (error) {
      console.error("Błąd podczas usuwania powiadomienia:", error);
      res.status(500).json({ 
        success: false, 
        message: "Błąd podczas usuwania powiadomienia" 
      });
    }
  });

  app.patch("/api/notifications/read-all", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const notifications = await storage.getNotifications(userId);
      
      // Oznacz wszystkie powiadomienia jako przeczytane
      for (const notification of notifications) {
        if (!notification.read) {
          await storage.markNotificationAsRead(notification.id);
        }
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas oznaczania powiadomień jako przeczytane" });
    }
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID powiadomienia" });
      }
      
      const result = await storage.markNotificationAsRead(notificationId);
      
      if (result) {
        res.status(200).json({ success: true });
      } else {
        res.status(404).json({ message: "Powiadomienie nie znalezione" });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas oznaczania powiadomienia jako przeczytane" });
    }
  });

  // Store endpoints
  app.get("/api/stores", authMiddleware, async (req: Request, res: Response) => {
    try {
      const stores = await storage.getStores();
      res.status(200).json(stores);
    } catch (error) {
      console.error("Błąd pobierania sklepów:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.get("/api/stores/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.id);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID sklepu" });
      }
      
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Sklep nie znaleziony" });
      }
      
      res.status(200).json(store);
    } catch (error) {
      console.error("Błąd podczas pobierania sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.post("/api/stores", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const storeData = insertStoreSchema.parse(req.body);
      const store = await storage.createStore(storeData);
      
      res.status(201).json(store);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Nieprawidłowe dane sklepu", errors: error.errors });
      }
      console.error("Błąd tworzenia sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Endpointy do zarządzania ustawieniami (tylko dla administratora)
  app.get("/api/settings", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      
      let settings;
      if (category) {
        settings = await storage.getSettingsByCategory(category);
      } else {
        settings = await storage.getAllSettings();
      }
      
      res.status(200).json(settings);
    } catch (error) {
      console.error("Błąd podczas pobierania ustawień:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.get("/api/settings/:key", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const setting = await storage.getSetting(key);
      
      if (!setting) {
        return res.status(404).json({ message: "Ustawienie nie znalezione" });
      }
      
      res.status(200).json(setting);
    } catch (error) {
      console.error("Błąd podczas pobierania ustawienia:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.post("/api/settings", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const settingData = req.body;
      
      if (!settingData.key || (!settingData.value && settingData.valueJson === undefined)) {
        return res.status(400).json({ 
          message: "Nieprawidłowe dane", 
          errors: [
            { path: ["key"], message: "Klucz jest wymagany" },
            { path: ["value"], message: "Wartość lub valueJson jest wymagane" }
          ]
        });
      }
      
      const setting = await storage.createSetting(settingData);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Błąd podczas tworzenia ustawienia:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Endpoint do testowania ustawień SMTP
  app.post("/api/settings/test-smtp", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      // Pobierz ustawienia SMTP z bazy danych
      const smtpHost = await storage.getSetting("smtp_host");
      const smtpPort = await storage.getSetting("smtp_port");
      const smtpUser = await storage.getSetting("smtp_user");
      const smtpPass = await storage.getSetting("smtp_pass");
      const smtpSecure = await storage.getSetting("smtp_secure");
      const emailFrom = await storage.getSetting("email_from");
      
      // Sprawdź, czy wszystkie wymagane ustawienia istnieją
      if (!smtpHost?.value || !smtpPort?.value || !smtpUser?.value || !smtpPass?.value || !emailFrom?.value) {
        return res.status(400).json({ 
          success: false, 
          message: "Brakujące ustawienia SMTP. Sprawdź, czy wszystkie pola są wypełnione." 
        });
      }
      
      // Utwórz transporter do testów z aktualnych ustawień
      const testTransporter = nodemailer.createTransport({
        host: smtpHost.value,
        port: parseInt(smtpPort.value),
        secure: smtpSecure?.value === "true",
        auth: {
          user: smtpUser.value,
          pass: smtpPass.value
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // Pobierz dane z żądania, z domyślnymi wartościami
      const { email = req.session.user?.email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: "Brak adresu email do testu" 
        });
      }
      
      // Wyślij testowy email
      const info = await testTransporter.sendMail({
        from: emailFrom.value,
        to: email,
        subject: "Test powiadomień email z Bel-Pol System",
        text: "To jest testowa wiadomość z systemu Bel-Pol. Jeśli ją otrzymałeś, to oznacza, że ustawienia SMTP są poprawne.",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2563eb;">Test powiadomień email z Bel-Pol System</h2>
            <p>To jest testowa wiadomość z systemu zarządzania zleceniami Bel-Pol.</p>
            <p>Jeśli ją otrzymałeś, to oznacza, że ustawienia SMTP są poprawne i system może wysyłać powiadomienia email.</p>
            <p>Data i czas testu: ${new Date().toLocaleString('pl-PL')}</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Ta wiadomość została wygenerowana automatycznie. Nie odpowiadaj na nią.</p>
          </div>
        `
      });
      
      // Zapisz powiadomienie w systemie
      await storage.createNotification({
        userId: req.session.user!.id,
        title: "Test powiadomień email",
        message: "Pomyślnie wysłano testowy email do: " + email,
      });
      
      res.status(200).json({ 
        success: true, 
        message: "Testowy email został wysłany", 
        details: {
          messageId: info.messageId,
          to: email
        }
      });
    } catch (error) {
      console.error("Błąd podczas testowania ustawień SMTP:", error);
      res.status(500).json({ 
        success: false, 
        message: "Błąd podczas wysyłania testowego emaila", 
        error: error instanceof Error ? error.message : "Nieznany błąd"
      });
    }
  });
  
  // Endpoint do testowania ustawień SMTP
  app.post("/api/settings/test-smtp", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      // Pobierz dane z ciała zapytania
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Adres email jest wymagany"
        });
      }
      
      // Pobierz ustawienia SMTP z bazy danych
      const smtpHost = await storage.getSetting("smtp_host");
      const smtpPort = await storage.getSetting("smtp_port");
      const smtpUser = await storage.getSetting("smtp_user");
      const smtpPass = await storage.getSetting("smtp_pass");
      const smtpSecure = await storage.getSetting("smtp_secure");
      const emailFrom = await storage.getSetting("email_from");
      
      // Sprawdź, czy wszystkie wymagane ustawienia istnieją
      if (!smtpHost?.value || !smtpPort?.value || !smtpUser?.value || !smtpPass?.value || !emailFrom?.value) {
        return res.status(400).json({ 
          success: false, 
          message: "Brakujące ustawienia SMTP. Sprawdź, czy wszystkie pola są wypełnione." 
        });
      }
      
      // Skonfiguruj transporter nodemailer
      const transporter = nodemailer.createTransport({
        host: smtpHost.value,
        port: parseInt(smtpPort.value),
        secure: smtpSecure?.value === 'true',
        auth: {
          user: smtpUser.value,
          pass: smtpPass.value
        }
      });
      
      // Przygotuj treść emaila
      const mailOptions = {
        from: emailFrom.value,
        to: email,
        subject: "Test ustawień SMTP - Bel-Pol",
        text: "To jest testowy email z systemu Bel-Pol. Jeśli otrzymałeś tę wiadomość, oznacza to, że ustawienia SMTP działają poprawnie.",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <h2 style="color: #333;">Test ustawień SMTP - Bel-Pol</h2>
            <p>To jest testowy email z systemu Bel-Pol.</p>
            <p>Jeśli otrzymałeś tę wiadomość, oznacza to, że ustawienia SMTP działają poprawnie.</p>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">Ta wiadomość została wygenerowana automatycznie. Prosimy nie odpowiadać na tego emaila.</p>
            </div>
          </div>
        `
      };
      
      // Wyślij testowy email
      await transporter.sendMail(mailOptions);
      
      // Zapisz powiadomienie w systemie
      await storage.createNotification({
        userId: req.session.user?.id || 0,
        title: "Test ustawień SMTP",
        message: "Pomyślnie wysłano testowy email",
      });
      
      res.status(200).json({ 
        success: true, 
        message: "Testowy email został wysłany pomyślnie" 
      });
    } catch (error) {
      console.error("Błąd podczas testowania SMTP:", error);
      res.status(500).json({ 
        success: false, 
        message: "Błąd podczas wysyłania testowego emaila", 
        error: error instanceof Error ? error.message : "Nieznany błąd"
      });
    }
  });
  
  // Endpoint do testowania powiadomień push
  app.post("/api/settings/test-push", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      // Pobierz ustawienia VAPID z bazy danych
      const vapidPublicKey = await storage.getSetting("vapid_public_key");
      const vapidPrivateKey = await storage.getSetting("vapid_private_key");
      
      // Sprawdź, czy wszystkie wymagane ustawienia istnieją
      if (!vapidPublicKey?.value || !vapidPrivateKey?.value) {
        return res.status(400).json({ 
          success: false, 
          message: "Brakujące klucze VAPID. Sprawdź, czy wszystkie pola są wypełnione." 
        });
      }
      
      // Pobierz subskrypcję użytkownika
      const userId = req.session.user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          message: "Nie jesteś zalogowany" 
        });
      }
      
      const subscription = await storage.getSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ 
          success: false, 
          message: "Nie masz aktywnej subskrypcji powiadomień push. Włącz powiadomienia w przeglądarce." 
        });
      }
      
      // Pobierz adres email kontaktowy z bazy danych lub użyj domyślnego
      const vapidContactEmail = await storage.getSetting("vapid_contact_email");
      const contactEmail = vapidContactEmail?.value || 'info@ligazzpn.pl';
      
      webpush.setVapidDetails(
        `mailto:${contactEmail}`,
        vapidPublicKey.value,
        vapidPrivateKey.value
      );
      
      // Przygotuj endpoint z prawidłowym formatem URL dla FCM
      let endpoint = subscription.endpoint;
      
      // Konwertuj format z fcm/send/ na wp/ jeśli to konieczne
      if (endpoint && endpoint.includes('fcm.googleapis.com/fcm/send/')) {
        endpoint = endpoint.replace(
          'https://fcm.googleapis.com/fcm/send/', 
          'https://fcm.googleapis.com/wp/'
        );
        console.log('Naprawiono format endpointu FCM:', endpoint);
      }
      
      // Format the subscription object for web-push
      const pushSubscription = {
        endpoint: endpoint,
        keys: subscription.keys as { p256dh: string; auth: string }
      };
      
      // Wyślij testowe powiadomienie push
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: "Test powiadomień push",
          body: "To jest testowe powiadomienie push z systemu Bel-Pol. Jeśli je widzisz, to oznacza, że ustawienia powiadomień push są poprawne.",
          icon: "/logo192.png",
          badge: "/logo192.png",
          vibrate: [100, 50, 100],
          requireInteraction: true,
          data: { 
            url: "/",
            timestamp: new Date().toISOString()
          }
        })
      );
      
      // Zapisz powiadomienie w systemie
      await storage.createNotification({
        userId: userId,
        title: "Test powiadomień push",
        message: "Pomyślnie wysłano testowe powiadomienie push",
      });
      
      res.status(200).json({ 
        success: true, 
        message: "Testowe powiadomienie push zostało wysłane" 
      });
    } catch (error) {
      console.error("Błąd podczas testowania powiadomień push:", error);
      res.status(500).json({ 
        success: false, 
        message: "Błąd podczas wysyłania testowego powiadomienia push", 
        error: error instanceof Error ? error.message : "Nieznany błąd"
      });
    }
  });
  
  app.patch("/api/settings/:key", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const { value, valueJson } = req.body;
      
      if (value === undefined && valueJson === undefined) {
        return res.status(400).json({ 
          message: "Nieprawidłowe dane", 
          errors: [
            { path: ["value"], message: "Wartość lub valueJson jest wymagane" }
          ]
        });
      }
      
      const setting = await storage.updateSetting(key, valueJson !== undefined ? valueJson : value);
      
      if (!setting) {
        return res.status(404).json({ message: "Ustawienie nie znalezione" });
      }
      
      res.status(200).json(setting);
    } catch (error) {
      console.error("Błąd podczas aktualizacji ustawienia:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.delete("/api/settings/:key", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const deleted = await storage.deleteSetting(key);
      
      if (!deleted) {
        return res.status(404).json({ message: "Ustawienie nie znalezione" });
      }
      
      res.status(200).json({ message: "Ustawienie usunięte pomyślnie" });
    } catch (error) {
      console.error("Błąd podczas usuwania ustawienia:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.patch("/api/stores/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.id);
      
      // Validate store existence
      const existingStore = await storage.getStore(storeId);
      if (!existingStore) {
        return res.status(404).json({ message: "Sklep nie znaleziony" });
      }
      
      const updatedStore = await storage.updateStore(storeId, req.body);
      
      if (!updatedStore) {
        return res.status(404).json({ message: "Sklep nie znaleziony" });
      }
      
      res.status(200).json(updatedStore);
    } catch (error) {
      console.error("Błąd aktualizacji sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  app.delete("/api/stores/:id", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.id);
      
      // Check if store exists
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Sklep nie znaleziony" });
      }
      
      // Check if store is in use by users or orders
      const users = await storage.getUsers();
      const storeUsedByUsers = users.some(user => user.storeId === storeId);
      
      if (storeUsedByUsers) {
        return res.status(400).json({ message: "Nie można usunąć sklepu, ponieważ jest przypisany do użytkowników" });
      }
      
      const orders = await storage.getOrders({ storeId: storeId });
      if (orders.length > 0) {
        return res.status(400).json({ message: "Nie można usunąć sklepu, ponieważ są z nim powiązane zlecenia" });
      }
      
      const deleted = await storage.deleteStore(storeId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Sklep nie znaleziony" });
      }
      
      res.status(200).json({ message: "Sklep usunięty pomyślnie" });
    } catch (error) {
      console.error("Błąd usuwania sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Endpointy do zarządzania relacjami między firmami a sklepami
  
  // Pobranie sklepów przypisanych do firmy
  app.get("/api/companies/:id/stores", authMiddleware, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID firmy" });
      }
      
      const stores = await storage.getCompanyStores(companyId);
      res.status(200).json(stores);
    } catch (error) {
      console.error("Błąd podczas pobierania sklepów dla firmy:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Aktualizacja listy sklepów przypisanych do firmy
  app.post("/api/companies/:id/stores", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID firmy" });
      }
      
      // Sprawdź czy firma istnieje
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      // Oczekujemy tablicy ID sklepów w ciele żądania
      const { storeIds } = req.body;
      
      if (!Array.isArray(storeIds)) {
        return res.status(400).json({ message: "Nieprawidłowy format danych. Oczekiwano tablicy storeIds." });
      }
      
      // Sprawdź czy wszystkie sklepy istnieją
      for (const storeId of storeIds) {
        const store = await storage.getStore(storeId);
        if (!store) {
          return res.status(400).json({ message: `Sklep o ID ${storeId} nie istnieje` });
        }
      }
      
      // Zaktualizuj przypisania sklepów do firmy
      const relations = await storage.updateCompanyStores(companyId, storeIds);
      
      res.status(200).json({
        message: "Lista sklepów została zaktualizowana",
        relations
      });
    } catch (error) {
      console.error("Błąd podczas aktualizacji sklepów dla firmy:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Dodanie pojedynczego sklepu do firmy
  app.post("/api/companies/:companyId/stores/:storeId", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      console.log(`Otrzymano żądanie przypisania sklepu do firmy: companyId=${req.params.companyId}, storeId=${req.params.storeId}`);
      
      const companyId = parseInt(req.params.companyId);
      const storeId = parseInt(req.params.storeId);
      
      console.log(`Po konwersji: companyId=${companyId}, storeId=${storeId}`);
      
      if (isNaN(companyId) || isNaN(storeId)) {
        console.log("Błąd: Nieprawidłowe ID firmy lub sklepu");
        return res.status(400).json({ message: "Nieprawidłowe ID firmy lub sklepu" });
      }
      
      // Sprawdź czy firma i sklep istnieją
      const company = await storage.getCompany(companyId);
      const store = await storage.getStore(storeId);
      
      console.log(`Znaleziona firma:`, company ? `ID=${company.id}, Nazwa=${company.name}` : 'brak');
      console.log(`Znaleziony sklep:`, store ? `ID=${store.id}, Nazwa=${store.name}` : 'brak');
      
      if (!company) {
        console.log(`Błąd: Firma o ID=${companyId} nie istnieje`);
        return res.status(404).json({ message: "Firma nie znaleziona" });
      }
      
      if (!store) {
        console.log(`Błąd: Sklep o ID=${storeId} nie istnieje`);
        return res.status(404).json({ message: "Sklep nie znaleziony" });
      }
      
      // Dodaj relację
      console.log(`Dodaję relację między firmą ${companyId} (${company.name}) a sklepem ${storeId} (${store.name})`);
      const relation = await storage.addCompanyStore(companyId, storeId);
      console.log(`Relacja utworzona pomyślnie:`, relation);
      
      res.status(200).json({
        message: "Sklep został przypisany do firmy",
        relation
      });
    } catch (error) {
      console.error("Błąd podczas przypisywania sklepu do firmy:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Usunięcie pojedynczego sklepu z firmy
  app.delete("/api/companies/:companyId/stores/:storeId", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      console.log(`Otrzymano żądanie usunięcia sklepu z firmy: companyId=${req.params.companyId}, storeId=${req.params.storeId}`);
      
      const companyId = parseInt(req.params.companyId);
      const storeId = parseInt(req.params.storeId);
      
      console.log(`Po konwersji: companyId=${companyId}, storeId=${storeId}`);
      
      if (isNaN(companyId) || isNaN(storeId)) {
        console.log("Błąd: Nieprawidłowe ID firmy lub sklepu");
        return res.status(400).json({ message: "Nieprawidłowe ID firmy lub sklepu" });
      }
      
      // Sprawdzamy, czy relacja istnieje
      const relations = await db
        .select()
        .from(companyStores)
        .where(and(
          eq(companyStores.companyId, companyId),
          eq(companyStores.storeId, storeId)
        ));
      
      console.log(`Czy relacja istnieje? ${relations.length > 0 ? 'Tak' : 'Nie'}`);
      
      // Usuń relację
      const deleted = await storage.removeCompanyStore(companyId, storeId);
      
      console.log(`Wynik usuwania relacji: ${deleted ? 'Usunięto pomyślnie' : 'Nie znaleziono relacji lub błąd usuwania'}`);
      
      if (!deleted) {
        return res.status(404).json({ message: "Relacja nie znaleziona lub nie można jej usunąć" });
      }
      
      res.status(200).json({
        message: "Sklep został odłączony od firmy"
      });
    } catch (error) {
      console.error("Błąd podczas usuwania sklepu z firmy:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Pobranie firm przypisanych do sklepu
  app.get("/api/stores/:id/companies", authMiddleware, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.id);
      if (isNaN(storeId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID sklepu" });
      }
      
      console.log(`Pobieranie firm dla sklepu o ID ${storeId}`);
      const companies = await storage.getStoreCompanies(storeId);
      console.log(`Znaleziono ${companies.length} firm dla sklepu ${storeId}`);
      res.status(200).json(companies);
    } catch (error) {
      console.error("Błąd podczas pobierania firm dla sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Dodanie firmy do sklepu
  app.post("/api/stores/:storeId/companies/:companyId", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const companyId = parseInt(req.params.companyId);
      
      console.log(`Otrzymano żądanie przypisania firmy do sklepu: storeId=${storeId}, companyId=${companyId}`);
      
      if (isNaN(storeId) || isNaN(companyId)) {
        console.log("Błąd: Nieprawidłowe ID sklepu lub firmy");
        return res.status(400).json({ message: "Nieprawidłowe ID sklepu lub firmy" });
      }
      
      // Sprawdź czy sklep i firma istnieją
      const store = await storage.getStore(storeId);
      if (!store) {
        console.log(`Sklep o ID ${storeId} nie istnieje`);
        return res.status(404).json({ message: "Sklep nie istnieje" });
      }
      
      const company = await storage.getCompany(companyId);
      if (!company) {
        console.log(`Firma o ID ${companyId} nie istnieje`);
        return res.status(404).json({ message: "Firma nie istnieje" });
      }
      
      console.log(`Znaleziony sklep: ID=${storeId}, Nazwa=${store.name}`);
      console.log(`Znaleziona firma: ID=${companyId}, Nazwa=${company.name}`);
      
      // Dodaj relację
      const relation = await storage.addCompanyStore(companyId, storeId);
      console.log(`Dodano relację między sklepem ${storeId} a firmą ${companyId}`);
      
      res.status(200).json({
        message: "Firma została przypisana do sklepu",
        relation
      });
    } catch (error) {
      console.error("Błąd podczas przypisywania firmy do sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });
  
  // Usunięcie firmy ze sklepu
  app.delete("/api/stores/:storeId/companies/:companyId", authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const storeId = parseInt(req.params.storeId);
      const companyId = parseInt(req.params.companyId);
      
      console.log(`Otrzymano żądanie usunięcia firmy ze sklepu: storeId=${storeId}, companyId=${companyId}`);
      
      if (isNaN(storeId) || isNaN(companyId)) {
        console.log("Błąd: Nieprawidłowe ID sklepu lub firmy");
        return res.status(400).json({ message: "Nieprawidłowe ID sklepu lub firmy" });
      }
      
      // Usuń relację
      const deleted = await storage.removeCompanyStore(companyId, storeId);
      console.log(`Wynik usuwania relacji: ${deleted ? 'Usunięto pomyślnie' : 'Nie znaleziono relacji lub błąd usuwania'}`);
      
      if (!deleted) {
        return res.status(404).json({ message: "Relacja nie znaleziona lub nie można jej usunąć" });
      }
      
      res.status(200).json({
        message: "Firma została odłączona od sklepu"
      });
    } catch (error) {
      console.error("Błąd podczas usuwania firmy ze sklepu:", error);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  // Rejestracja endpointów dla filtrów użytkownika
  registerFilterRoutes(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Inicjalizacja serwera WebSocket na ścieżce /ws
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Obsługa połączeń WebSocket
  wss.on('connection', (ws) => {
    console.log('Nowe połączenie WebSocket');
    
    // Wysyłaj heartbeat co 30 sekund aby utrzymać połączenie
    const interval = setInterval(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
      }
    }, 30000);
    
    // Obsługa wiadomości od klienta
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Otrzymano wiadomość WebSocket:', data);
        
        // Tu można dodać logikę przetwarzania wiadomości
        
        // Odesłanie odpowiedzi
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(JSON.stringify({ 
            type: 'response', 
            timestamp: new Date().toISOString(),
            message: 'Wiadomość odebrana'
          }));
        }
      } catch (error) {
        console.error('Błąd przetwarzania wiadomości WebSocket:', error);
      }
    });
    
    // Obsługa zamknięcia połączenia
    ws.on('close', () => {
      console.log('Połączenie WebSocket zamknięte');
      clearInterval(interval);
    });
    
    // Wysłanie wiadomości powitalnej
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      timestamp: new Date().toISOString(),
      message: 'Połączono z serwerem WebSocket'
    }));
  });

  return httpServer;
}

// Helper function to send notifications when order status changes
async function sendOrderNotifications(orderId: number, installationStatus: string) {
  try {
    const order = await storage.getOrder(orderId);
    if (!order) return;
    
    // Define notification texts based on installation status
    let title = "Aktualizacja zlecenia";
    let message = `Zlecenie #${order.orderNumber} zostało zaktualizowane.`;
    
    if (installationStatus === "Nowe") {
      title = "Nowe zlecenie";
      message = `Utworzono nowe zlecenie #${order.orderNumber} dla klienta ${order.clientName}.`;
    } else if (installationStatus === "Reklamacja") {
      title = "Reklamacja zlecenia";
      message = `Zgłoszono reklamację dla zlecenia #${order.orderNumber}. Wymagana natychmiastowa reakcja.`;
    } else if (installationStatus === "Zakończone") {
      title = "Zlecenie zakończone";
      message = `Zlecenie #${order.orderNumber} zostało oznaczone jako zakończone.`;
    } else if (installationStatus === "W realizacji") {
      title = "Montaż rozpoczęty";
      message = `Montaż dla zlecenia #${order.orderNumber} jest w trakcie realizacji.`;
    } else if (installationStatus === "Zaplanowane") {
      title = "Montaż zaplanowany";
      message = `Montaż dla zlecenia #${order.orderNumber} został zaplanowany.`;
    }
    
    // Get users who should receive notifications
    // For store workers
    const storeWorkers = await storage.getUsersByRole("worker");
    const relevantWorkers = storeWorkers.filter(worker => worker.storeId === order.storeId);
    
    // For company
    const companyUsers = await storage.getUsersByRole("company");
    const relevantCompanyUsers = companyUsers.filter(user => user.companyId === order.companyId);
    
    // For installer
    const installerUsers = await storage.getUsersByRole("installer");
    const relevantInstallers = installerUsers.filter(user => 
      user.companyId === order.companyId && 
      (!order.installerId || user.id === order.installerId)
    );
    
    // All users who should be notified
    const usersToNotify = [
      ...relevantWorkers,
      ...relevantCompanyUsers,
      ...relevantInstallers
    ];
    
    // Create notification in database
    for (const user of usersToNotify) {
      // Dodaj powiadomienie do bazy danych
      try {
        await storage.createNotification({
          userId: user.id,
          title,
          message,
          data: { url: `/orders/${order.id}` }
        });
      } catch (dbError) {
        console.error(`Błąd przy zapisie powiadomienia dla użytkownika ${user.id}:`, dbError);
        // Kontynuujemy, bo e-mail nadal może zostać wysłany
      }
      
      // Pobierz subskrypcję powiadomień push (jeśli istnieje)
      const subscription = await storage.getSubscription(user.id);
      
      // Wyślij powiadomienia (email i push)
      if (user.email) {
        const notificationResult = await sendNotification(
          user.email, 
          subscription || null, 
          title, 
          message, 
          { url: `/orders/${order.id}` }
        );
        
        console.log(`Powiadomienia dla ${user.email}:`, notificationResult);
      }
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
}

/**
 * Funkcja wysyłająca powiadomienia o zmianie statusu transportu
 */
async function sendTransportStatusNotifications(orderId: number, transportStatus: string) {
  // Normalizacja statusu transportu
  transportStatus = normalizeTransportStatus(transportStatus) || "zaplanowany";
  try {
    const order = await storage.getOrder(orderId);
    if (!order) return;
    
    // Definiowanie tekstów powiadomień na podstawie statusu transportu
    let title = "Aktualizacja statusu transportu";
    let message = `Status transportu dla zlecenia #${order.orderNumber} został zmieniony.`;
    
    if (transportStatus === "skompletowany") {
      title = "Zlecenie gotowe do transportu";
      message = `Zlecenie #${order.orderNumber} jest gotowe do transportu.`;
    } else if (transportStatus === "zaplanowany") {
      title = "Transport zaplanowany";
      message = `Transport dla zlecenia #${order.orderNumber} został zaplanowany na ${new Date(order.transportDate || "").toLocaleDateString('pl-PL')}.`;
    } else if (transportStatus === "dostarczony") {
      title = "Transport dostarczony";
      message = `Produkty dla zlecenia #${order.orderNumber} zostały dostarczone pod adres ${order.installationAddress}.`;
    }
    
    // Pobierz użytkowników, którzy powinni otrzymać powiadomienia
    // 1. Pracownicy sklepu, który złożył zamówienie
    const storeWorkers = await storage.getUsersByRole("worker");
    const relevantWorkers = storeWorkers.filter(worker => worker.storeId === order.storeId);
    
    // 2. Firma transportowa (w tym przypadku użytkownik firmy, która obsługuje transport)
    const companyUsers = await storage.getUsersByRole("company");
    const relevantCompanyUsers = companyUsers.filter(user => user.companyId === order.companyId);
    
    // 3. Pracownik, który utworzył zamówienie
    let orderCreator = null;
    if (order.userId) {
      orderCreator = await storage.getUser(order.userId);
    }
    
    // 4. Montażysta przypisany do zlecenia (też powinien wiedzieć o statusie transportu)
    let assignedInstaller = null;
    if (order.installerId) {
      assignedInstaller = await storage.getUser(order.installerId);
    }
    
    // 5. Transporter przypisany do zlecenia (kluczowa osoba dla powiadomień o transporcie)
    let assignedTransporter = null;
    if (order.transporterId) {
      assignedTransporter = await storage.getUser(order.transporterId);
    }
    
    // Wszyscy użytkownicy, którzy powinni być powiadomieni
    const usersToNotify = [
      ...relevantWorkers,
      ...relevantCompanyUsers
    ];
    
    // Dodaj twórcę zamówienia jeśli nie jest na liście
    if (orderCreator && !usersToNotify.some(user => user.id === orderCreator?.id)) {
      usersToNotify.push(orderCreator);
    }
    
    // Dodaj montażystę jeśli nie jest na liście
    if (assignedInstaller && !usersToNotify.some(user => user.id === assignedInstaller?.id)) {
      usersToNotify.push(assignedInstaller);
    }
    
    // Dodaj transportera jeśli nie jest na liście
    if (assignedTransporter && !usersToNotify.some(user => user.id === assignedTransporter?.id)) {
      usersToNotify.push(assignedTransporter);
    }
    
    // Stwórz powiadomienia w bazie danych i wyślij je
    for (const user of usersToNotify) {
      // Dodaj powiadomienie do bazy danych
      try {
        await storage.createNotification({
          userId: user.id,
          title,
          message,
          data: { url: `/orders/${order.id}` }
        });
      } catch (dbError) {
        console.error(`Błąd przy zapisie powiadomienia o transporcie dla użytkownika ${user.id}:`, dbError);
        // Kontynuujemy, bo e-mail nadal może zostać wysłany
      }
      
      // Pobierz subskrypcję powiadomień push (jeśli istnieje)
      const subscription = await storage.getSubscription(user.id);
      
      // Wyślij powiadomienia (email i push)
      if (user.email) {
        const notificationResult = await sendNotification(
          user.email, 
          subscription || null, 
          title, 
          message, 
          { url: `/orders/${order.id}` }
        );
        
        console.log(`Powiadomienia o transporcie dla ${user.email}:`, notificationResult);
      }
    }
  } catch (error) {
    console.error("Error sending transport status notifications:", error);
  }
}
