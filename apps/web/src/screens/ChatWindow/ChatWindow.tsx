import { useEffect, useMemo, useRef } from "react";
import { useChatStore } from "../../store/chat.store";
import { useAuthStore } from "../../store/auth.store";
import { useMessageStore } from "../../store/message.store";
import ChatHeader from "./ChatHeader";
import MessageBubble from "../../components/Message/MessageBubble";
import type { Message } from "../../../../../packages/shared-types/message";
import { getUserIdFromToken } from "../../utils/jwt";
import MessageInput from "./MessageInput";
import { getSocket } from "../../services/socket.service";
import { MessageStatus } from "../../../../../packages/shared-types/message";
import { getMessagesByChat, updateMessageStatus } from "../../db/message.repo";
import { normalizeChat } from "../../utils/normalizeChat";
import { runSyncCycle } from "../../services/sync.service";

export default function ChatWindow() {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const token = useAuthStore((s) => s.token);
  const isUserAtBottomRef = useRef(true);

  // 🔑 normalize defensively
  const activeChat = useMemo(() => {
    return activeChatRaw ? normalizeChat(activeChatRaw) : null;
  }, [activeChatRaw]);

  // 🔑 logged-in user id (SAFE)
  const myUserId = useMemo(() => {
    return token ? getUserIdFromToken(token) : null;
  }, [token]);

  const { messages: allMessages, addMessage, updateStatus } =
    useMessageStore();

  // ✅ Load cached messages when chat opens
  useEffect(() => {
    if (!activeChat) return;
    console.log("🔥 ChatWindow hydrate", activeChat.id, Date.now());


    (async () => {
      const cachedMessages = await getMessagesByChat(activeChat.id);

      // Add only new messages to Zustand
      const existingKeys = new Set(allMessages.flatMap(m => [m.id, m.clientId].filter(Boolean)));
cachedMessages.forEach((m) => {
  if (!existingKeys.has(m.id) && !existingKeys.has(m.clientId)) addMessage(m);
});


      // Immediately sync new messages from server
      await runSyncCycle();
    })();
  }, [activeChat, addMessage]);

  // ✅ Filter messages for active chat
  const messages = useMemo(() => {
    if (!activeChat) return [];
    return allMessages.filter((m: Message) => m.chatId === activeChat.id);
  }, [allMessages, activeChat]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ Auto-scroll
  useEffect(() => {
    if (isUserAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ✅ Mark incoming messages as READ
  useEffect(() => {
    if (!activeChat || !myUserId) return;

    const socket = getSocket();
    if (!socket) return;

    messages.forEach((msg) => {
      if (msg.senderId !== myUserId && msg.status !== MessageStatus.READ) {
        socket.emit("message:received", { messageId: msg.id });

        updateStatus(msg.id, MessageStatus.READ);
        updateMessageStatus(msg.id, MessageStatus.READ);
      }
    });
  }, [messages, activeChat, myUserId, updateStatus]);

  // ✅ CORRECT receiver resolution (OBJECT SAFE)
  const receiverId = useMemo(() => {
    if (!activeChat || !myUserId) return "";

    const other = activeChat.participants.find(
      (p: any) => p?.id && p.id !== myUserId
    );

    return other?.id || "";
  }, [activeChat, myUserId]);

  // 🧪 DEBUG (NOW CORRECT)
  /*if (activeChat && myUserId) {
    console.log("🧪 CHAT DEBUG", {
      myUserId,
      participants: activeChat.participants,
      resolvedReceiverId: receiverId,
    });
  }*/

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#eaeff2",
        color: "#e9edef",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          backgroundColor: "#ffffff",
          color: "#000000",
          flexShrink: 0,
        }}
      >
        <ChatHeader />
      </div>

      {/* MESSAGES */}
      <div
        onScroll={(e) => {
          const el = e.currentTarget;
          const threshold = 40;
          isUserAtBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        }}
        style={{
          flex: 1,
          padding: "16px 24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          backgroundImage: "url('/src/background-image.jpg')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "auto",
        }}
      >
        {!activeChat && (
          <div
            style={{
              margin: "auto",
              color: "#8696a0",
              fontSize: 40,
            }}
          >
            Select a chat to start messaging
          </div>
        )}

        {activeChat &&
          messages.map((msg) => (
            <MessageBubble  key={msg.clientId ?? msg.id} message={msg} myUserId={myUserId!} />
          ))}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div
        style={{
          minHeight: 72,
          padding: "8px 16px",
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          backgroundImage: "url('/src/background-image.jpg')",
          backgroundRepeat: "repeat",
          backgroundPosition: "center",
          backgroundSize: "auto",
          flexShrink: 0,
        }}
      >
        <MessageInput
          chatId={activeChat?.id || ""}
          receiverId={receiverId}
          disabled={!activeChat || !token}
        />
      </div>
    </div>
  );
}
