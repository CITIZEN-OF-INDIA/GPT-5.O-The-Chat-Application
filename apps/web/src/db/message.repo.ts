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

export async function getMessageById(messageId: string): Promise<Message | null> {
  const db = await getDB();
  return (await db.get("messages", messageId)) ?? null;
}

export async function getMessagesByIds(messageIds: string[]): Promise<Message[]> {
  if (!messageIds.length) return [];
  const db = await getDB();
  const tx = db.transaction("messages", "readonly");
  const rows = await Promise.all(messageIds.map((id) => tx.store.get(id)));
  await tx.done;
  return rows.filter((row): row is Message => Boolean(row));
}

export async function searchMessageIdsByChat(
  chatId: string,
  query: string
): Promise<string[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const db = await getDB();
  const index = db.transaction("messages").store.index("by-chat-createdAt");
  const range = IDBKeyRange.bound([chatId, 0], [chatId, Number.MAX_SAFE_INTEGER]);

  const ids: string[] = [];
  let cursor = await index.openCursor(range, "next");

  while (cursor) {
    const msg = cursor.value;
    if (!msg.deleted && typeof msg.text === "string" && msg.text.toLowerCase().includes(needle)) {
      ids.push(msg.id);
    }
    cursor = await cursor.continue();
  }

  return ids;
}

export async function getLatestPinnedMessageByChat(
  chatId: string
): Promise<Message | null> {
  const db = await getDB();
  const index = db.transaction("messages").store.index("by-chat-createdAt");
  const range = IDBKeyRange.bound([chatId, 0], [chatId, Number.MAX_SAFE_INTEGER]);
  let cursor = await index.openCursor(range, "prev");

  while (cursor) {
    if (cursor.value.pinned) return cursor.value;
    cursor = await cursor.continue();
  }

  return null;
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

export async function deleteMessages(messageIds: string[]) {
  if (!messageIds.length) return;
  const db = await getDB();
  const tx = db.transaction("messages", "readwrite");
  for (const id of messageIds) {
    await tx.store.delete(id);
  }
  await tx.done;
}

export async function patchMessage(
  messageId: string,
  patch: Partial<Message>
) {
  const db = await getDB();
  const existing = await db.get("messages", messageId);
  if (!existing) return;

  const updated = {
    ...existing,
    ...patch,
    updatedAt: Date.now(),
  };

  await db.put("messages", updated);
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
