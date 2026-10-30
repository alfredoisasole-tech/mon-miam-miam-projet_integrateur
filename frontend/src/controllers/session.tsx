import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "../models/http";
import type { User } from "../models/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

interface RestaurantContextValue {
  slug: string | null;
  setRestaurant: (slug: string) => void;
  clearRestaurant: () => void;
}

// ─── Clés localStorage (centralisées) ────────────────────────────────────────

const TOKEN_KEY = "mmm_token";
const RESTAURANT_KEY = "mmm_restaurant";

// ─── Helpers localStorage sécurisés ──────────────────────────────────────────

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage indisponible (navigation privée, quota…) → on ignore
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // idem
  }
}

// ─── AuthProvider ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Au montage : si un jeton existe, on charge le profil
  useEffect(() => {
    const token = safeGet(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get<User>("/me")
      .then(setUser)
      .catch((err) => {
        // 401 → jeton invalide ou expiré → on déconnecte
        if (err?.code === "UNAUTHORIZED" || err?.status === 401) {
          logout();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (token: string) => {
    safeSet(TOKEN_KEY, token);
    const profile = await api.get<User>("/me");
    setUser(profile);
  };

  const logout = () => {
    safeRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return ctx;
}

// ─── RestaurantProvider ──────────────────────────────────────────────────────

const RestaurantContext = createContext<RestaurantContextValue | undefined>(
  undefined
);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [slug, setSlugState] = useState<string | null>(() =>
    safeGet(RESTAURANT_KEY)
  );

  const setRestaurant = (newSlug: string) => {
    safeSet(RESTAURANT_KEY, newSlug);
    setSlugState(newSlug);
  };

  const clearRestaurant = () => {
    safeRemove(RESTAURANT_KEY);
    setSlugState(null);
  };

  return (
    <RestaurantContext.Provider
      value={{ slug, setRestaurant, clearRestaurant }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurant(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error(
      "useRestaurant doit être utilisé dans un RestaurantProvider"
    );
  }
  return ctx;
}