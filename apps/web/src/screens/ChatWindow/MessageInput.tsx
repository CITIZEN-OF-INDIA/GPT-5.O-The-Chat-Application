import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { getSocket } from "../../services/socket.service";
import { useMessageStore } from "../../store/message.store";
import {
  addMessage as addMessageToDB,
  updateMessageStatus as updateMessageStatusDB,
} from "../../db/message.repo";
import { getUserIdFromToken } from "../../utils/jwt";
import { useAuthStore } from "../../store/auth.store";
import {
  MessageType,
  MessageStatus,
  type Message,
} from "../../../../../packages/shared-types/message";
import type { ChatID } from "../../../../../packages/shared-types/chat";
import type { UserID } from "../../../../../packages/shared-types/user";


interface MessageInputProps {
  chatId: ChatID;
  receiverId: UserID;
  disabled?: boolean;
}

export default function MessageInput({
  chatId,
  receiverId,
  disabled = false,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const token = useAuthStore.getState().token;
  const senderId = token ? getUserIdFromToken(token) : null;

  const { addMessage, replaceMessage, updateStatus } =
    useMessageStore.getState();

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  const send = async () => {
    if (!text.trim() || !senderId) return;

    const socket = getSocket();
    const messageId = crypto.randomUUID();

    const baseMessage: Message = {
      id: messageId,          // client primary key
      clientId: messageId,    // 🔑 reconciliation key
      chatId,
      senderId,
      type: MessageType.TEXT,
      text,
      createdAt: Date.now(),
      status: socket ? MessageStatus.SENDING : MessageStatus.QUEUED,
    };

    // 1️⃣ Optimistic UI
    addMessage({ ...baseMessage, __source: "optimistic" });

    // 2️⃣ Persist locally
    await addMessageToDB(baseMessage);

    // 3️⃣ ONLINE → SEND
    if (socket) {
      console.log("🚀 SENDING MESSAGE", {
  text,
  clientId: messageId,
});

      socket.emit(
        "message:send",
        {
          chatId,
          receiverId,
          text: text,
          clientId: messageId,
        },
        async (ack: { ok: boolean; message?: Message }) => {
          if (!ack?.ok || !ack.message) {
            updateStatus(messageId, MessageStatus.QUEUED);
            await updateMessageStatusDB(
              messageId,
              MessageStatus.QUEUED
            );
            return;
          }

              const serverMsg = ack.message;

          // 🔥 RECONCILE SERVER MESSAGE WITH LOCAL ONE
          const reconciled: Message = {
      ...serverMsg,
      clientId: messageId,            // keep clientId for reconciliation
      status: MessageStatus.SENT,
    };

          // replace in IndexedDB
          await addMessageToDB(reconciled);

          // replace in Zustand (NO ADD)
          replaceMessage(messageId, reconciled);
        }
      );
    }

    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (isMobile || e.shiftKey) return;
      e.preventDefault();
      send();
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 12 * 22) + "px";
  }, [text]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          disabled ? "Select a chat to enable input" : "Type a message"
        }
        disabled={disabled}
        rows={1}
        style={{
          width: "96%",
          padding: "10px 52px 10px 14px",
          borderRadius: 40,
          border: "none",
          outline: "none",
          backgroundColor: "#cfe9ff",
          color: "#000000",
          fontSize: 18,
          resize: "none",
          maxHeight: "calc(12 * 1.4em + 20px)",
          overflowY: "auto",
          lineHeight: "1.4",
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />

      <button
        onClick={send}
        disabled={disabled || !text.trim()}
        style={{
          position: "absolute",
          right: 8,
          bottom: 15,
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "none",
          backgroundColor: "#0b5cff",
          color: "#fff",
          cursor:
            disabled || !text.trim() ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }}
      >
        ➤
      </button>
    </div>
  );
}
