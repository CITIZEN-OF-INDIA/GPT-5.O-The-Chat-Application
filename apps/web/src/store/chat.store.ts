import { create } from "zustand";
import type { ChatDB } from "../db/indexedDB";
import {
  deleteChatById,
  getAllChats,
  getDeletedChatIdsForUser,
  markChatDeletedForUser,
  upsertChats as persistChats,
} from "../db/chat.repo";
import { clearChatMessages } from "../db/message.repo";
import { fetchChats } from "../services/chat.service";
import { normalizeChat } from "../utils/normalizeChat";
import { useAuthStore } from "../store/auth.store";
import { getUserIdFromToken } from "../utils/jwt";

interface ChatState {
  chats: ChatDB[];
  activeChat: ChatDB | null;
  pendingDeleteChat: ChatDB | null;
  deletedChatIds: string[];
  isLoading: boolean;

  hydrateFromCache: () => Promise<void>;
  hydrate: () => Promise<void>;
  syncFromServer: () => Promise<void>;

  setActiveChat: (chat: ChatDB | null) => void;
  requestDeleteChat: (chat: ChatDB) => void;
  cancelDeleteChatRequest: () => void;
  deleteChatForMe: (chatId: string) => Promise<void>;
  upsertChats: (chats: ChatDB[]) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  pendingDeleteChat: null,
  deletedChatIds: [],
  isLoading: false,

  hydrateFromCache: async () => {
    set({ isLoading: true, activeChat: null, pendingDeleteChat: null });

    const token = useAuthStore.getState().token;
    const userId = token ? getUserIdFromToken(token) : null;

    if (!userId) {
      set({
        chats: [],
        activeChat: null,
        pendingDeleteChat: null,
        deletedChatIds: [],
        isLoading: false,
      });
      return;
    }

    const deletedIds = await getDeletedChatIdsForUser(userId);
    const deletedChatIds = new Set(deletedIds);
    const chats = (await getAllChats())
      .map(normalizeChat)
      .filter(
        (chat) =>
          chat.participants.some((p) => p.id === userId) && !deletedChatIds.has(chat.id)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    set({
      chats,
      activeChat: null,
      pendingDeleteChat: null,
      deletedChatIds: deletedIds,
      isLoading: false,
    });
  },

  syncFromServer: async () => {
    try {
      set({ isLoading: true });

      const token = useAuthStore.getState().token;
      const userId = token ? getUserIdFromToken(token) : null;
      const deletedIds = userId ? await getDeletedChatIdsForUser(userId) : [];
      const deletedChatIds = new Set(deletedIds);

      const serverChats = (await fetchChats())
        .map(normalizeChat)
        .filter((chat) => !deletedChatIds.has(chat.id))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      set({ chats: serverChats, deletedChatIds: deletedIds, isLoading: false });
      await persistChats(serverChats);
    } catch (err) {
      console.error("Chat sync failed", err);
      set({ isLoading: false });
    }
  },

  hydrate: async () => {
    await get().hydrateFromCache();
    if (navigator.onLine) {
      await get().syncFromServer();
    }
  },

  setActiveChat: (chat) => {
    if (!chat) {
      set({ activeChat: null });
      return;
    }

    const exists = get().chats.some((c) => c.id === chat.id);
    set({ activeChat: exists ? chat : null });
  },

  requestDeleteChat: (chat) => set({ pendingDeleteChat: chat }),

  cancelDeleteChatRequest: () => set({ pendingDeleteChat: null }),

  deleteChatForMe: async (chatId) => {
    const token = useAuthStore.getState().token;
    const userId = token ? getUserIdFromToken(token) : null;
    if (!userId) return;

    await markChatDeletedForUser(userId, chatId);
    await deleteChatById(chatId);
    await clearChatMessages(chatId);

    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      activeChat: state.activeChat?.id === chatId ? null : state.activeChat,
      pendingDeleteChat:
        state.pendingDeleteChat?.id === chatId ? null : state.pendingDeleteChat,
      deletedChatIds: state.deletedChatIds.includes(chatId)
        ? state.deletedChatIds
        : [...state.deletedChatIds, chatId],
    }));
  },

  upsertChats: (incoming) =>
    set((state) => {
      const deletedSet = new Set(state.deletedChatIds);
      const map = new Map(state.chats.map((c) => [c.id, c]));

      for (const chat of incoming.map(normalizeChat)) {
        if (deletedSet.has(chat.id)) continue;
        map.set(chat.id, {
          ...map.get(chat.id),
          ...chat,
        });
      }

      return {
        chats: Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt),
      };
    }),

  clear: () =>
    set({ chats: [], activeChat: null, pendingDeleteChat: null, deletedChatIds: [] }),
}));
