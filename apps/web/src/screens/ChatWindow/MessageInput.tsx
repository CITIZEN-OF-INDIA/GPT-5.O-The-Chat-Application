import { useState, KeyboardEvent, useEffect, useRef, useLayoutEffect } from "react";
import { getSocket } from "../../services/socket.service";
import { useMessageStore } from "../../store/message.store";
import {
  addMessage as addMessageToDB,
  deleteMessage as deleteMessageFromDB,
  patchMessage as patchMessageInDB,
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
import {
  emitTypingStart,
  emitTypingStop,
} from "../../services/socket.service";
import { editMessageOnServer } from "../../services/message.service";
import { isEffectivelyOnline } from "../../utils/network";

interface MessageInputProps {
  chatId: ChatID;
  receiverId: UserID;
  disabled?: boolean;
  replyToMessage?: Message | null;
  onCancelReply?: () => void;
  editTarget?: Message | null;
  onCancelEdit?: () => void;
}

const getDraftStorageKey = (userId: string, chatId: string) =>
  `chat_draft:${userId}:${chatId}`;

const EmojiIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="#333" strokeWidth="1.5" />
    <circle cx="9" cy="10" r="1" fill="#333" />
    <circle cx="15" cy="10" r="1" fill="#333" />
    <path
      d="M8 14c1.5 1.5 6.5 1.5 8 0"
      stroke="#333"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export default function MessageInput({
  chatId,
  receiverId,
  disabled = false,
  replyToMessage = null,
  onCancelReply,
  editTarget = null,
  onCancelEdit,
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
  const { addMessage, replaceMessage, updateStatus, patchMessage } =
    useMessageStore.getState();

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const isEditing = Boolean(editTarget);

  useEffect(() => {
    if (!chatId || !senderId || isEditing) return;
    const savedDraft =
      localStorage.getItem(getDraftStorageKey(senderId, chatId)) ?? "";
    setText(savedDraft);
  }, [chatId, senderId, isEditing]);

  useEffect(() => {
    if (!chatId || !senderId || isEditing) return;
    const key = getDraftStorageKey(senderId, chatId);
    if (text.length) localStorage.setItem(key, text);
    else localStorage.removeItem(key);
  }, [text, chatId, senderId, isEditing]);

  useEffect(() => {
    if (!editTarget) return;
    setText(editTarget.text ?? "");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
      cursorRef.current = end;
    });
  }, [editTarget?.id]);

  const send = async () => {
    if (!text.trim() || !senderId) return;

    if (isEditing && editTarget) {
      const editedText = text.trim();
      const targetId = editTarget.id;

      patchMessage(targetId, {
        text: editedText,
        edited: true,
        updatedAt: Date.now(),
      });
      await patchMessageInDB(targetId, {
        text: editedText,
        edited: true,
        updatedAt: Date.now(),
      });

      try {
        const updated = await editMessageOnServer(targetId, editedText);
        patchMessage(updated.id, updated);
        await patchMessageInDB(updated.id, updated);
      } catch (err) {
        console.error("Failed to edit message", err);
      }

      setText("");
      onCancelEdit?.();
      return;
    }

    const socket = getSocket();
    const messageId = crypto.randomUUID();
    const replyTo = replyToMessage?.id;

    const baseMessage: Message = {
      id: messageId,
      clientId: messageId,
      chatId,
      senderId,
      type: MessageType.TEXT,
      text,
      ...(replyTo ? { replyTo } : {}),
      createdAt: Date.now(),
      status:
        socket && isEffectivelyOnline()
          ? MessageStatus.SENDING
          : MessageStatus.QUEUED,
    };

    addMessage({ ...baseMessage, __source: "optimistic" });
    await addMessageToDB(baseMessage);

    if (socket && isEffectivelyOnline()) {
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
          text,
          clientId: messageId,
          ...(replyTo ? { replyTo } : {}),
        },
        async (ack: { ok: boolean; message?: Message }) => {
          acked = true;
          clearTimeout(ackTimeout);

          if (!ack?.ok || !ack.message) {
            updateStatus(messageId, MessageStatus.QUEUED);
            await updateMessageStatusDB(messageId, MessageStatus.QUEUED);
            return;
          }

          const serverMsg = {
            ...ack.message,
            clientId: messageId,
            status: MessageStatus.SENT,
          };

          await deleteMessageFromDB(messageId);
          await addMessageToDB(serverMsg);
          replaceMessage(messageId, serverMsg);
        }
      );
    }

    if (isTypingRef.current) {
      emitTypingStop(chatId);
      isTypingRef.current = false;
    }

    setText("");
    onCancelReply?.();
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
    cursorRef.current = pos;
    restoreCursorRef.current = null;
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
    const updated = text.slice(0, start) + emoji + text.slice(start);
    restoreCursorRef.current = start + emoji.length;
    setText(updated);
  };

  const triggerTyping = () => {
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
  };

  const composerTitle = isEditing
    ? "Editing message"
    : replyToMessage
    ? "Replying to message"
    : "";

  const composerPreview = isEditing
    ? editTarget?.text
    : replyToMessage?.text ?? "Media message";

  return (
    <div style={{ width: "100%" }}>
      {(isEditing || replyToMessage) && (
        <div
          style={{
            background: "#d9efff",
            borderLeft: "4px solid #0b5cff",
            borderRadius: 8,
            marginBottom: 6,
            padding: "8px 10px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0b5cff" }}>
              {composerTitle}
            </div>
            <div
              style={{
                color: "#1a1a1a",
                fontSize: 14,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {composerPreview}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isEditing) onCancelEdit?.();
              else onCancelReply?.();
            }}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          width: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: "transparent",
            gap: 10,
            paddingBottom: 20,
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setShowEmojiPicker((p) => !p);
            }}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              opacity: 0.85,
            }}
            aria-label="Emoji"
          >
            <EmojiIcon />
          </button>
        </div>

        {showEmojiPicker && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 0,
              zIndex: 10,
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker onSelect={handleEmojiSelect} />
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            const nextText = e.target.value;
            setText(nextText);
            if (chatId && senderId && !isEditing) {
              const key = getDraftStorageKey(senderId, chatId);
              if (nextText.length) localStorage.setItem(key, nextText);
              else localStorage.removeItem(key);
            }
            triggerTyping();
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
          placeholder={disabled ? "Select a chat to enable input" : "Type a message"}
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

        <button
          onClick={send}
          disabled={disabled || !text.trim()}
          style={{
            width: 40,
            height: 40,
            marginBottom: 12,
            borderRadius: "50%",
            border: "none",
            backgroundColor: "#0b5cff",
            color: "#fff",
            cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
          aria-label="Send"
        >
          {isEditing ? "OK" : ">"}
        </button>
      </div>
    </div>
  );
}
