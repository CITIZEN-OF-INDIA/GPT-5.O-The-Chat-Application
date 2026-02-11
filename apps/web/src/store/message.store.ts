import { create } from "zustand";
import type { MessageStatus } from "../../../../packages/shared-types/message";
import type { DebugMessage } from "../debug";

interface MessageState {
  messages: DebugMessage[];
  addMessage: (msg: DebugMessage) => void;
  updateStatus: (id: string, status: MessageStatus) => void;
  patchMessage: (id: string, patch: Partial<DebugMessage>) => void;
  removeMessages: (ids: string[]) => void;
  removeChatMessages: (chatId: string) => void;
  replaceMessage: (id: string, msg: DebugMessage) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],

  addMessage: (newMessage: DebugMessage) => {
    set((state) => {
      const exists = state.messages.find((msg) => msg.id === newMessage.id);

      if (exists) {
        return {
          messages: state.messages.map((msg) => {
            if (msg.id !== newMessage.id) return msg;
            return {
              ...msg,
              ...newMessage,
              text:
                newMessage.text !== undefined ? newMessage.text : msg.text,
            };
          }),
        };
      }

      return {
        messages: [...state.messages, newMessage],
      };
    });
  },

  updateStatus: (id, status) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id || m.clientId === id ? { ...m, status } : m
      ),
    })),

  patchMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id || m.clientId === id ? { ...m, ...patch } : m
      ),
    })),

  removeMessages: (ids) =>
    set((state) => {
      const keySet = new Set(ids);
      return {
        messages: state.messages.filter(
          (m) => !keySet.has(m.id) && !(m.clientId && keySet.has(m.clientId))
        ),
      };
    }),

  removeChatMessages: (chatId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.chatId !== chatId),
    })),

  replaceMessage: (clientId, serverMsg) =>
    set((state) => ({
      messages: [
        ...state.messages.filter((m) => m.clientId !== clientId),
        { ...serverMsg, clientId },
      ].sort((a, b) => a.createdAt - b.createdAt),
    })),
}));
