import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("worker"), // admin, worker, company, installer
  storeId: integer("store_id"),
  store: text("store"),
  position: text("position"), // kierownik, zastępca, doradca
  companyId: integer("company_id"),
  companyName: text("company_name"),
  nip: text("nip"),
  companyAddress: text("company_address"),
  services: text("services").array(),
  companyOwnerOnly: boolean("company_owner_only").default(true), // Czy właściciel jest tylko właścicielem (true) czy również montażystą (false)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Store Model
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  status: text("status").default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Company Model
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nip: text("nip").notNull(),
  address: text("address"),
  contactName: text("contact_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  services: text("services").array(), // montaż drzwi, montaż podłogi, transport
  status: text("status").default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Order Model
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  installationAddress: text("installation_address").notNull(),
  serviceType: text("service_type").notNull(), // montaż drzwi, montaż podłogi
  withTransport: boolean("with_transport").default(false),
  proposedDate: text("proposed_date").notNull(),
  notes: text("notes"),
  documentsProvided: boolean("documents_provided").default(false),
  status: text("status").default("zlecenie złożone"), // DEPRECATED - używaj installationStatus i transportStatus
  transportStatus: text("transport_status"), // skompletowany, zaplanowany, dostarczony
  installationStatus: text("installation_status").default("nowe"), // status montażu: nowe, zaplanowany, w trakcie, zakończony, reklamacja
  complaintNotes: text("complaint_notes"),
  complaintPhotos: text("complaint_photos").array(),
  installerId: integer("installer_id"),
  installerName: text("installer_name"),
  transporterId: integer("transporter_id"), // ID montażysty odpowiedzialnego za transport
  transporterName: text("transporter_name"), // Imię montażysty odpowiedzialnego za transport
  transportDate: timestamp("transport_date"), // Data transportu
  companyId: integer("company_id").notNull(),
  companyName: text("company_name").notNull(),
  storeId: integer("store_id").notNull(),
  storeName: text("store_name").notNull(),
  userId: integer("user_id").notNull(), // user who created the order
  userName: text("user_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  installationDate: timestamp("installation_date"),
  orderValue: doublePrecision("order_value"), // wartość zlecenia netto
  warehouseValue: doublePrecision("warehouse_value"), // wartość wydania magazynowego netto
  serviceValue: doublePrecision("service_value"), // wartość kosztów usługi netto
  invoiceIssued: boolean("invoice_issued").default(false), // czy faktura za montaż została wystawiona
  willBeSettled: boolean("will_be_settled").default(false), // czy będzie rozliczone w danym miesiącu
});

// Sales Plan Model
export const salesPlans = pgTable("sales_plans", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  storeId: integer("store_id").notNull(),
  storeName: text("store_name").notNull(),
  target: doublePrecision("target").notNull(), // plan do realizacji
  actualSales: doublePrecision("actual_sales").default(0), // dane z systemu księgowego
  productSales: doublePrecision("product_sales").default(0), // sprzedaż produktów netto
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notification Model
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").default(false),
  data: jsonb("data"), // additional data like redirectUrl etc.
  relatedId: integer("related_id"), // id powiązanego rekordu, np. id zlecenia
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Subscription Model for Push Notifications
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  expirationTime: timestamp("expiration_time"),
  keys: jsonb("keys").notNull(), // p256dh and auth keys
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Photo Model for permanent storage of complaint photos
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimetype: text("mimetype").notNull(),
  filePath: text("file_path").notNull(), // Ścieżka do pliku na dysku
  fileSize: integer("file_size").notNull(), // Rozmiar pliku w bajtach
  type: text("type").default("installation"), // Typ zdjęcia: 'installation' lub 'complaint'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// UserFilters Model - przechowuje zapisane filtry użytkownika
export const userFilters = pgTable("user_filters", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(), // Nazwa zestawu filtrów
  isDefault: boolean("is_default").default(false), // Czy to domyślny zestaw filtrów
  filtersData: jsonb("filters_data").notNull(), // JSON z ustawieniami filtrów
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Company-Store relation (many-to-many)
export const companyStores = pgTable('company_stores', {
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  storeId: integer('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey(t.companyId, t.storeId),
}));

// Relations

export const usersRelations = relations(users, ({ many, one }: { many: any, one: any }) => ({
  orders: many(orders, { relationName: "user_orders" }),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
    relationName: "user_company"
  }),
  store: one(stores, {
    fields: [users.storeId],
    references: [stores.id],
    relationName: "user_store"
  }),
  notifications: many(notifications, { relationName: "user_notifications" }),
  subscriptions: many(subscriptions, { relationName: "user_subscriptions" }),
  userFilters: many(userFilters, { relationName: "user_filters" })
}));

