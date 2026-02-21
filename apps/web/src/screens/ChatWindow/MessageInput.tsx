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
  selectionMode?: boolean;
  onExitSelectionMode?: () => void;
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
  selectionMode = false,
  onExitSelectionMode,
  replyToMessage = null,
  onCancelReply,
  editTarget = null,
  onCancelEdit,
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobileEmojiHeight, setMobileEmojiHeight] = useState(320);
  const [mobileEmojiWidth, setMobileEmojiWidth] = useState<number>(
    window.visualViewport?.width ?? window.innerWidth
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
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
    if (!isMobile) return;
    const computeMobileEmojiSize = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = Math.max(
        Math.round(window.visualViewport?.width ?? 0),
        window.innerWidth,
        document.documentElement?.clientWidth ?? 0
      );
      const desired = Math.round(viewportHeight * 0.42);
      const clamped = Math.max(260, Math.min(420, desired));
      setMobileEmojiHeight(clamped);
      setMobileEmojiWidth(viewportWidth);
    };
    computeMobileEmojiSize();
    window.addEventListener("resize", computeMobileEmojiSize);
    window.visualViewport?.addEventListener("resize", computeMobileEmojiSize);
    return () => {
      window.removeEventListener("resize", computeMobileEmojiSize);
      window.visualViewport?.removeEventListener("resize", computeMobileEmojiSize);
    };
  }, [isMobile]);

  const focusComposer = () => {
    if (!isMobile || disabled || showEmojiPicker) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const pos = Math.min(cursorRef.current, el.value.length);
    el.setSelectionRange(pos, pos);
  };

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

  useEffect(() => {
    if (!isMobile || disabled || showEmojiPicker) return;
    requestAnimationFrame(() => {
      focusComposer();
    });
  }, [isMobile, disabled, showEmojiPicker, chatId]);

  const send = async () => {
    if (!text.trim() || !senderId) return;
    if (!isMobile) {
      setShowEmojiPicker(false);
    }

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
    if (isMobile && !disabled && document.activeElement !== textareaRef.current) {
      requestAnimationFrame(() => {
        focusComposer();
      });
    }
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
    if (!(isMobile && showEmojiPicker)) {
      el.focus();
    }
    cursorRef.current = pos;
    restoreCursorRef.current = null;
  }, [text, isMobile, showEmojiPicker]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const maxLines = isMobile ? 6 : 12;
    const maxHeightPx = maxLines * 22;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, maxHeightPx) + "px";
  }, [text, isMobile]);

  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        emitTypingStop(chatId);
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    if (isMobile) return;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (emojiButtonRef.current?.contains(target) || path.includes(emojiButtonRef.current)) return;
      if (emojiPanelRef.current?.contains(target) || path.includes(emojiPanelRef.current)) return;
      setShowEmojiPicker(false);
    };
    window.addEventListener("mousedown", closeOnOutside, true);
    window.addEventListener("touchstart", closeOnOutside, true);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside, true);
      window.removeEventListener("touchstart", closeOnOutside, true);
    };
  }, [showEmojiPicker]);

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

  const toggleEmojiPicker = () => {
    if (selectionMode) {
      onExitSelectionMode?.();
      return;
    }
    if (!isMobile) {
      setShowEmojiPicker((p) => !p);
      return;
    }
    setShowEmojiPicker((prev) => {
      const next = !prev;
      if (next) {
        textareaRef.current?.blur();
      } else {
        window.setTimeout(() => {
          focusComposer();
        }, 0);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        width: "100%",
        marginBottom: isMobile && showEmojiPicker ? mobileEmojiHeight + 8 : 0,
      }}
    >
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
        {showEmojiPicker && (
          <div
            ref={emojiPanelRef}
            style={{
              position: isMobile ? "fixed" : "absolute",
              bottom: isMobile ? 0 : "calc(100% + 8px)",
              left: isMobile ? 0 : 0,
              right: isMobile ? 0 : "auto",
              width: isMobile ? "100dvw" : "auto",
              minWidth: isMobile ? "100dvw" : "auto",
              maxWidth: isMobile ? "100dvw" : "none",
              zIndex: isMobile ? 30 : 10,
              background: isMobile ? "#fff" : "transparent",
              borderTop: isMobile ? "1px solid #dadada" : "none",
              borderRadius: isMobile ? "12px 12px 0 0" : 0,
              boxShadow: isMobile ? "0 -2px 10px rgba(0,0,0,0.1)" : "none",
              height: isMobile ? mobileEmojiHeight : "auto",
              maxHeight: isMobile ? mobileEmojiHeight : "none",
              overflowY: isMobile ? "auto" : "visible",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker
              onSelect={handleEmojiSelect}
              isMobile={isMobile}
              mobileHeight={mobileEmojiHeight}
              mobileWidth={mobileEmojiWidth}
            />
          </div>
        )}

        {isMobile ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 40,
              border: "none",
              outline: "none",
              backgroundColor: "#cfe9ff",
              opacity: disabled ? 0.6 : 1,
            }}
            onMouseDown={(e) => {
              if (!selectionMode) return;
              e.preventDefault();
              onExitSelectionMode?.();
            }}
            onTouchStart={(e) => {
              if (!selectionMode) return;
              e.preventDefault();
              onExitSelectionMode?.();
            }}
          >
            <button
              ref={emojiButtonRef}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                toggleEmojiPicker();
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                opacity: 0.85,
                padding: 0,
                marginBottom: 4,
                flexShrink: 0,
              }}
              aria-label="Emoji"
            >
              <EmojiIcon />
            </button>
            
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
              onFocus={() => {
                if (isMobile && showEmojiPicker) setShowEmojiPicker(false);
              }}
              onKeyUp={(e) => {
                cursorRef.current = (e.target as HTMLTextAreaElement).selectionStart;
              }}
              placeholder={
                selectionMode
                  ? "Tap here to exit selection mode"
                  : disabled
                  ? "Select a chat to enable input"
                  : "Type a message"
              }
              disabled={disabled}
              rows={1}
              style={{
                flex: 1,
                padding: "2px 2px 2px 0",
                borderRadius: 0,
                border: "none",
                outline: "none",
                backgroundColor: "transparent",
                color: "#000",
                fontSize: 16,
                resize: "none",
                maxHeight: "calc(6 * 1.4em + 20px)",
                overflowY: "auto",
                lineHeight: "1.4",
                opacity: disabled ? 0.6 : 1,
                cursor: selectionMode ? "pointer" : disabled ? "not-allowed" : "text",
              }}
            />
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                backgroundColor: "transparent",
                gap: 10,
                paddingBottom: 20,
              }}
            >
              <button
                ref={emojiButtonRef}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEmojiPicker();
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
              onFocus={() => {
                if (isMobile && showEmojiPicker) setShowEmojiPicker(false);
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
          </>
        )}

        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={send}
          disabled={disabled || !text.trim()}
          style={{
            width: isMobile ? 48 : 40,
            height: isMobile ? 48 : 40,
            marginBottom: isMobile ? 0 : 12,
            borderRadius: "50%",
            border: "none",
            backgroundColor: "#0b5cff",
            color: "#fff",
            cursor: disabled || !text.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isMobile ? 20 : 18,
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
            flexShrink: 0,
          }}
          aria-label="Send"
        >
          {isEditing ? "OK" : ">"}
        </button>
      </div>
    </div>
  );
}
