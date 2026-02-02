import { getDB } from "./indexedDB";
import type { ChatDB } from "./indexedDB";
import { normalizeChat } from "../utils/normalizeChat";

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