export const storesRelations = relations(stores, ({ many }: { many: any }) => ({
  users: many(users, { relationName: "user_store" }),
  orders: many(orders, { relationName: "store_orders" }),
  companyStores: many(companyStores, { relationName: "store_companies" })
}));

export const companiesRelations = relations(companies, ({ many }: { many: any }) => ({
  users: many(users, { relationName: "user_company" }),
  orders: many(orders, { relationName: "company_orders" }),
  companyStores: many(companyStores, { relationName: "company_stores" })
}));

export const companyStoresRelations = relations(companyStores, ({ one }: { one: any }) => ({
  company: one(companies, {
    fields: [companyStores.companyId],
    references: [companies.id],
    relationName: "company_stores"
  }),
  store: one(stores, {
    fields: [companyStores.storeId],
    references: [stores.id],
    relationName: "store_companies"
  })
}));

export const ordersRelations = relations(orders, ({ one, many }: { one: any, many: any }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
    relationName: "user_orders"
  }),
  company: one(companies, {
    fields: [orders.companyId],
    references: [companies.id],
    relationName: "company_orders"
  }),
  installer: one(users, {
    fields: [orders.installerId],
    references: [users.id],
    relationName: "installer_orders"
  }),
  transporter: one(users, {
    fields: [orders.transporterId],
    references: [users.id],
    relationName: "transporter_orders"
  }),
  photos: many(photos, { relationName: "order_photos" })
}));

export const notificationsRelations = relations(notifications, ({ one }: { one: any }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: "user_notifications"
  })
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }: { one: any }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
    relationName: "user_subscriptions"
  })
}));

export const userFiltersRelations = relations(userFilters, ({ one }: { one: any }) => ({
  user: one(users, {
    fields: [userFilters.userId],
    references: [users.id],
    relationName: "user_filters"
  })
}));

// Insert Schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    services: z.array(z.string()).default([]),
    // Obsługa konwersji storeId i companyId ze string na number
    storeId: z.union([
      z.string().transform(val => val ? parseInt(val, 10) : null),
      z.number().nullable().optional()
    ]),
    companyId: z.union([
      z.string().transform(val => val ? parseInt(val, 10) : null),
      z.number().nullable().optional()
    ])
  });
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCompanyStoreSchema = createInsertSchema(companyStores).omit({});
// Tworzymy schemat zamówienia i modyfikujemy go, aby companyId był stringiem w API
export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // W API i formularzu companyId jest stringiem, ale w bazie danych jest liczbą
    companyId: z.string().transform(val => parseInt(val, 10)),
    // Pole orderNumber może być dostarczane przez serwer
    orderNumber: z.string().optional(),
    // Upewniamy się, że companyName jest zawsze podane
    companyName: z.string().min(1, { message: "Nazwa firmy jest wymagana" }),
    // Obsługa daty instalacji - może być pustym stringiem, który mapujemy na null
    installationDate: z.union([
      z.string().transform(val => val === '' ? null : new Date(val)),
      z.date().nullable().optional()
    ]),
    // Opcjonalne pola statusu
    transportStatus: z.string().optional(),
    installationStatus: z.string().optional(),
    // Opcjonalne pola finansowe
    willBeSettled: z.boolean().optional().default(false),
    invoiceIssued: z.boolean().optional().default(false)
  });
