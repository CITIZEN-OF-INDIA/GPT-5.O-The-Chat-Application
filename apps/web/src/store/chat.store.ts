import { create } from "zustand";
import type { ChatDB } from "../db/indexedDB";
import { getAllChats, upsertChats as persistChats } from "../db/chat.repo";
import { fetchChats } from "../services/chat.service";
import { normalizeChat } from "../utils/normalizeChat";
import { useAuthStore } from "../store/auth.store";
import { getUserIdFromToken } from "../utils/jwt"; // ✅ IMPORT JWT HELPER

interface ChatState {
  chats: ChatDB[];
  activeChat: ChatDB | null;
  isLoading: boolean;

  hydrateFromCache: () => Promise<void>;
  hydrate: () => Promise<void>;
  syncFromServer: () => Promise<void>;

  setActiveChat: (chat: ChatDB | null) => void;
  upsertChats: (chats: ChatDB[]) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  isLoading: false,

  /**
   * Load from IndexedDB (offline-safe)
   */
  hydrateFromCache: async () => {
    set({ isLoading: true });

    const token = useAuthStore.getState().token;
    const userId = token ? getUserIdFromToken(token) : null;

    if (!userId) {
      set({ chats: [], isLoading: false });
      return;
    }

    const chats = (await getAllChats())
      .map(normalizeChat)
      .filter((chat) =>
        chat.participants.some((p) => p.id === userId)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    set({ chats, isLoading: false });
  },

  /**
   * Sync from server when online
   */
  syncFromServer: async () => {
    try {
      set({ isLoading: true });

      const serverChats = (await fetchChats())
        .map(normalizeChat)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      // 🔑 REPLACE — user-scoped data must not merge
      set({ chats: serverChats, isLoading: false });

      await persistChats(serverChats);
    } catch (err) {
      console.error("Chat sync failed", err);
      set({ isLoading: false });
    }
  },

  /**
   * Smart hydration
   */
  hydrate: async () => {
    await get().hydrateFromCache();
    if (navigator.onLine) {
      await get().syncFromServer();
    }
  },

  setActiveChat: (chat) => set({ activeChat: chat }),

  /**
   * Merge chats (realtime updates only)
   */
  upsertChats: (incoming) =>
    set((state) => {
      const map = new Map(state.chats.map((c) => [c.id, c]));

      for (const chat of incoming.map(normalizeChat)) {
        map.set(chat.id, {
          ...map.get(chat.id),
          ...chat,
        });
      }

      return {
        chats: Array.from(map.values()).sort(
          (a, b) => b.updatedAt - a.updatedAt
        ),
      };
    }),

  clear: () => set({ chats: [], activeChat: null }),
}));
