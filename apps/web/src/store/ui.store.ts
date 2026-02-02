import { create } from "zustand";

interface UIState {
  loading: boolean;
  error: string | null;

  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  loading: false,
  error: null,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

