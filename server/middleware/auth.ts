import { Request, Response, NextFunction } from "express";

// Middleware to check if user is authenticated
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Nie jesteś zalogowany" });
  }
  next();
}

// Middleware to check if user is admin
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.session.user?.role !== "admin") {
    return res.status(403).json({ message: "Brak uprawnień. Wymagana rola: Administrator" });
  }
  next();
}

// Middleware to check if user is worker or admin
export function workerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.user?.role !== "worker" && req.session.user?.role !== "admin") {
    return res.status(403).json({ message: "Brak uprawnień. Wymagana rola: Pracownik lub Administrator" });
  }
  next();
}

// Middleware to check if user is manager, deputy manager or admin
export function managerOrDeputyOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (
    !(req.session.user?.role === "admin" || 
    (req.session.user?.role === "worker" && 
    (req.session.user?.position === "kierownik" || req.session.user?.position === "zastępca")))
  ) {
    return res.status(403).json({ 
      message: "Brak uprawnień. Wymagana rola: Administrator, Kierownik lub Zastępca kierownika" 
    });
  }
  next();
}

// Middleware to check if user is any type of store worker or admin (including regular salespeople)
export function anyWorkerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (
    !(req.session.user?.role === "admin" || req.session.user?.role === "worker")
  ) {
    return res.status(403).json({ 
      message: "Brak uprawnień. Wymagana rola: Administrator lub Pracownik sklepu" 
    });
  }
  next();
}

// Middleware to check if user is manager only
export function managerOnly(req: Request, res: Response, next: NextFunction) {
  if (
    !(req.session.user?.role === "worker" && req.session.user?.position === "kierownik")
  ) {
    return res.status(403).json({ 
      message: "Brak uprawnień. Wymagana rola: Kierownik" 
    });
  }
  next();
}

// Middleware to check if user is company owner or admin
export function companyOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.user?.role !== "company" && req.session.user?.role !== "admin") {
    return res.status(403).json({ message: "Brak uprawnień. Wymagana rola: Firma lub Administrator" });
  }
  next();
}

// Middleware to check if user is company owner
export function companyOnly(req: Request, res: Response, next: NextFunction) {
  if (req.session.user?.role !== "company") {
    return res.status(403).json({ message: "Brak uprawnień. Wymagana rola: Firma" });
  }
  next();
}

// Middleware to check if user is installer
export function installerOnly(req: Request, res: Response, next: NextFunction) {
  // Installerzy lub właściciele firm, którzy są również montażystami (companyOwnerOnly = false)
  if (
    req.session.user?.role !== "installer" && 
    !(req.session.user?.role === "company" && req.session.user?.companyOwnerOnly === false)
  ) {
    return res.status(403).json({ message: "Brak uprawnień. Wymagana rola: Montażysta" });
  }
  next();
}

// Middleware to check if user has access to a specific store
export function storeAccess(req: Request, res: Response, next: NextFunction) {
  const storeId = parseInt(req.params.storeId || req.query.storeId as string);
  
  if (req.session.user?.role === "admin") {
    return next(); // Admin has access to all stores
  }
  
  if (req.session.user?.role === "worker" && req.session.user?.storeId === storeId) {
    return next(); // Worker has access to their own store
  }
  
  return res.status(403).json({ message: "Brak uprawnień dostępu do tego sklepu" });
}

// Middleware to check if user has access to a specific company
export function companyAccess(req: Request, res: Response, next: NextFunction) {
  const companyId = parseInt(req.params.companyId || req.query.companyId as string);
  
  if (req.session.user?.role === "admin") {
    return next(); // Admin has access to all companies
  }
  
  if (req.session.user?.role === "company" && req.session.user?.companyId === companyId) {
    return next(); // Company owner has access to their own company
  }
  
  if (req.session.user?.role === "installer" && req.session.user?.companyId === companyId) {
    return next(); // Installer has access to their own company
  }
  
  return res.status(403).json({ message: "Brak uprawnień dostępu do tej firmy" });
}

// Middleware sprawdzające, czy użytkownik ma prawo edytować pola finansowe
export function canEditFinancialFields(req: Request, res: Response, next: NextFunction) {
  const user = req.session.user;
  
  // Administratorzy zawsze mają dostęp
  if (user?.role === "admin") {
    return next();
  }
  
  // Wszyscy pracownicy sklepu mają dostęp (nie tylko kierownicy i zastępcy)
  if (user?.role === "worker") {
    return next();
  }
  
  // Właściciele firm mają dostęp (zarówno ci, którzy są montażystami jak i nie)
  if (user?.role === "company") {
    return next();
  }
  
  // Firmy jednoosobowe (montażyści z przypisaną firmą) mają dostęp
  if (
    user?.role === "installer" && 
    user?.companyId !== undefined && 
    user?.companyName
  ) {
    // Sprawdź czy żądanie dotyczy tylko pola willBeSettled
    const requestBody = req.body;
    
    // Pozwól na edycję pola willBeSettled
    if (
      requestBody.field === 'willBeSettled' &&
      typeof requestBody.value === 'boolean'
    ) {
      return next();
    }
  }
  
  return res.status(403).json({ 
    message: "Brak uprawnień do edycji pól finansowych" 
  });
}
