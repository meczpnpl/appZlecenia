// V 1.8 - Zoptymalizowana, stabilna implementacja
import * as React from 'react';
import { queryClient } from "./queryClient";
import { User } from "@shared/schema";

// Define the shape of our authentication context
type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  isCompany: boolean;
  isInstaller: boolean;
};

// Domyślne wartości dla kontekstu
const defaultAuthContext: AuthContextType = {
  user: null,
  loading: true,
  login: async () => { throw new Error("AuthContext not initialized") },
  logout: async () => { throw new Error("AuthContext not initialized") },
  isAuthenticated: false,
  isAdmin: false,
  isWorker: false,
  isCompany: false,
  isInstaller: false,
};

// Create context with a default value
const AuthContext = React.createContext<AuthContextType>(defaultAuthContext);

// AuthProvider
export function AuthProvider(props: { children: React.ReactNode }) {
  console.log("AuthProvider v1.8 renderowany");
  
  // State
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Check if user is logged in on component mount
  React.useEffect(() => {
    // Funkcja do sprawdzenia autentykacji
    async function checkAuth() {
      try {
        console.log("Sprawdzanie autentykacji użytkownika...");
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          headers: {
            'Accept': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Zalogowany użytkownik:", data);
          setUser(data);
        } else {
          console.log("Nie zalogowany, status:", response.status);
          setUser(null);
        }
      } catch (error) {
        console.error("Błąd sprawdzania autoryzacji:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      console.log("Próba logowania dla:", email);
      
      // Używamy fetch zamiast apiRequest dla dokładniejszej diagnostyki
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Błąd logowania:", errorText);
        throw new Error(`Logowanie nieudane: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error("Błąd logowania:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      
      // Clear user state
      setUser(null);
      
      // Clear cache
      queryClient.clear();
      
      // Redirect to login page
      window.location.href = "/login";
    } catch (error) {
      console.error("Błąd wylogowania:", error);
    }
  };

  // Derived state
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isWorker = user?.role === "worker";
  const isCompany = user?.role === "company";
  const isInstaller = user?.role === "installer";

  // Context value
  const value = React.useMemo(() => ({
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isWorker,
    isCompany,
    isInstaller,
  }), [user, loading, isAuthenticated, isAdmin, isWorker, isCompany, isInstaller]);

  return (
    <AuthContext.Provider value={value}>
      {props.children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
