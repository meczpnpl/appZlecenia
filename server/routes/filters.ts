import { Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { storage } from "../storage";
import { InsertUserFilter } from "../../shared/schema";

// Funkcja konfigurująca endpointy API dla zarządzania filtrami
export function registerFilterRoutes(app: any) {
  // Pobieranie zapisanych filtrów dla bieżącego użytkownika
  app.get("/api/filters", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const filters = await storage.getUserFilters(userId);
      res.status(200).json(filters);
    } catch (error) {
      console.error("Błąd podczas pobierania filtrów:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas pobierania filtrów" });
    }
  });

  // Pobieranie domyślnego filtra użytkownika
  app.get("/api/filters/default", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const filter = await storage.getUserDefaultFilter(userId);
      
      if (!filter) {
        return res.status(404).json({ message: "Domyślny filtr nie znaleziony" });
      }
      
      res.status(200).json(filter);
    } catch (error) {
      console.error("Błąd podczas pobierania domyślnego filtra:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas pobierania domyślnego filtra" });
    }
  });

  // Pobieranie konkretnego filtra po ID
  app.get("/api/filters/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }

      const filter = await storage.getUserFilterById(filterId);
      if (!filter) {
        return res.status(404).json({ message: "Filtr nie został znaleziony" });
      }

      // Sprawdź czy filtr należy do bieżącego użytkownika
      if (filter.userId !== req.session.user!.id) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }

      res.status(200).json(filter);
    } catch (error) {
      console.error("Błąd podczas pobierania filtra:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas pobierania filtra" });
    }
  });

  // Zapisywanie nowego zestawu filtrów
  app.post("/api/filters", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const { name, filtersData, isDefault } = req.body;

      if (!name || !filtersData) {
        return res.status(400).json({ message: "Nazwa i dane filtrów są wymagane" });
      }

      // Utworzenie nowego filtra
      const newFilter = await storage.createUserFilter({
        userId,
        name,
        filtersData,
        isDefault: isDefault || false
      });

      // Jeśli to domyślny filtr, upewnij się, że inne filtry nie są domyślne
      if (isDefault) {
        await storage.setUserDefaultFilter(userId, newFilter.id);
      }

      res.status(201).json({
        message: "Filtr został pomyślnie zapisany",
        filter: newFilter
      });
    } catch (error) {
      console.error("Błąd podczas zapisywania filtra:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas zapisywania filtra" });
    }
  });

  // Aktualizacja zestawu filtrów
  app.put("/api/filters/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }

      // Sprawdź czy filtr istnieje
      const existingFilter = await storage.getUserFilterById(filterId);
      if (!existingFilter) {
        return res.status(404).json({ message: "Filtr nie został znaleziony" });
      }

      // Sprawdź czy filtr należy do bieżącego użytkownika
      if (existingFilter.userId !== req.session.user!.id) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }

      const { name, filtersData, isDefault } = req.body;
      const updateData: Partial<InsertUserFilter> = {};

      if (name !== undefined) updateData.name = name;
      if (filtersData !== undefined) updateData.filtersData = filtersData;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      // Aktualizacja filtra
      const updatedFilter = await storage.updateUserFilter(filterId, updateData);

      // Jeśli to domyślny filtr, upewnij się, że inne filtry nie są domyślne
      if (isDefault) {
        await storage.setUserDefaultFilter(req.session.user!.id, filterId);
      }

      res.status(200).json({
        message: "Filtr został pomyślnie zaktualizowany",
        filter: updatedFilter
      });
    } catch (error) {
      console.error("Błąd podczas aktualizacji filtra:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas aktualizacji filtra" });
    }
  });

  // Ustawienie filtra jako domyślnego
  app.post("/api/filters/:id/default", authMiddleware, async (req: Request, res: Response) => {
    try {
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }

      // Sprawdź czy filtr istnieje
      const existingFilter = await storage.getUserFilterById(filterId);
      if (!existingFilter) {
        return res.status(404).json({ message: "Filtr nie został znaleziony" });
      }

      // Sprawdź czy filtr należy do bieżącego użytkownika
      if (existingFilter.userId !== req.session.user!.id) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }

      // Ustaw filtr jako domyślny
      const result = await storage.setUserDefaultFilter(req.session.user!.id, filterId);
      
      if (result) {
        res.status(200).json({ 
          success: true,
          message: "Filtr został ustawiony jako domyślny" 
        });
      } else {
        res.status(500).json({ 
          success: false,
          message: "Nie udało się ustawić filtra jako domyślnego" 
        });
      }
    } catch (error) {
      console.error("Błąd podczas ustawiania domyślnego filtra:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas ustawiania domyślnego filtra" });
    }
  });

  // Usuwanie zestawu filtrów
  app.delete("/api/filters/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const filterId = parseInt(req.params.id);
      if (isNaN(filterId)) {
        return res.status(400).json({ message: "Nieprawidłowe ID filtra" });
      }

      // Sprawdź czy filtr istnieje
      const existingFilter = await storage.getUserFilterById(filterId);
      if (!existingFilter) {
        return res.status(404).json({ message: "Filtr nie został znaleziony" });
      }

      // Sprawdź czy filtr należy do bieżącego użytkownika
      if (existingFilter.userId !== req.session.user!.id) {
        return res.status(403).json({ message: "Brak dostępu do tego filtra" });
      }

      // Usuń filtr
      const result = await storage.deleteUserFilter(filterId);
      
      if (result) {
        res.status(200).json({ 
          success: true, 
          message: "Filtr został pomyślnie usunięty" 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Nie udało się usunąć filtra" 
        });
      }
    } catch (error) {
      console.error("Błąd podczas usuwania filtra:", error);
      res.status(500).json({ message: "Wystąpił błąd podczas usuwania filtra" });
    }
  });
}