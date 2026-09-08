import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiPost, clearToken, getToken, setToken, setUnauthorizedHandler } from "../api/client";

type AuthUser = {
  id: number;
  email: string;
};

type AuthResponse = {
  userId: number;
  email: string;
  token: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const token = getToken();
  const email = localStorage.getItem("quizapp_email");
  const userId = localStorage.getItem("quizapp_user_id");

  if (!token || !email || !userId) {
    return null;
  }

  return { id: Number(userId), email };
}

function storeUser(response: AuthResponse) {
  setToken(response.token);
  localStorage.setItem("quizapp_email", response.email);
  localStorage.setItem("quizapp_user_id", String(response.userId));
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  useEffect(() => {
    setUnauthorizedHandler(() => {
      localStorage.removeItem("quizapp_email");
      localStorage.removeItem("quizapp_user_id");
      setUser(null);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiPost<AuthResponse>("/api/auth/login", { email, password });
    storeUser(response);
    setUser({ id: response.userId, email: response.email });
  };

  const register = async (email: string, password: string) => {
    const response = await apiPost<AuthResponse>("/api/auth/register", { email, password });
    storeUser(response);
    setUser({ id: response.userId, email: response.email });
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("quizapp_email");
    localStorage.removeItem("quizapp_user_id");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthProvider, useAuth };
