import { create } from "zustand";
import { disconnectSocket } from "../services/socket.service";
import { usePresenceStore } from "./presence.store";
import { resolveApiUrl } from "../utils/network";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  restoreSession: () => void;
  setToken: (token: string) => void;
  logout: () => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setError: (error) => set({ error }),

  restoreSession: () => {
    const token = localStorage.getItem("token");
    if (token) {
      set({ token, isAuthenticated: true });
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

      const { accessToken } = await res.json();
      localStorage.setItem("token", accessToken);

      set({
        token: accessToken,
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

      const { accessToken } = await res.json();
      localStorage.setItem("token", accessToken);

      set({
        token: accessToken,
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
    set({
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));
