import { getDB } from "../db/indexedDB";
import {
  upsertMessages,
  getQueuedMessages,
  deleteMessage as deleteMessageFromDB,
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
 * Seed lastSyncedAt from a chat's lastMessage (server-provided)
 */
export async function seedLastSyncedAtFromChat(chatId: string, lastMessageAt?: number) {
  if (!lastMessageAt) return;

  const existing = await getLastSyncedAt(chatId);
  if (existing > 0) return;

  await setLastSyncedAt(chatId, lastMessageAt);
}

/**
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
  const lastMessageAt = Number(lastMessage?.createdAt);
  const lastSyncedAt = Number(lastSynced);
  const lastRelevantTimestamp = Math.max(
    Number.isFinite(lastMessageAt) ? lastMessageAt : 0,
    Number.isFinite(lastSyncedAt) ? lastSyncedAt : 0
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

  // 3?? Build existing message maps (id + clientId)
  const existing = await db.getAll("messages");
  const existingById = new Map(existing.map((m) => [m.id, m]));
  const existingByClientId = new Map(
    existing
      .filter((m) => m.clientId)
      .map((m) => [m.clientId as string, m])
  );

  const normalized: Message[] = rawMessages.map(normalizeMessage);
  if (!normalized.length) return;

  const { addMessage, replaceMessage } = useMessageStore.getState();
  const toUpsert: Message[] = [];
  const toAdd: Message[] = [];
  const toReplace: { clientId: string; msg: Message }[] = [];

  for (const msg of normalized) {
    if (existingById.has(msg.id)) {
      // Same server id already exists: update status/fields
      toUpsert.push(msg);
      toAdd.push(msg);
      continue;
    }

    if (
      msg.clientId &&
      (existingById.has(msg.clientId) ||
        existingByClientId.has(msg.clientId))
    ) {
      // Server message corresponds to an optimistic/local one
      toUpsert.push(msg);
      toReplace.push({ clientId: msg.clientId, msg });
      continue;
    }

    // New message
    toUpsert.push(msg);
    toAdd.push(msg);
  }

  if (!toUpsert.length) return;

  // 4?? Persist + hydrate (with reconciliation)
  for (const { clientId } of toReplace) {
    // Remove local optimistic record before inserting server version
    await deleteMessageFromDB(clientId);
  }
  await upsertMessages(toUpsert);

  toReplace.forEach(({ clientId, msg }) => {
    // Replace optimistic/local entry in Zustand
    replaceMessage(clientId, msg);
  });

  toAdd.forEach((msg) => addMessage({ ...msg, __source: "sync" }));

  // 5?? Update sync timestamp
  const newestTimestamp = Math.max(...toUpsert.map((m) => m.createdAt));
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

    const ack = await new Promise<{ ok: boolean; message?: Message }>(
      (resolve) => {
        socket.emit(
          "message:send",
          {
            chatId: msg.chatId,
            receiverId: receiver.id,
            text: msg.text,
            clientId: msg.id,
          },
          (res: { ok: boolean; message?: Message }) => resolve(res)
        );
      }
    );

    if (!ack?.ok) {
      await updateMessageStatusDB(msg.id, MessageStatus.QUEUED);
      useMessageStore.getState().updateStatus(
        msg.id,
        MessageStatus.QUEUED
      );
      continue;
    }

    if (!ack.message) continue;

    // ✅ normalize server message
    const serverMsg = normalizeMessage(ack.message);

    // 🔑 CRITICAL: replace optimistic message
    serverMsg.clientId = msg.id;
    serverMsg.status = MessageStatus.SENT;

    // remove optimistic record keyed by clientId
    await deleteMessageFromDB(msg.id);

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
