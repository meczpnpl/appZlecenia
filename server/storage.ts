import type { User, InsertUser, Company, InsertCompany, Order, InsertOrder, SalesPlan, InsertSalesPlan, Notification, InsertNotification, Subscription, InsertSubscription, UpdateOrderStatus, AssignInstaller, AssignTransporter, Photo, InsertPhoto, Store, InsertStore, Setting, InsertSetting, CompanyStore, InsertCompanyStore, UserFilter, InsertUserFilter } from "@shared/schema";

// Define the storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  getUsers(searchTerm?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Store methods
  getStore(id: number): Promise<Store | undefined>;
  getStores(): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, store: Partial<InsertStore>): Promise<Store | undefined>;
  deleteStore(id: number): Promise<boolean>;
  
  // Company methods
  getCompany(id: number): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  
  // Order methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrders(filters?: { 
    search?: string, 
    installationStatus?: string, 
    storeId?: number,
    companyId?: number,
    installerId?: number,
    installerWithCompany?: boolean
  }): Promise<Order[]>;
  getRecentOrders(limit?: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderStatus(id: number, data: UpdateOrderStatus): Promise<Order | undefined>;
  assignInstallerToOrder(id: number, data: AssignInstaller): Promise<Order | undefined>;
  assignTransporterToOrder(id: number, data: AssignTransporter): Promise<Order | undefined>;
  assignCompanyToOrder(id: number, companyId: number): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;
  
  // Sales Plan methods
  getSalesPlan(year: number, month: number, storeId?: number): Promise<SalesPlan[]>;
  createSalesPlan(plan: InsertSalesPlan): Promise<SalesPlan>;
  updateSalesPlan(id: number, plan: Partial<InsertSalesPlan>): Promise<SalesPlan | undefined>;
  
  // Notification methods
  getNotifications(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  
  // Subscription methods
  getSubscription(userId: number): Promise<Subscription | undefined>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  deleteSubscription(id: number): Promise<boolean>;
  
  // Photo methods
  getOrderPhotos(orderId: number): Promise<Photo[]>;
  getPhoto(id: number): Promise<Photo | undefined>;
  savePhoto(photo: InsertPhoto): Promise<Photo>;
  deletePhoto(id: number): Promise<boolean>;
  
  // Settings methods
  getSetting(key: string): Promise<Setting | undefined>;
  getSettingsByCategory(category: string): Promise<Setting[]>;
  getAllSettings(): Promise<Setting[]>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string | object | null): Promise<Setting | undefined>;
  deleteSetting(key: string): Promise<boolean>;
  
  // Company-Store relations methods
  getCompanyStores(companyId: number): Promise<Store[]>;
  getStoreCompanies(storeId: number): Promise<Company[]>;
  addCompanyStore(companyId: number, storeId: number): Promise<CompanyStore>;
  removeCompanyStore(companyId: number, storeId: number): Promise<boolean>;
  updateCompanyStores(companyId: number, storeIds: number[]): Promise<CompanyStore[]>;
  
  // User Filter methods
  getUserFilters(userId: number): Promise<UserFilter[]>;
  getUserFilterById(id: number): Promise<UserFilter | undefined>;
  getUserDefaultFilter(userId: number): Promise<UserFilter | undefined>;
  createUserFilter(filter: InsertUserFilter): Promise<UserFilter>;
  updateUserFilter(id: number, filter: Partial<InsertUserFilter>): Promise<UserFilter | undefined>;
  setUserDefaultFilter(userId: number, filterId: number): Promise<boolean>;
  deleteUserFilter(id: number): Promise<boolean>;
}

import { DatabaseStorage } from "./database-storage";

// Używamy DatabaseStorage do interakcji z bazą danych
export const storage = new DatabaseStorage();
