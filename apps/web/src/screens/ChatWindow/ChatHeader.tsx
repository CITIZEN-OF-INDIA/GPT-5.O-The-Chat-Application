import { useChatStore } from "../../store/chat.store"; 
import { useAuthStore } from "../../store/auth.store";
import { getUserIdFromToken } from "../../utils/jwt";
import { normalizeChat } from "../../utils/normalizeChat";
import { useUserPresence } from "../../hooks/useUserPresence";
import { usePresenceStore } from "../../store/presence.store";

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

export default function ChatHeader() {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const token = useAuthStore((s) => s.token);
  const presenceReady = usePresenceStore((s) => s.ready);

  const activeChat = activeChatRaw ? normalizeChat(activeChatRaw) : null;
  const myUserId = token ? getUserIdFromToken(token) : null;

  const otherUser =
    activeChat && myUserId
      ? activeChat.participants.find(
          (p: any) => p?.id && p.id !== myUserId
        )
      : undefined;

  const presence = useUserPresence(otherUser?.id);

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
        position: "relative", // ✅ key
      }}
    >
      {/* LEFT: Username */}
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

      {/* CENTER: Presence / Timestamp */}
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
        <span style={{ fontSize: 20 }}>●</span>

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
