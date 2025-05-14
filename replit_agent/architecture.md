# Architecture Overview

## 1. Overview

This repository contains a full-stack web application for Bel-Pol, a company that manages orders, installations, and sales across multiple stores. The system serves different user roles including administrators, store workers, company representatives, and installers.

The application is built using a modern JavaScript/TypeScript stack with a clear separation between frontend and backend components. It follows a REST API architecture pattern where the backend serves data to the frontend through well-defined API endpoints.

### Core Features

- User authentication and role-based access control
- Order management system
- Store and company management
- Installer scheduling and assignment
- Sales plan tracking
- Push notifications and email notifications
- File upload and management for order photos

## 2. System Architecture

The system follows a client-server architecture with the following major components:

1. **Frontend**: React-based single-page application (SPA) with TypeScript
2. **Backend**: Node.js/Express.js REST API server
3. **Database**: PostgreSQL database (accessed via Drizzle ORM)
4. **Authentication**: Session-based authentication using express-session
5. **Storage**: File storage for uploaded images and documents

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │         │             │         │             │
│   Client    │ ◄─────► │   Server    │ ◄─────► │  Database   │
│  (React)    │   REST  │  (Express)  │ Drizzle │ (PostgreSQL)│
│             │   API   │             │   ORM   │             │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │  File       │
                        │  Storage    │
                        │             │
                        └─────────────┘
```

## 3. Key Components

### 3.1. Frontend Architecture

The frontend is built using:

- **React**: Core UI library
- **TypeScript**: Type safety throughout the codebase
- **React Query**: Data fetching and state management
- **Wouter**: Lightweight router for navigation
- **Radix UI**: Accessible UI components
- **TailwindCSS**: Utility-first CSS framework
- **Shadcn UI**: Component library built on Radix UI and Tailwind

The frontend follows a feature-based organization where components, pages, and related utilities are grouped by feature. It implements:

- **React Context API**: For authentication state management
- **Custom hooks**: For reusable logic (notifications, toasts, mobile detection)
- **Progressive Web App (PWA)** capabilities: Service worker for offline access and push notifications

### 3.2. Backend Architecture

The backend is implemented using:

- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **TypeScript**: Type safety
- **Drizzle ORM**: Database access layer
- **Zod**: Schema validation
- **Multer**: File upload handling
- **Bcrypt**: Password hashing
- **Nodemailer/SendGrid**: Email sending

The backend implements:

- **RESTful API**: Well-defined endpoints for data access and manipulation
- **Session-based authentication**: Using express-session with memory store
- **Role-based access control**: Different permissions for admin, worker, company, and installer roles
- **Database abstraction**: Storage interface for database operations
- **MVC-like pattern**: Separation of routes, business logic, and data access

### 3.3. Database Schema

The database uses PostgreSQL with the following core tables:

- **users**: User accounts with roles (admin, worker, company, installer)
- **stores**: Physical store locations
- **companies**: External companies providing installation services
- **orders**: Customer orders with status tracking
- **sales_plans**: Sales targets and tracking
- **notifications**: System notifications
- **photos**: Order-related images
- **settings**: System configuration settings
- **subscriptions**: Push notification subscriptions

Relationships between tables are managed through foreign keys, and Drizzle ORM provides the data access layer.

### 3.4. Authentication and Authorization

The system implements:

- **Session-based authentication**: Using express-session middleware
- **Role-based authorization**: Different middleware functions to protect routes based on user roles
- **Password hashing**: Using bcrypt for secure password storage

### 3.5. File Storage

The application handles file uploads with:

- **Multer**: For processing multipart/form-data
- **Local file storage**: Files are stored in the public/uploads directory
- **Migration capability**: System can migrate from base64 storage to file-based storage

## 4. Data Flow

### 4.1. Client-Server Communication

1. The frontend makes API requests to the backend using fetch API
2. React Query manages the request lifecycle, caching, and state updates
3. The backend processes requests through middleware (authentication, validation)
4. Controllers handle business logic and interact with the database through the storage interface
5. Responses are sent back to the client as JSON

### 4.2. Order Lifecycle

1. Orders are created by store workers
2. Orders can be assigned to installation companies
3. Companies assign installers to orders
4. Installers update order status during the installation process
5. Notifications are sent at various stages of the order lifecycle

## 5. External Dependencies

### 5.1. Third-Party Services

- **Google Maps API**: For address validation and mapping
- **Web Push API**: For push notifications
- **SMTP Email Service**: For sending email notifications

### 5.2. Key Libraries

#### Frontend
- React
- React Query
- Radix UI
- TailwindCSS
- Wouter
- Recharts (for data visualization)

#### Backend
- Express.js
- Drizzle ORM
- Web Push
- Nodemailer
- Multer
- Bcrypt

## 6. Deployment Strategy

The application is configured to be deployed in several environments:

### 6.1. Development Environment

- Vite development server for the frontend
- Local Express server for the backend
- Local or remote PostgreSQL database

### 6.2. Production Environment

- Static file serving for the built frontend assets
- Production-optimized Node.js server
- PostgreSQL database (potentially hosted on Neon Database)

### 6.3. Hosting Configuration

The application is set up to be deployed on Replit with:

- CI/CD workflow configured in the `.replit` file
- Build and run commands defined
- Port configuration for external access

### 6.4. Database Migration

The system includes scripts for:

- Migrating database schema using Drizzle Kit
- Migrating data between environments (local to external)
- Data cleanup and reset

## 7. Security Considerations

The system implements several security measures:

- **Password hashing**: Using bcrypt for secure password storage
- **Session management**: Secure session configuration with HTTP-only cookies
- **Input validation**: Using Zod for schema validation
- **Role-based access control**: Middleware to enforce permissions
- **HTTPS**: Configuration for secure communications in production

## 8. Progressive Web App Features

The application implements PWA capabilities:

- **Service Worker**: For offline access and background processing
- **Push Notifications**: For real-time alerts
- **Installable**: Web app manifest for installation on devices
- **Responsive Design**: Mobile-friendly interface

## 9. Extensibility

The architecture allows for easy extension through:

- **Modular components**: New UI components can be added with minimal changes
- **API abstraction**: New endpoints can be added by extending the routes
- **Storage interface**: Database operations are abstracted through an interface
- **Settings system**: Dynamic configuration stored in the database