import type { Message } from "../../../../../packages/shared-types/message";
import MessageStatus from "./MessageStatus";
import { useAuthStore } from "../../store/auth.store";
import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

interface MessageBubbleProps {
  message: Message;
  myUserId?: string | null;
  selectionMode?: boolean;
  isSelected?: boolean;
  isFocused?: boolean;
  replyToMessage?: Message | null;
  onReplyPreviewClick?: (messageId: string) => void;
  onEnterSelectionMode?: (m: Message) => void;
  onToggleSelection?: (m: Message) => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLDivElement>, message: Message) => void;
  onSelectionDragStart?: (event: ReactMouseEvent<HTMLDivElement>, message: Message) => void;
  onSelectionDragEnter?: (event: ReactMouseEvent<HTMLDivElement>, message: Message) => void;
  shouldSuppressSelectionClick?: () => boolean;
}

function formatIST(timestamp: number) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp));
}

export default function MessageBubble({
  message,
  myUserId,
  selectionMode = false,
  isSelected = false,
  isFocused = false,
  replyToMessage = null,
  onReplyPreviewClick,
  onEnterSelectionMode,
  onToggleSelection,
  onContextMenu,
  onSelectionDragStart,
  onSelectionDragEnter,
  shouldSuppressSelectionClick,
}: MessageBubbleProps) {
  const token = useAuthStore((s) => s.token);
  const timeIST = message.createdAt ? formatIST(message.createdAt) : "";

  const [activatedLinks, setActivatedLinks] = useState<Set<number>>(new Set());

  let currentUserId = myUserId ?? null;
  if (!currentUserId && token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      currentUserId = payload.sub || null;
    } catch {
      currentUserId = null;
    }
  }

  const isOwn = message.senderId === currentUserId;
  const isDeleted = Boolean(message.deleted);
  const hasReply = Boolean(message.replyTo);
  const canOpenReplyPreview = Boolean(message.replyTo && replyToMessage);
  const longPressTimer = useRef<number | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = () => {
    if (!onEnterSelectionMode && !onToggleSelection) return;
    longPressTimer.current = window.setTimeout(() => {
      if (selectionMode) onToggleSelection?.(message);
      else onEnterSelectionMode?.(message);
    }, 450);
  };

  const handleClick = () => {
    if (!selectionMode) return;
    if (shouldSuppressSelectionClick?.()) return;
    onToggleSelection?.(message);
  };

  function renderTextWithLinks(text: string) {
    const regex =
      /(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s-]{7,}\d)/gi;

    return text.split(regex).map((part, index) => {
      if (!part) return null;

      const isActive = activatedLinks.has(index);
      const color = isActive ? "#ff9f1a" : "#0645AD";

      const activate = (e: ReactMouseEvent) => {
        e.stopPropagation();
        setActivatedLinks((prev) => new Set(prev).add(index));
      };

      if (/^https?:\/\//i.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={activate}
            onContextMenu={activate}
            style={{ textDecoration: "underline", color }}
          >
            {part}
          </a>
        );
      }

      if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
        return (
          <a
            key={index}
            href={`mailto:${part}`}
            onClick={activate}
            onContextMenu={activate}
            style={{ textDecoration: "underline", color }}
          >
            {part}
          </a>
        );
      }

      if (/^\+?\d[\d\s-]{7,}\d$/.test(part)) {
        const clean = part.replace(/[^\d+]/g, "");
        return (
          <a
            key={index}
            href={`tel:${clean}`}
            onClick={activate}
            onContextMenu={activate}
            style={{ textDecoration: "underline", color }}
          >
            {part}
          </a>
        );
      }

      return <span key={index}>{part}</span>;
    });
  }

  return (
    <div
      onClick={handleClick}
      onDoubleClick={() => {
        if (!selectionMode) onEnterSelectionMode?.(message);
      }}
      onContextMenu={(e) => onContextMenu?.(e, message)}
      onMouseDown={(e) => onSelectionDragStart?.(e, message)}
      onMouseEnter={(e) => onSelectionDragEnter?.(e, message)}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPressTimer}
      onTouchCancel={clearLongPressTimer}
      onTouchMove={clearLongPressTimer}
      style={{
        width: "100%",
        display: "flex",
        justifyContent: isOwn ? "flex-end" : "flex-start",
        padding: "2px 0px",
        borderRadius: 10,
        background: isSelected ? "rgba(11, 92, 255, 0.12)" : "transparent",
        boxShadow: isSelected ? "inset 0 0 0 1px rgba(11, 92, 255, 0.25)" : "none",
        cursor: selectionMode ? "pointer" : "default",
      }}
    >
      <div
        style={{
          maxWidth: "70%",
          padding: "8px 12px",
          borderRadius: 12,
          background: isSelected ? "#b7d7ff" : isOwn ? "#efecec" : "#eddcd3",
          boxShadow: isFocused
            ? "0 0 0 2px #ff9f1a"
            : isSelected
            ? "0 0 0 2px #0b5cff"
            : "1px 1px 7px rgb(0,0,0)",
          color: "#000000",
          font: "18px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          userSelect: "none",
        }}
      >
        {hasReply && (
          <button
            type="button"
            onClick={() => {
              if (message.replyTo && canOpenReplyPreview) {
                onReplyPreviewClick?.(message.replyTo);
              }
            }}
            style={{
              width: "100%",
              textAlign: "left",
              marginBottom: 8,
              padding: "6px 8px",
              borderRadius: 8,
              border: "none",
              background: "rgba(11, 92, 255, 0.12)",
              borderLeft: "3px solid #0b5cff",
              cursor: canOpenReplyPreview ? "pointer" : "default",
              opacity: canOpenReplyPreview ? 1 : 0.75,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0b5cff", marginBottom: 2 }}>
              {replyToMessage
                ? replyToMessage.senderId === currentUserId
                  ? "You"
                  : "Reply"
                : "Original message"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#222",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {replyToMessage?.text ?? "Message unavailable"}
            </div>
          </button>
        )}

        {(isDeleted || message.text) && (
          <div
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              lineHeight: 1.4,
              color: isDeleted ? "#8a8a8a" : "#000000",
              fontStyle: isDeleted ? "italic" : "normal",
            }}
          >
            {isDeleted ? "This message was deleted" : renderTextWithLinks(message.text!)}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 4,
            gap: 6,
            alignItems: "center",
          }}
        >
          {!isDeleted && message.edited && (
            <span style={{ fontSize: 12, color: "#444" }}>(edited)</span>
          )}
          <span style={{ fontSize: 15, color: "#000" }}>{timeIST}</span>
          <MessageStatus status={message.status} isOwn={isOwn} />
        </div>
      </div>
    </div>
  );
}
