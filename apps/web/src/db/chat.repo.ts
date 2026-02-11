import { getDB } from "./indexedDB";
import type { ChatDB } from "./indexedDB";
import { normalizeChat } from "../utils/normalizeChat";

const DELETED_CHAT_IDS_META_KEY_PREFIX = "deletedChatIds_";

/**
 * Upsert chats from server
 */
export async function upsertChats(chats: ChatDB[]) {
  const db = await getDB();
  const tx = db.transaction("chats", "readwrite");

  for (const chat of chats.map(normalizeChat)) {
    await tx.store.put(chat);
  }

  await tx.done;
}

/**
 * ⚠️ DO NOT USE DIRECTLY FOR UI
 * Returns ALL chats from IndexedDB (multi-user unsafe)
 */
export async function getAllChats(): Promise<ChatDB[]> {
  const db = await getDB();
  return db.getAll("chats");
}

/**
 * ✅ SAFE: Get chats ONLY for current user
 */
export async function getChatsForUser(userId: string): Promise<ChatDB[]> {
  const db = await getDB();
  const allChats = await db.getAll("chats");

  return allChats.filter(chat =>
    chat.participants.some(p => p.id === userId)
  );
}

/**
 * Get single chat
 */
export async function getChatById(chatId: string) {
  const db = await getDB();
  return db.get("chats", chatId);
}

export async function deleteChatById(chatId: string) {
  const db = await getDB();
  await db.delete("chats", chatId);
}

export async function getDeletedChatIdsForUser(userId: string): Promise<string[]> {
  const db = await getDB();
  const record = await db.get("meta", `${DELETED_CHAT_IDS_META_KEY_PREFIX}${userId}`);
  const ids = Array.isArray(record?.value) ? record.value : [];
  return ids.map(String);
}

export async function markChatDeletedForUser(userId: string, chatId: string) {
  const db = await getDB();
  const key = `${DELETED_CHAT_IDS_META_KEY_PREFIX}${userId}`;
  const existing = await getDeletedChatIdsForUser(userId);
  if (existing.includes(chatId)) return;
  await db.put("meta", { key, value: [...existing, chatId] });
}
