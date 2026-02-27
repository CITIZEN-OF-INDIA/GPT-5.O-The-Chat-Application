import { create } from "zustand";
import { disconnectSocket } from "../services/socket.service";
import { usePresenceStore } from "./presence.store";
import { resolveApiUrl } from "../utils/network";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  setToken: (token: string) => void;
  logout: () => void;
  setError: (error: string | null) => void;
}

const decodeJwtPayload = (token: string) => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string) => {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return true;
  return exp * 1000 <= Date.now();
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setError: (error) => set({ error }),

  restoreSession: async () => {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!token && !refreshToken) {
      set({ token: null, refreshToken: null, isAuthenticated: false });
      return;
    }

    if (token && !isTokenExpired(token)) {
      set({ token, refreshToken, isAuthenticated: true, error: null });
      return;
    }

    const ok = await useAuthStore.getState().refreshSession();
    if (!ok) {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      set({ token: null, refreshToken: null, isAuthenticated: false });
    }
  },

  refreshSession: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;

    try {
      const res = await fetch(resolveApiUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        return false;
      }

      const tokens = await res.json();
      const nextAccessToken = tokens?.accessToken;
      const nextRefreshToken = tokens?.refreshToken;

      if (!nextAccessToken || !nextRefreshToken) {
        return false;
      }

      localStorage.setItem("token", nextAccessToken);
      localStorage.setItem("refreshToken", nextRefreshToken);

      set({
        token: nextAccessToken,
        refreshToken: nextRefreshToken,
        isAuthenticated: true,
        error: null,
      });

      return true;
    } catch {
      return false;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(resolveApiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        set({
          isLoading: false,
          error: res.status === 401 ? "Invalid credentials" : "Server error. Try again",
        });
        return;
      }

      const { accessToken, refreshToken } = await res.json();
      if (!accessToken || !refreshToken) {
        set({ isLoading: false, error: "Server error. Try again" });
        return;
      }
      localStorage.setItem("token", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      set({
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      set({
        isLoading: false,
        error: "No internet connection",
      });
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(resolveApiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let message = "Registration failed";

        if (res.status === 409) message = "Username already exists";
        else if (res.status === 400) message = "Invalid username or password";

        set({ isLoading: false, error: message });
        return;
      }

      const { accessToken, refreshToken } = await res.json();
      if (!accessToken || !refreshToken) {
        set({ isLoading: false, error: "Registration failed" });
        return;
      }
      localStorage.setItem("token", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      set({
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch {
      set({
        isLoading: false,
        error: "No internet connection",
      });
    }
  },

  setToken: (token) => {
    localStorage.setItem("token", token);
    set({ token, isAuthenticated: true });
  },

  logout: () => {
    disconnectSocket();
    usePresenceStore.getState().reset();
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    set({
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));
