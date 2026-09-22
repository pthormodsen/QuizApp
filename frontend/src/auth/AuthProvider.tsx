import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiPost, clearToken, getToken, isDemoMode, setToken, setUnauthorizedHandler } from "../api/client";
import { AuthContext } from "./AuthContext";
import type { AuthUser } from "./AuthContext";

type AuthResponse = {
  userId: number;
  email: string;
  token: string;
};

function readStoredUser(): AuthUser | null {
  if (isDemoMode()) {
    return { id: 1, email: "demo@example.com" };
  }

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
    if (isDemoMode()) {
      setUser({ id: 1, email: "demo@example.com" });
      return;
    }

    const response = await apiPost<AuthResponse>("/api/auth/login", { email, password });
    storeUser(response);
    setUser({ id: response.userId, email: response.email });
  };

  const register = async (email: string, password: string) => {
    if (isDemoMode()) {
      setUser({ id: 1, email: "demo@example.com" });
      return;
    }

    const response = await apiPost<AuthResponse>("/api/auth/register", { email, password });
    storeUser(response);
    setUser({ id: response.userId, email: response.email });
  };

  const logout = () => {
    if (isDemoMode()) {
      setUser({ id: 1, email: "demo@example.com" });
      return;
    }

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

export { AuthProvider };
