// web/src/db/message.repo.ts
import { getDB } from "./indexedDB";
import type {
  Message,
  MessageStatus,
} from "../../../../packages/shared-types/message";

/**
 * Add / update a single message (local-first)
 */
export async function addMessage(message: Message) {
  const db = await getDB();
  await db.put("messages", message);
}

/**
 * Get messages for a chat
 */
export async function getMessagesByChat(chatId: string): Promise<Message[]> {
  const db = await getDB();
  const index = db.transaction("messages").store.index("by-chat");
  const messages = await index.getAll(chatId);
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get messages for a chat (paged, newest-first window)
 */
export async function getMessagesByChatPage(
  chatId: string,
  options?: { limit?: number; before?: number }
): Promise<Message[]> {
  const db = await getDB();
  const index = db.transaction("messages").store.index("by-chat-createdAt");

  const limit = options?.limit ?? 50;
  const before = options?.before ?? Number.MAX_SAFE_INTEGER;

  const range = IDBKeyRange.bound(
    [chatId, 0],
    [chatId, before],
    false,
    true
  );

  const messages: Message[] = [];
  let cursor = await index.openCursor(range, "prev");

  while (cursor && messages.length < limit) {
    messages.push(cursor.value);
    cursor = await cursor.continue();
  }

  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Get queued messages
 */
export async function getQueuedMessages(): Promise<Message[]> {
  const db = await getDB();
  const index = db.transaction("messages").store.index("by-status");
  const queued = await index.getAll("queued");
  return queued.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Update message status (SAFE)
 */
export async function updateMessageStatus(
  messageId: string,
  status: MessageStatus
) {
  const db = await getDB();
  const msg = await db.get("messages", messageId);
  if (!msg) return;

  msg.status = status;
  msg.updatedAt = Date.now();
  await db.put("messages", msg);
}

/**
 * Upsert messages from server
 */
export async function upsertMessages(messages: Message[]) {
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");

  for (const msg of messages) {
    await tx.store.put(msg);
  }

  await tx.done;
}

/**
 * Delete a message by id
 */
export async function deleteMessage(messageId: string) {
  const db = await getDB();
  await db.delete("messages", messageId);
}


/**
 * Clear messages of a chat (optional)
 */
export async function clearChatMessages(chatId: string) {
  

  const db = await getDB();
  const index = db.transaction("messages", "readwrite").store.index("by-chat");
  const keys = await index.getAllKeys(chatId);


  for (const key of keys) {
    await db.delete("messages", key as string);
  }
}
