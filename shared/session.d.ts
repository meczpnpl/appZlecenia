import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user: {
      id: number;
      role: string;
      email: string;
      name: string;
      storeId?: number;
      companyId?: number;
      companyName?: string;
      position?: string;
      [key: string]: any;
    }
  }
}