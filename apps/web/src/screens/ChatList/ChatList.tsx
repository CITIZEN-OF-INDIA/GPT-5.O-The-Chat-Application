import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatWindow from "../ChatWindow/ChatWindow";
import ChatItem from "./ChatItem";
import { useAuthStore } from "../../store/auth.store";
import { useChatStore } from "../../store/chat.store";
import { createDirectChat } from "../../services/chat.service";
import { normalizeChat } from "../../utils/normalizeChat";
import { getUserIdFromToken } from "../../utils/jwt"; // ✅ FIX 1

export default function ChatList() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);

  const {
    chats,
    activeChat,
    upsertChats,
    setActiveChat,
    hydrate, // ✅ OFFLINE-FIRST hydrate
  } = useChatStore();

  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 🔑 logged-in user id (SINGLE SOURCE OF TRUTH)
  const myUserId = getUserIdFromToken(token);


  /**
   * ✅ OFFLINE-FIRST chat loading
   * - IndexedDB always
   * - Server sync if online
   */
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSearchSubmit = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== "Enter") return;

    const username = search.trim();
    if (!username) return;

    const normalizedSearch = username.toLowerCase();

    // 🔑 OFFLINE SEARCH (IndexedDB chats)
    const existingChat = chats.find((chat) =>
      chat.participants.some(
        (p) =>
          typeof p === "object" &&
          String(p.username ?? "").toLowerCase() === normalizedSearch
      )
    );

    if (existingChat) {
      setActiveChat(existingChat);
      setSearch("");
      setError(null);
      return;
    }

    // ❌ Offline & not found
    if (!navigator.onLine) {
      setError("No such user exists");
      return;
    }

    try {
      // 🌐 Online → create chat
      const rawChat = await createDirectChat(username);
      const chat = normalizeChat(rawChat);

      upsertChats([chat]);
      setActiveChat(chat);

      setSearch("");
      setError(null);
    } catch {
      setError(navigator.onLine ? "No such user exists" : "You're offline");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    /* 🔥 UI COMPLETELY UNCHANGED 🔥 */
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        backgroundColor: "#0b141a",
        overflow: "hidden",
      }}
    >
      {/* SIDEBAR */}
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
        {/* HEADER */}
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

        {/* SEARCH */}
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

        {/* CHAT LIST */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.length > 0 ? (
  chats.map((chat) => {
    // ✅ participants are ALWAYS objects
    // ✅ strict string comparison to avoid self-showing
    const other = chat.participants.find(
      (p) => String(p.id) !== String(myUserId)
    );

    return (
      <ChatItem
        key={chat.id}
        username={other?.username || "Chat"}
        active={activeChat?.id === chat.id}
        onClick={() => setActiveChat(chat)}
      />
    );
  })
) : (
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

        {/* LOGOUT */}
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

      <ChatWindow />
    </div>
  );
}
