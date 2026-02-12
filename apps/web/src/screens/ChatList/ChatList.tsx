import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatItem from "./ChatItem";
import { useAuthStore } from "../../store/auth.store";
import { useChatStore } from "../../store/chat.store";
import { createDirectChat } from "../../services/chat.service";
import { normalizeChat } from "../../utils/normalizeChat";
import { getUserIdFromToken } from "../../utils/jwt";
import type { ChatDB } from "../../db/indexedDB";
import { isEffectivelyOnline } from "../../utils/network";

type ChatContextMenuState = {
  chat: ChatDB;
  x: number;
  y: number;
};

export default function ChatList() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);

  const { chats, activeChat, upsertChats, setActiveChat, hydrate, requestDeleteChat } =
    useChatStore();

  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ChatContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const myUserId = getUserIdFromToken(token);

  useEffect(() => {
    setActiveChat(null);
    hydrate();
  }, [hydrate, setActiveChat, token]);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const rect = contextMenuRef.current.getBoundingClientRect();
    const margin = 8;
    let nextX = contextMenu.x;
    let nextY = contextMenu.y;

    if (nextX + rect.width + margin > window.innerWidth) {
      nextX = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (nextY + rect.height + margin > window.innerHeight) {
      nextY = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    if (nextX !== contextMenu.x || nextY !== contextMenu.y) {
      setContextMenu((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const handleSearchSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;

    const username = search.trim();
    if (!username) return;

    const normalizedSearch = username.toLowerCase();
    const existingChat = chats.find((chat) =>
      chat.participants.some(
        (p) => typeof p === "object" && String(p.username ?? "").toLowerCase() === normalizedSearch
      )
    );

    if (existingChat) {
      setActiveChat(existingChat);
      setSearch("");
      setError(null);
      return;
    }

    if (!isEffectivelyOnline()) {
      setError("No such user exists");
      return;
    }

    try {
      const rawChat = await createDirectChat(username);
      const chat = normalizeChat(rawChat);

      upsertChats([chat]);
      setActiveChat(chat);
      setSearch("");
      setError(null);
    } catch {
      setError(isEffectivelyOnline() ? "No such user exists" : "You're offline");
    }
  };

  const handleOpenDeleteDialog = () => {
    if (!contextMenu) return;
    setActiveChat(contextMenu.chat);
    requestDeleteChat(contextMenu.chat);
    setContextMenu(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const chatRows = useMemo(() => {
    if (!chats.length) return null;
    return chats.map((chat) => {
      const other = chat.participants.find((p) => String(p.id) !== String(myUserId));
      return (
        <ChatItem
          key={chat.id}
          username={other?.username || "Chat"}
          active={activeChat?.id === chat.id}
          onClick={() => setActiveChat(chat)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ chat, x: e.clientX, y: e.clientY });
          }}
        />
      );
    });
  }, [activeChat?.id, chats, myUserId, setActiveChat]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        backgroundColor: "#0b141a",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 360,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #202c33",
          backgroundColor: "#cfe9ff",
          color: "#000000",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: 64,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #202c33",
            backgroundColor: "#cfe9ff",
            fontWeight: 600,
            fontSize: 20,
          }}
        >
          Chats
        </div>

        <div style={{ padding: 12 }}>
          <input
            placeholder="Search username and press Enter"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleSearchSubmit}
            style={{
              width: "90%",
              marginBottom: 15,
              padding: "10px 14px",
              borderRadius: 20,
              border: "none",
              outline: "none",
              backgroundColor: "#ffffff",
              color: "#000000",
              fontSize: 18,
            }}
          />
          {error && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "#ff6b6b",
                paddingLeft: 6,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {chatRows ?? (
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: "#8696a0",
                fontSize: 14,
              }}
            >
              No chats yet
            </div>
          )}
        </div>

        <div
          style={{
            padding: 16,
            borderTop: "1px solid #202c33",
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#000000",
              color: "#ffffff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            minWidth: 180,
            overflow: "hidden",
            zIndex: 1300,
            border: "1px solid #e8e8e8",
          }}
        >
          <button
            type="button"
            onClick={handleOpenDeleteDialog}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              cursor: "pointer",
              fontSize: 16,
              color: "#d32f2f",
              border: "none",
              background: "#fff",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fff4f4";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
            }}
          >
            Delete chat
          </button>
        </div>
      )}

      <ChatWindow />
    </div>
  );
}
