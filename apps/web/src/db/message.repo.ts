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
 * Get queued messages
 */
export async function getQueuedMessages(): Promise<Message[]> {
  const db = await getDB();
  const index = db.transaction("messages").store.index("by-status");
  return index.getAll("queued");
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
