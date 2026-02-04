// apps/web/src/hooks/useSocket.ts
import { useEffect } from "react";
import { connectSocket } from "../services/socket.service";
import { useMessageStore } from "../store/message.store";
import { getUserIdFromToken } from "../utils/jwt";
import { MessageStatus } from "../../../../packages/shared-types/message";
import { updateMessageStatus as updateMessageStatusDB } from "../db/message.repo";
import { normalizeMessage } from "../utils/normalizeMessage";

export const useSocket = (token: string | null) => {
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    const messageStore = useMessageStore.getState();
    const myUserId = getUserIdFromToken(token);

    // 📩 NEW MESSAGE FROM SERVER
    socket.on("message:new", (raw) => {
  const msg = normalizeMessage(raw);

  // DEBUG
  console.log("📩 message:new", msg.id, msg.clientId);

  // 1️⃣ Replace optimistic if it's our own message
  if (msg.senderId === myUserId && msg.clientId) {
    messageStore.replaceMessage(msg.clientId, msg);
    return; // IMPORTANT
  }

  // 2️⃣ Add only if message with same DB id or clientId doesn't exist
  if (!messageStore.messages.some(
        (m) => m.id === msg.id || (msg.clientId && m.id === msg.clientId)
      )) {
    messageStore.addMessage(msg);
  }
});



    // 📤 SENT ACK
    socket.on("message:sent", (raw) => {
      console.log("📤 message:sent", raw);

      const msg = normalizeMessage(raw);

      // ACK is just a safety net now
      const idToUpdate = msg.clientId ?? msg.id;
      messageStore.updateStatus(idToUpdate, MessageStatus.SENT);

    });

    // 📬 STATUS UPDATE
    socket.on("message:status", ({ messageId, status }) => {
      console.log("📬 message:status", messageId, status);
      messageStore.updateStatus(messageId, status);
      updateMessageStatusDB(messageId, status as MessageStatus);
    });

    return () => {
      socket.off("message:new");
      socket.off("message:sent");
      socket.off("message:status");
    };
  }, [token]);
};
