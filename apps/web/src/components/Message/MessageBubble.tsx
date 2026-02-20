import type { Message } from "../../../../../packages/shared-types/message";
import MessageStatus from "./MessageStatus";
import { useAuthStore } from "../../store/auth.store";
import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";

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
  onSwipeReply?: (m: Message) => void;
  isMobile?: boolean;
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
  onSwipeReply,
  isMobile = false,
}: MessageBubbleProps) {
  const token = useAuthStore((s) => s.token);
  const timeIST = message.createdAt ? formatIST(message.createdAt) : "";

  const VISITED_LINKS_STORAGE_KEY = "visited-links-v1";

  const [visitedLinks, setVisitedLinks] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(VISITED_LINKS_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      const links = parsed.filter((item): item is string => typeof item === "string");
      return new Set(links);
    } catch {
      return new Set();
    }
  });

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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeTriggeredRef = useRef(false);
  const longPressTriggeredRef = useRef(false);
  const suppressTapUntilRef = useRef(0);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeTriggeredRef.current = false;
    longPressTriggeredRef.current = false;
    if (!onEnterSelectionMode && !onToggleSelection) return;
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      suppressTapUntilRef.current = Date.now() + 180;
      if (selectionMode) onToggleSelection?.(message);
      else onEnterSelectionMode?.(message);
    }, 450);
  };

  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const origin = touchStartRef.current;
    const touch = e.touches[0];
    if (!origin || !touch) return;

    const deltaX = touch.clientX - origin.x;
    const deltaY = touch.clientY - origin.y;

    if (!swipeTriggeredRef.current && Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      swipeTriggeredRef.current = true;
      clearLongPressTimer();
      onSwipeReply?.(message);
      return;
    }

    if (!longPressTriggeredRef.current && (Math.abs(deltaY) > 20 || Math.abs(deltaX) > 20)) {
      clearLongPressTimer();
    }
  };

  const handleTouchEnd = () => {
    clearLongPressTimer();
    touchStartRef.current = null;
    swipeTriggeredRef.current = false;
    longPressTriggeredRef.current = false;
  };

  const handleClick = () => {
    if (!selectionMode) return;
    if (isMobile && Date.now() < suppressTapUntilRef.current) {
      return;
    }
    if (shouldSuppressSelectionClick?.()) return;
    onToggleSelection?.(message);
  };

  function renderTextWithLinks(text: string) {
    const regex =
      /(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s-]{7,}\d)/gi;

    return text.split(regex).map((part, index) => {
      if (!part) return null;

      const normalizedLink = /^https?:\/\//i.test(part)
        ? part
        : /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)
        ? `mailto:${part}`
        : /^\+?\d[\d\s-]{7,}\d$/.test(part)
        ? `tel:${part.replace(/[^\d+]/g, "")}`
        : "";

      const isActive = normalizedLink ? visitedLinks.has(normalizedLink) : false;
      const color = isActive ? "#ff9f1a" : "#0645AD";

      const activate = (e: ReactMouseEvent) => {
        e.stopPropagation();
        if (!normalizedLink) return;
        setVisitedLinks((prev) => {
          if (prev.has(normalizedLink)) return prev;
          const next = new Set(prev).add(normalizedLink);
          try {
            window.localStorage.setItem(VISITED_LINKS_STORAGE_KEY, JSON.stringify([...next]));
          } catch {
            // Ignore storage failures and keep in-memory state.
          }
          return next;
        });
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
        if (isMobile) return;
        if (!selectionMode) onEnterSelectionMode?.(message);
      }}
      onContextMenu={(e) => onContextMenu?.(e, message)}
      onMouseDown={(e) => onSelectionDragStart?.(e, message)}
      onMouseEnter={(e) => onSelectionDragEnter?.(e, message)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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