export const insertSalesPlanSchema = createInsertSchema(salesPlans).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true }).extend({
  type: z.string().optional(),
  relatedId: z.number().optional(),
});
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, createdAt: true }).extend({
  type: z.enum(["installation", "complaint"]).default("installation"),
});
export const insertUserFilterSchema = createInsertSchema(userFilters).omit({ id: true, createdAt: true, updatedAt: true });

// Update Schemas
export const updateOrderStatusSchema = z.object({
  // Status instalacji/montażu
  installationStatus: z.enum([
    'Nowe',
    'Zaplanowane',
    'W realizacji',
    'Zakończone',
    'Reklamacja'
  ], {
    invalid_type_error: "Nieprawidłowy status instalacji",
    required_error: "Status instalacji jest wymagany"
  }),
  
  // Status transportu  
  transportStatus: z.enum([
    'skompletowany',
    'zaplanowany',
    'dostarczony'
  ], {
    invalid_type_error: "Nieprawidłowy status transportu"
  }).optional(),
  
  // Data montażu
  installationDate: z.union([
    z.string().transform(val => val === '' ? null : new Date(val)),
    z.date().nullable().optional()
  ]).optional(),
  
  // Inne pola
  comments: z.string().optional(),
  complaintNotes: z.string().optional(),
  complaintPhotos: z.array(z.string()).optional(),
  
  // Opcjonalne pola finansowe
  willBeSettled: z.boolean().optional(),
  invoiceIssued: z.boolean().optional(),
  documentsProvided: z.boolean().optional()
});

export const assignInstallerSchema = z.object({
  installerId: z.number().int().positive(),
  installationDate: z.union([
    z.string().transform(val => {
      if (val === '') return new Date(); // Domyślnie dzisiejsza data zamiast null
      return new Date(val);
    }),
    z.date()
  ]), // Data w formacie ISO z transformacją na obiekt Date
});

export const assignTransporterSchema = z.object({
  transporterId: z.number().int().positive(),
  transportDate: z.union([
    z.string().transform(val => {
      if (val === '') return new Date(); // Domyślnie dzisiejsza data zamiast null
      return new Date(val);
    }),
    z.date()
  ]), // Data w formacie ISO z transformacją na obiekt Date
  transportStatus: z.enum([
    'skompletowany',
    'zaplanowany',
    'dostarczony'
  ], {
    invalid_type_error: "Nieprawidłowy status transportu"
  }).optional(), // Status transportu jako opcjonalny parametr
});

export const updateOrderFinancialStatusSchema = z.object({
  invoiceIssued: z.boolean().optional(),
  willBeSettled: z.boolean().optional(),
});

// Specjalny schemat dla aktualizacji statusu transportu
export const updateTransportStatusSchema = z.object({
  transportStatus: z.enum([
    'skompletowany',
    'zaplanowany',
    'dostarczony'
  ], {
    invalid_type_error: "Nieprawidłowy status transportu",
    required_error: "Status transportu jest wymagany"
  }),
  comments: z.string().optional(),
  transportDate: z.union([
    z.string().transform(val => {
      if (val === '') return undefined;
      return new Date(val);
    }),
    z.date().optional()
  ]).optional(), // Data transportu jako opcjonalny parametr
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type CreateOrder = z.infer<typeof insertOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type AssignInstaller = z.infer<typeof assignInstallerSchema>;
export type AssignTransporter = z.infer<typeof assignTransporterSchema>;
export type UpdateOrderFinancialStatus = z.infer<typeof updateOrderFinancialStatusSchema>;
export type UpdateTransportStatus = z.infer<typeof updateTransportStatusSchema>;

export type SalesPlan = typeof salesPlans.$inferSelect;
export type InsertSalesPlan = z.infer<typeof insertSalesPlanSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

export type CompanyStore = typeof companyStores.$inferSelect;
export type InsertCompanyStore = z.infer<typeof insertCompanyStoreSchema>;

// Settings Model
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // notifications, company, order, system, integrations, ui
  key: text("key").notNull().unique(),
  value: text("value"),
  valueJson: jsonb("value_json"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, createdAt: true, updatedAt: true });

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;

export type UserFilter = typeof userFilters.$inferSelect;
export type InsertUserFilter = z.infer<typeof insertUserFilterSchema>;
