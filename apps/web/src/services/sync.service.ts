import { getDB } from "../db/indexedDB";
import {
  upsertMessages,
  getQueuedMessages,
  updateMessageStatus as updateMessageStatusDB,
} from "../db/message.repo";
import { useMessageStore } from "../store/message.store";
import { getSocket } from "./socket.service";
import {
  type Message,
  MessageStatus,
} from "../../../../packages/shared-types/message";
import { useChatStore } from "../store/chat.store";
import { useAuthStore } from "../store/auth.store";
import { normalizeMessage } from "../utils/normalizeMessage";
import { getUserIdFromToken } from "../utils/jwt";

/**
 * Get the last synced timestamp for a chat
 */
async function getLastSyncedAt(chatId: string): Promise<number> {
  const db = await getDB();
  const record = await db.get("meta", `lastSyncedAt_${chatId}`);
  return record?.value ?? 0;
}

async function setLastSyncedAt(chatId: string, timestamp: number) {
  const db = await getDB();
  await db.put("meta", { key: `lastSyncedAt_${chatId}`, value: timestamp });
}

/**
 * Fetch ONLY new messages from server
 */
export async function syncNewMessages(chatId: string) {
  const db = await getDB();
  const token = useAuthStore.getState().token;
  if (!token) return;

  // 1️⃣ Find last non-optimistic message
  const lastMessage = await db
    .getAllFromIndex("messages", "by-chat", chatId)
    .then((msgs) =>
      msgs
        .filter(
          (m) =>
            m.status !== MessageStatus.QUEUED &&
            m.status !== MessageStatus.SENDING
        )
        .sort((a, b) => b.createdAt - a.createdAt)[0]
    );

  const lastSynced = await getLastSyncedAt(chatId);
  const lastRelevantTimestamp = Math.max(
    lastMessage?.createdAt ?? 0,
    lastSynced
  );

  // 2️⃣ Fetch newer messages
  const res = await fetch(
    `/api/messages?chatId=${chatId}&since=${lastRelevantTimestamp}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) return;

  const rawMessages: any[] = await res.json();
  if (!rawMessages.length) return;

  // 3️⃣ Build existing ID set (id + clientId)
  const existingIds = new Set(
    (await db.getAll("messages")).flatMap((m) =>
      [m.id, m.clientId].filter(Boolean)
    )
  );

  const messages: Message[] = rawMessages
    .map(normalizeMessage)
    .filter(
      (m) =>
        !existingIds.has(m.id) &&
        (!m.clientId || !existingIds.has(m.clientId))
    );

  if (!messages.length) return;

  // 4️⃣ Persist + hydrate
  await upsertMessages(messages);
  const { addMessage } = useMessageStore.getState();
  messages.forEach((msg) => addMessage({ ...msg, __source: "sync" }));

  // 5️⃣ Update sync timestamp
  const newestTimestamp = Math.max(...messages.map((m) => m.createdAt));
  await setLastSyncedAt(chatId, newestTimestamp);
}

/**
 * Send queued messages
 */
export async function flushQueuedMessages() {
  console.log("🔥 flushQueuedMessages CALLED");

  const socket = getSocket();
  console.log("🔥 socket exists?", !!socket, socket?.connected);
  if (!socket) return;

  const queued = await getQueuedMessages();
  if (!queued.length) return;

  const { activeChat } = useChatStore.getState();
  if (!activeChat) return;

  const myUserId = getUserIdFromToken(useAuthStore.getState().token);
  if (!myUserId) return;

  const receiver = activeChat.participants.find(
    (p) => p.id !== myUserId
  );
  if (!receiver) return;

  for (const msg of queued) {
    if (msg.chatId !== activeChat.id) continue;

    // 🔒 mark as sending
    await updateMessageStatusDB(msg.id, MessageStatus.SENDING);
    useMessageStore.getState().updateStatus(msg.id, MessageStatus.SENDING);

    
    socket.emit(
      
      "message:send",
      {
        chatId: msg.chatId,
        receiverId: receiver.id,
        text: msg.text,
        clientId: msg.id,
      },
      async (ack: { ok: boolean; message?: Message }) => {
        if (!ack?.ok) {
          await updateMessageStatusDB(msg.id, MessageStatus.QUEUED);
          useMessageStore.getState().updateStatus(
            msg.id,
            MessageStatus.QUEUED
          );
          return;
        }

        if (!ack.message) return;

        // ✅ normalize server message
        const serverMsg = normalizeMessage(ack.message);

        // 🔑 CRITICAL: replace optimistic message
        
        serverMsg.clientId = msg.id;
        serverMsg.status = MessageStatus.SENT;

        // IndexedDB
        await upsertMessages([serverMsg]);

        // Zustand
        useMessageStore
          .getState()
          .replaceMessage(msg.id, serverMsg);

        console.log("📤 queued message sent & reconciled", {
          chatId: msg.chatId,
          to: receiver.id,
          text: msg.text,
        });
      }
    );
  }
}

/**
 * Full sync cycle
 */
export async function runSyncCycle() {
  const { activeChat } = useChatStore.getState();
  if (!activeChat?.id) return;

  await syncNewMessages(activeChat.id);
  await flushQueuedMessages();
}
