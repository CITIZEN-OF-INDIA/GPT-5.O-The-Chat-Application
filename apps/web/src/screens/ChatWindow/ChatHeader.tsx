import { useChatStore } from "../../store/chat.store";
import { useAuthStore } from "../../store/auth.store";
import { getUserIdFromToken } from "../../utils/jwt";
import { normalizeChat } from "../../utils/normalizeChat";
import { useUserPresence } from "../../hooks/useUserPresence";
import { usePresenceStore } from "../../store/presence.store";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Message } from "../../../../../packages/shared-types/message";

interface ChatHeaderProps {
  selectionMode?: boolean;
  selectedCount?: number;
  singleSelectedMessage?: Message | null;
  canCopySelected?: boolean;
  canReplySelected?: boolean;
  canEditSelected?: boolean;
  canPinSelected?: boolean;
  canDeleteSelected?: boolean;
  onClearSelection?: () => void;
  onCopySelected?: () => void;
  onReplySelected?: () => void;
  onEditSelected?: () => void;
  onPinSelected?: () => void;
  onDeleteSelected?: () => void;
  searchOpen?: boolean;
  searchQuery?: string;
  searchMatchCount?: number;
  searchCurrentIndex?: number;
  onToggleSearch?: () => void;
  onSearchQueryChange?: (query: string) => void;
  onSearchPrev?: () => void;
  onSearchNext?: () => void;
}

