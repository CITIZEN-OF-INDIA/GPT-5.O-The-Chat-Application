import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { getSocket } from "../../services/socket.service";
import { useMessageStore } from "../../store/message.store";
import {
  addMessage as addMessageToDB,
  deleteMessage as deleteMessageFromDB,
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
import EmojiPicker from "../../components/Emoji/EmojiPicker";
import { useLayoutEffect } from "react";
import {
  emitTypingStart,
  emitTypingStop,
} from "../../services/socket.service";



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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number>(0);
  const restoreCursorRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const token = useAuthStore.getState().token;
  const senderId = token ? getUserIdFromToken(token) : null;
  // Emoji icon whatsapp style
const EmojiIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#555" strokeWidth="1.5"/>
    <circle cx="9" cy="10" r="1" fill="#555"/>
    <circle cx="15" cy="10" r="1" fill="#555"/>
    <path
      d="M8 14c1.5 1.5 6.5 1.5 8 0"
      stroke="#555"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
// File attach icon for future use
const AttachIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
    <path
      d="M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1"
      stroke="#555"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M14 11a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1"
      stroke="#555"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

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
      status: socket && navigator.onLine ? MessageStatus.SENDING : MessageStatus.QUEUED,
    };

    // 1️⃣ Optimistic UI
    addMessage({ ...baseMessage, __source: "optimistic" });

    // 2️⃣ Persist locally
    await addMessageToDB(baseMessage);

    // 3️⃣ ONLINE → SEND
    if (socket && navigator.onLine) {
      console.log("🚀 SENDING MESSAGE", {
  text,
  clientId: messageId,
});


      let acked = false;
      const ackTimeout = setTimeout(async () => {
        if (acked) return;
        updateStatus(messageId, MessageStatus.QUEUED);
        await updateMessageStatusDB(messageId, MessageStatus.QUEUED);
      }, 1000);

      socket.emit(
        "message:send",
        {
          chatId,
          receiverId,
          text: text,
          clientId: messageId,
        },
        async (ack: { ok: boolean; message?: Message }) => {
          acked = true;
          clearTimeout(ackTimeout);

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

          // remove optimistic record keyed by clientId
          await deleteMessageFromDB(messageId);

          // replace in IndexedDB
          await addMessageToDB(reconciled);

          // replace in Zustand (NO ADD)
          replaceMessage(messageId, reconciled);
        }
      );
    }

      if (isTypingRef.current) {
  emitTypingStop(chatId);
  isTypingRef.current = false;
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

  useLayoutEffect(() => {
  if (restoreCursorRef.current === null) return;

  const el = textareaRef.current;
  if (!el) return;

  const pos = restoreCursorRef.current;
  el.setSelectionRange(pos, pos);
  el.focus();

  cursorRef.current = pos;          // keep in sync
  restoreCursorRef.current = null;  // reset
}, [text]);



  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 12 * 22) + "px";
  }, [text]);




  useEffect(() => {
  return () => {
    if (isTypingRef.current) {
      emitTypingStop(chatId);
    }
  };
}, [chatId]);



useEffect(() => {
  const close = () => setShowEmojiPicker(false);
  window.addEventListener("click", close);
  return () => window.removeEventListener("click", close);
}, []);
const handleEmojiSelect = (emoji: string) => {
  const start = cursorRef.current;

  const updated =
    text.slice(0, start) + emoji + text.slice(start);

  restoreCursorRef.current = start + emoji.length; // 🔥 save target cursor
  setText(updated);
};




  return (
  <div
    style={{
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      width: "100%",
      position: "relative",
    }}
  >
    {/* LEFT ACTIONS (Emoji + Attach) */}
    <div
      style={{
        display: "flex",
        backgroundColor: "transparent",
        gap: 10,
        paddingBottom: 20, // aligns with textarea bottom
      }}
    >
      {/* Emoji Button */}
      <button
        type="button"
          onMouseDown={(e) => e.preventDefault()} // 🔥 VERY IMPORTANT
        onClick={(e) => {
          e.stopPropagation();
          setShowEmojiPicker((p) => !p);
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 20,
          opacity: 50,
        }}
        aria-label="Emoji"
      >
        <EmojiIcon />
      </button>

      {/* Attach Button*/}
      <button
        type="button"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          opacity: 1,
        }}
        aria-label="Attach"
      >
        <AttachIcon />
      </button>
    </div>

    {/* EMOJI PICKER */}
    {showEmojiPicker && (
      <div
        style={{
          position: "absolute",
          bottom: 10, // appears above input
          left: 0,
          zIndex: 10,
        }}
          onMouseDown={(e) => e.preventDefault()} // 🔥 critical
        onClick={(e) => e.stopPropagation()}
      >
        <EmojiPicker onSelect={handleEmojiSelect} />
      </div>
    )}

    {/* TEXT INPUT */}
    <textarea
      ref={textareaRef}
      value={text}
    onChange={(e) => {
      setText(e.target.value);

      if (!isTypingRef.current) {
        emitTypingStart(chatId);
        isTypingRef.current = true;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop(chatId);
        isTypingRef.current = false;
      }, 300);
    }}
      onKeyDown={onKeyDown}
      onSelect={(e) => {
    cursorRef.current = (e.target as HTMLTextAreaElement).selectionStart;
  }}
  onClick={(e) => {
    cursorRef.current = (e.target as HTMLTextAreaElement).selectionStart;
  }}
  onKeyUp={(e) => {
    cursorRef.current = (e.target as HTMLTextAreaElement).selectionStart;
  }}
      placeholder={
        disabled ? "Select a chat to enable input" : "Type a message"
      }
      disabled={disabled}
      rows={1}
      style={{
        flex: 1,
        padding: "10px 14px",
        borderRadius: 40,
        border: "none",
        outline: "none",
        backgroundColor: "#cfe9ff",
        color: "#000",
        fontSize: 18,
        resize: "none",
        maxHeight: "calc(12 * 1.4em + 20px)",
        overflowY: "auto",
        lineHeight: "1.4",
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "text",
      }}
    />

    {/* SEND BUTTON */}
    <button
      onClick={send}
      disabled={disabled || !text.trim()}
      style={{
        width: 40,
        height: 40,
        marginBottom: 12, // aligns with textarea bottom
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
      aria-label="Send"
    >
      ➤
    </button>
  </div>
);
}
