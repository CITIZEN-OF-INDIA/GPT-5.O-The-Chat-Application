import { useEffect } from "react";
import { connectSocket } from "../services/socket.service";
import { useMessageStore } from "../store/message.store";
import { getUserIdFromToken } from "../utils/jwt";
import { MessageStatus } from "../../../../packages/shared-types/message";
import {
  deleteMessage as deleteMessageFromDB,
  patchMessage as patchMessageInDB,
  upsertMessages,
  updateMessageStatus as updateMessageStatusDB,
} from "../db/message.repo";
import { normalizeMessage } from "../utils/normalizeMessage";
import { runSyncCycle } from "../services/sync.service";


export const useSocket = (token: string | null) => {
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    const myUserId = getUserIdFromToken(token);
    const handleConnect = () => {
      void runSyncCycle();
    };
    const ensureConnected = () => {
      if (!socket.connected) {
        socket.connect();
      }
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        ensureConnected();
      }
    };

    socket.on("connect", handleConnect);
    if (socket.connected) {
      void runSyncCycle();
    }
    window.addEventListener("focus", ensureConnected);
    window.addEventListener("online", ensureConnected);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    socket.on("message:new", async (raw) => {
      try {
        const msg = normalizeMessage(raw);
        const store = useMessageStore.getState();

        if (msg.senderId === myUserId && msg.clientId) {
          store.replaceMessage(msg.clientId, msg);
          if (msg.clientId !== msg.id) {
            await deleteMessageFromDB(msg.clientId);
          }
          await upsertMessages([msg]);
          return;
        }

        if (
          !store.messages.some(
            (m) => m.id === msg.id || (msg.clientId && m.id === msg.clientId)
          )
        ) {
          store.addMessage(msg);
        }

        await upsertMessages([msg]);
      } catch (err) {
        console.error("message:new handling failed", err);
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
      async (payload: { chatId: string; messageIds: string[] }) => {
        const messageIds = Array.isArray(payload?.messageIds)
          ? payload.messageIds.map(String)
          : [];
        if (!messageIds.length) return;

        const store = useMessageStore.getState();
        messageIds.forEach((messageId) => {
          store.patchMessage(messageId, {
            deleted: true,
            text: "",
            edited: false,
            pinned: false,
            updatedAt: Date.now(),
          });
        });
        await Promise.all(
          messageIds.map((messageId) =>
            patchMessageInDB(messageId, {
              deleted: true,
              text: "",
              edited: false,
              pinned: false,
              updatedAt: Date.now(),
            })
          )
        );
      }
    );

    return () => {
      socket.off("message:new");
      socket.off("message:sent");
      socket.off("message:status");
      socket.off("message:updated");
      socket.off("message:deleted");
      socket.off("connect", handleConnect);
      window.removeEventListener("focus", ensureConnected);
      window.removeEventListener("online", ensureConnected);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);
};