function formatLastSeen(lastSeen?: string) {
  if (!lastSeen) return "";
  const d = new Date(lastSeen);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const time = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${day}/${month}/${year}, ${time}`;
}

export default function ChatHeader({
  selectionMode = false,
  selectedCount = 0,
  singleSelectedMessage = null,
  canCopySelected = false,
  canReplySelected = false,
  canEditSelected = false,
  canPinSelected = false,
  canDeleteSelected = false,
  onClearSelection,
  onCopySelected,
  onReplySelected,
  onEditSelected,
  onPinSelected,
  onDeleteSelected,
  searchOpen = false,
  searchQuery = "",
  searchMatchCount = 0,
  searchCurrentIndex = 0,
  onToggleSearch,
  onSearchQueryChange,
  onSearchPrev,
  onSearchNext,
}: ChatHeaderProps) {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const token = useAuthStore((s) => s.token);
  const presenceReady = usePresenceStore((s) => s.ready);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCompactMobile, setIsCompactMobile] = useState(() => window.innerWidth <= 768);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeChat = activeChatRaw ? normalizeChat(activeChatRaw) : null;
  const myUserId = token ? getUserIdFromToken(token) : null;

  const otherUser =
    activeChat && myUserId
      ? activeChat.participants.find(
          (p: { id?: string; username?: string } | null | undefined) => p?.id && p.id !== myUserId
        )
      : undefined;

  const presence = useUserPresence(otherUser?.id);

  useEffect(() => {
    if (!menuOpen) return;
    const onWindowClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("click", onWindowClick);
    return () => window.removeEventListener("click", onWindowClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!selectionMode) setMenuOpen(false);
  }, [selectionMode]);

  useEffect(() => {
    const onResize = () => setIsCompactMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (selectionMode) {
    const isSingle = selectedCount === 1;
    const pinLabel = singleSelectedMessage?.pinned ? "Unpin" : "Pin";

    return (
      <div
        style={{
          height: 64,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderBottom: "1px solid #e5e5e5",
          backgroundColor: "#ffffff",
          position: "relative",
        }}
      >
        <button
          onClick={() => {
            setMenuOpen(false);
            onClearSelection?.();
          }}
          style={{
            fontSize: 22,
            cursor: "pointer",
            background: "none",
            border: "none",
          }}
          aria-label="Clear selection"
          title="Clear selection"
        >
          {"\u2715"}
        </button>

        <div style={{ fontSize: 20, fontWeight: 600 }}>{selectedCount} selected</div>

        <div
          style={{
            marginLeft: "auto",
            fontSize: 26,
            cursor: "pointer",
            userSelect: "none",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          aria-label="More actions"
          title="More actions"
        >
          {"\u22EE"}
        </div>

        {menuOpen && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: 64,
              right: 16,
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              minWidth: 180,
              overflow: "hidden",
              zIndex: 1000,
            }}
          >
            <MenuItem
              label="Copy"
              disabled={!canCopySelected}
              onClick={() => {
                onCopySelected?.();
                setMenuOpen(false);
              }}
            />

            {isSingle && (
              <MenuItem
                label="Reply"
                disabled={!canReplySelected}
                onClick={() => {
                  onReplySelected?.();
                  setMenuOpen(false);
                }}
              />
            )}

            {isSingle && (
              <MenuItem
                label="Edit"
                disabled={!canEditSelected}
                onClick={() => {
                  onEditSelected?.();
                  setMenuOpen(false);
                }}
              />
            )}

            {isSingle && (
              <MenuItem
                label={pinLabel}
                disabled={!canPinSelected}
                onClick={() => {
                  onPinSelected?.();
                  setMenuOpen(false);
                }}
              />
            )}

            <MenuItem
              label="Delete"
              danger
              disabled={!canDeleteSelected}
              onClick={() => {
                onDeleteSelected?.();
                setMenuOpen(false);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  if (!activeChat || !token) {
    return (
      <div
        style={{
          height: 64,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        Select a chat
      </div>
    );
  }

  return (
    <div
      style={{
        height: 64,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid #e5e5e5",
        position: "relative",
      }}
    >
      {isCompactMobile && (
        <button
          type="button"
          onClick={() => setActiveChat(null)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 22,
            lineHeight: 1,
            marginRight: 10,
            padding: 0,
          }}
          aria-label="Back to chats"
          title="Back to chats"
        >
          {"\u2039"}
        </button>
      )}
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {otherUser?.username || "Chat"}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 20,
          fontWeight: 500,
          color: presence?.online ? "#5ddf3d" : "#fa0c0c",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 20 }}>{"\u25CF"}</span>

        {!presenceReady
          ? "Checking..."
          : presence?.online
          ? "Online"
          : presence?.lastSeen
          ? `Last seen ${formatLastSeen(presence.lastSeen)}`
          : "Offline"}
      </div>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 2,
        }}
      >
        {searchOpen && (
          <>
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange?.(e.target.value)}
              placeholder="Search messages"
              style={{
                height: 34,
                width: 180,
                border: "1px solid #d9d9d9",
                borderRadius: 8,
                padding: "0 10px",
                outline: "none",
                fontSize: 14,
              }}
            />
            <div style={{ fontSize: 12, color: "#4f5b62", minWidth: 48, textAlign: "center" }}>
              {searchMatchCount ? `${searchCurrentIndex + 1}/${searchMatchCount}` : "0/0"}
            </div>
            <button
              type="button"
              onClick={onSearchPrev}
              disabled={!searchMatchCount}
              style={iconButtonStyle}
              aria-label="Previous match"
              title="Previous match"
            >
              {"\u2191"}
            </button>
            <button
              type="button"
              onClick={onSearchNext}
              disabled={!searchMatchCount}
              style={iconButtonStyle}
              aria-label="Next match"
              title="Next match"
            >
              {"\u2193"}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onToggleSearch}
          style={iconButtonStyle}
          aria-label={searchOpen ? "Close search" : "Open search"}
          title={searchOpen ? "Close search" : "Open search"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const iconButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #d9d9d9",
  background: "#fff",
  cursor: "pointer",
  color: "#1f2937",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  lineHeight: 1,
};

function MenuItem({
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 16,
        color: disabled ? "#9aa0a6" : danger ? "#d32f2f" : "#000",
        border: "none",
        background: "#fff",
        borderBottom: "1px solid #eee",
        transition: "background-color 120ms ease",
        opacity: disabled ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = danger ? "#fff4f4" : "#f4f7ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
