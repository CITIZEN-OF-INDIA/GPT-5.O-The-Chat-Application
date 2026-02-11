import { useEffect } from "react";
import { connectSocket } from "../services/socket.service";
import { useMessageStore } from "../store/message.store";
import { getUserIdFromToken } from "../utils/jwt";
import { MessageStatus } from "../../../../packages/shared-types/message";
import {
  patchMessage as patchMessageInDB,
  updateMessageStatus as updateMessageStatusDB,
} from "../db/message.repo";
import { normalizeMessage } from "../utils/normalizeMessage";

const DELETED_MESSAGE_TEXT = "This message was deleted";

export const useSocket = (token: string | null) => {
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    const myUserId = getUserIdFromToken(token);

    socket.on("message:new", (raw) => {
      const msg = normalizeMessage(raw);
      const store = useMessageStore.getState();

      if (msg.senderId === myUserId && msg.clientId) {
        store.replaceMessage(msg.clientId, msg);
        return;
      }

      if (
        !store.messages.some(
          (m) => m.id === msg.id || (msg.clientId && m.id === msg.clientId)
        )
      ) {
        store.addMessage(msg);
      }
    });

    socket.on("message:sent", (raw) => {
      const msg = normalizeMessage(raw);
      const idToUpdate = msg.clientId ?? msg.id;
      useMessageStore.getState().updateStatus(idToUpdate, MessageStatus.SENT);
    });

    socket.on("message:status", ({ messageId, status }) => {
      useMessageStore.getState().updateStatus(messageId, status);
      updateMessageStatusDB(messageId, status as MessageStatus);
    });

    socket.on("message:updated", (raw) => {
      const msg = normalizeMessage(raw);
      useMessageStore.getState().addMessage(msg);
      patchMessageInDB(msg.id, msg);
    });

    socket.on(
      "message:deleted",
      (payload: { chatId: string; messageIds: string[] }) => {
        const messageIds = Array.isArray(payload?.messageIds)
          ? payload.messageIds.map(String)
          : [];
        if (!messageIds.length) return;

        const store = useMessageStore.getState();
        for (const id of messageIds) {
          store.patchMessage(id, {
            deleted: true,
            text: DELETED_MESSAGE_TEXT,
            edited: false,
          });
          patchMessageInDB(id, {
            deleted: true,
            text: DELETED_MESSAGE_TEXT,
            edited: false,
          });
        }
      }
    );

    return () => {
      socket.off("message:new");
      socket.off("message:sent");
      socket.off("message:status");
      socket.off("message:updated");
      socket.off("message:deleted");
    };
  }, [token]);
};
