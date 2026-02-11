import { useChatStore } from "../../store/chat.store";
import { useAuthStore } from "../../store/auth.store";
import { getUserIdFromToken } from "../../utils/jwt";
import { normalizeChat } from "../../utils/normalizeChat";
import { useUserPresence } from "../../hooks/useUserPresence";
import { usePresenceStore } from "../../store/presence.store";
import { useEffect, useRef, useState } from "react";
import type { Message } from "../../../../../packages/shared-types/message";

interface ChatHeaderProps {
  selectionMode?: boolean;
  selectedCount?: number;
  singleSelectedMessage?: Message | null;
  onClearSelection?: () => void;
  onCopySelected?: () => void;
  onReplySelected?: () => void;
  onEditSelected?: () => void;
  onPinSelected?: () => void;
  onDeleteSelected?: () => void;
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
  onClearSelection,
  onCopySelected,
  onReplySelected,
  onEditSelected,
  onPinSelected,
  onDeleteSelected,
}: ChatHeaderProps) {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const token = useAuthStore((s) => s.token);
  const presenceReady = usePresenceStore((s) => s.ready);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeChat = activeChatRaw ? normalizeChat(activeChatRaw) : null;
  const myUserId = token ? getUserIdFromToken(token) : null;

  const otherUser =
    activeChat && myUserId
      ? activeChat.participants.find((p: any) => p?.id && p.id !== myUserId)
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

  if (selectionMode) {
    const isSingle = selectedCount === 1;
    const pinLabel = singleSelectedMessage?.pinned ? "Unpin" : "Pin";
    const canEditSelected =
      isSingle &&
      Boolean(singleSelectedMessage) &&
      singleSelectedMessage?.senderId === myUserId;

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
              onClick={() => {
                onCopySelected?.();
                setMenuOpen(false);
              }}
            />

            {isSingle && (
              <MenuItem
                label="Reply"
                onClick={() => {
                  onReplySelected?.();
                  setMenuOpen(false);
                }}
              />
            )}

            {canEditSelected && (
              <MenuItem
                label="Edit"
                onClick={() => {
                  onEditSelected?.();
                  setMenuOpen(false);
                }}
              />
            )}

            {isSingle && (
              <MenuItem
                label={pinLabel}
                onClick={() => {
                  onPinSelected?.();
                  setMenuOpen(false);
                }}
              />
            )}

            <MenuItem
              label="Delete"
              danger
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
    </div>
  );
}

function MenuItem({
  label,
  danger = false,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 14px",
        cursor: "pointer",
        fontSize: 16,
        color: danger ? "#d32f2f" : "#000",
        border: "none",
        background: "#fff",
        borderBottom: "1px solid #eee",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#fff4f4" : "#f4f7ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
    </button>
  );
}
