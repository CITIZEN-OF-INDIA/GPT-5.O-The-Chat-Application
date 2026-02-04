import { useEffect, useMemo, useRef, useState } from "react";
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
import { getMessagesByChatPage, updateMessageStatus } from "../../db/message.repo";
import { normalizeChat } from "../../utils/normalizeChat";
import { runSyncCycle } from "../../services/sync.service";
import { seedLastSyncedAtFromChat } from "../../services/sync.service";

export default function ChatWindow() {
  const activeChatRaw = useChatStore((s) => s.activeChat);
  const token = useAuthStore((s) => s.token);
  const isUserAtBottomRef = useRef(true);
  const PAGE_SIZE = 50;

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

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestLoadedRef = useRef<number | null>(null);
  const suppressNextAutoScrollRef = useRef(false);
  const allowLoadOlderRef = useRef(false);

  // ✅ Load cached messages when chat opens
  useEffect(() => {
    if (!activeChat) return;
    console.log("🔥 ChatWindow hydrate", activeChat.id, Date.now());


    (async () => {
      await seedLastSyncedAtFromChat(
        activeChat.id,
        activeChat.lastMessage?.createdAt
      );

      const cachedMessages = await getMessagesByChatPage(activeChat.id, {
        limit: PAGE_SIZE,
      });
      if (cachedMessages.length) {
        const newestCached = Math.max(
          ...cachedMessages
            .map((m) => Number(m.createdAt))
            .filter((t) => Number.isFinite(t))
        );
        if (Number.isFinite(newestCached)) {
          await seedLastSyncedAtFromChat(activeChat.id, newestCached);
        }
      }

      // Add only new messages to Zustand
      const existingKeys = new Set(
        allMessages.flatMap((m) => [m.id, m.clientId].filter(Boolean))
      );
      cachedMessages.forEach((m) => {
        if (!existingKeys.has(m.id) && !existingKeys.has(m.clientId)) {
          addMessage(m);
        }
      });

      if (cachedMessages.length) {
        oldestLoadedRef.current = Math.min(
          ...cachedMessages.map((m) => m.createdAt)
        );
      } else {
        oldestLoadedRef.current = null;
      }

      setHasMore(cachedMessages.length === PAGE_SIZE);

      // Initial view: keep at bottom and don't auto-load older until user scrolls
      allowLoadOlderRef.current = false;
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        allowLoadOlderRef.current = true;
      });

      // Immediately sync new messages from server
      await runSyncCycle();
    })();
  }, [activeChat, addMessage]);

  // ✅ Filter messages for active chat
  const messages = useMemo(() => {
    if (!activeChat) return [];
    return allMessages
      .filter((m: Message) => m.chatId === activeChat.id)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allMessages, activeChat]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ✅ Auto-scroll
  useEffect(() => {
    if (suppressNextAutoScrollRef.current) {
      suppressNextAutoScrollRef.current = false;
      return;
    }
    if (isUserAtBottomRef.current && !isLoadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const loadOlderMessages = async () => {
    if (!activeChat || isLoadingOlder || !hasMore) return;
    setIsLoadingOlder(true);
    isUserAtBottomRef.current = false;
    suppressNextAutoScrollRef.current = true;

    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    const before = oldestLoadedRef.current ?? Number.MAX_SAFE_INTEGER;
    const older = await getMessagesByChatPage(activeChat.id, {
      limit: PAGE_SIZE,
      before,
    });

    if (older.length) {
      const existingKeys = new Set(
        allMessages.flatMap((m) => [m.id, m.clientId].filter(Boolean))
      );
      older.forEach((m) => {
        if (!existingKeys.has(m.id) && !existingKeys.has(m.clientId)) {
          addMessage(m);
        }
      });

      oldestLoadedRef.current = Math.min(
        before,
        ...older.map((m) => m.createdAt)
      );
    }

    setHasMore(older.length === PAGE_SIZE);
    setIsLoadingOlder(false);

    // Preserve scroll position after prepending
    requestAnimationFrame(() => {
      if (!container) return;
      const newScrollHeight = container.scrollHeight;
      const delta = newScrollHeight - prevScrollHeight;
      container.scrollTop = prevScrollTop + delta;
    });
  };

  // ✅ Mark incoming messages as READ
  useEffect(() => {
    if (!activeChat || !myUserId) return;

    const socket = getSocket({ requireConnected: false });
    if (!socket) return;

    messages.forEach((msg) => {
      if (msg.senderId !== myUserId && msg.status !== MessageStatus.READ) {
        socket.emit("message:read", { messageId: msg.id });

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
        ref={messagesContainerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const threshold = 40;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
          isUserAtBottomRef.current = atBottom;
          if (allowLoadOlderRef.current && el.scrollTop < 60) {
            loadOlderMessages();
          }
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
