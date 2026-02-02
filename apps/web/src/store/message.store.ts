import { create } from "zustand";
import type { Message, MessageStatus } from "../../../../packages/shared-types/message";
import type { DebugMessage } from "../debug";



interface MessageState {
  messages: DebugMessage[];
  addMessage: (msg: DebugMessage) => void;
  updateStatus: (id: string, status: MessageStatus) => void;

  // 🔥 NEW (for server ACK reconciliation)
  replaceMessage: (id: string, msg: DebugMessage) => void;
}

export const useMessageStore = create<MessageState>((set) => ({
  messages: [],

  // UPSERT message (UNCHANGED)
  addMessage: (newMessage: DebugMessage) => {
    set((state) => {
          console.log("➕ addMessage", newMessage.id, newMessage.__source);

      const exists = state.messages.find(
        (msg) => msg.id === newMessage.id
      );

      if (exists) {
        console.group("🧨 MESSAGE MERGE");
        console.log("OLD:", exists);
        console.log("NEW:", newMessage);
        console.log(
          "TEXT DECISION:",
          newMessage.text !== undefined ? "USE NEW" : "KEEP OLD"
        );
        console.groupEnd();

        return {
          messages: state.messages.map((msg) => {
            if (msg.id !== newMessage.id) return msg;

            return {
              ...msg,
              ...newMessage,

              // 🔑 NEVER overwrite text with undefined
              text:
                newMessage.text !== undefined
                  ? newMessage.text
                  : msg.text,
            };
          }),
        };
      }

      return {
        messages: [...state.messages, newMessage],
      };
    });
  },

  // STATUS UPDATE (UNCHANGED)
  updateStatus: (id, status) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, status } : m
      ),
    })),

  // 🔥 SERVER ACK → HARD REPLACE (NO MERGE, NO DUPLICATE)
  replaceMessage: (clientId, serverMsg) =>
  set((state) => ({
    messages: [
      ...state.messages.filter((m) => m.clientId !== clientId),
      { ...serverMsg, clientId },
    ].sort((a, b) => a.createdAt - b.createdAt),
  })),


}));
