import { useChatStore } from "../../store/chat.store";
import { useAuthStore } from "../../store/auth.store";
import { getUserIdFromToken } from "../../utils/jwt";
import { normalizeChat } from "../../utils/normalizeChat";

export default function ChatHeader() {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const token = useAuthStore((s) => s.token);

  if (!activeChatRaw || !token) {
    return (
      <div
        style={{
          height: 64,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          fontWeight: 600,
          fontSize: 25,
        }}
      >
        Select a chat
      </div>
    );
  }

  // 🔑 normalize once (defensive — no UI impact)
  const activeChat = normalizeChat(activeChatRaw);

  // 🔑 logged-in user id (SAFE + CONSISTENT)
  const myUserId = getUserIdFromToken(token);

  // 🔑 find the other participant (OBJECT ONLY)
  const otherUser = activeChat.participants.find(
    (p: any) => p?.id && p.id !== myUserId
  );

  return (
    <div
      style={{
        height: 64,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        fontWeight: 600,
        fontSize: 25,
      }}
    >
      {otherUser?.username || "Chat"}
    </div>
  );
}
