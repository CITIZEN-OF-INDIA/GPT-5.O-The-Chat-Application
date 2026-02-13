import {
  type Message,
  MessageType,
  MessageStatus,
} from "../../../../packages/shared-types/message";

/**
 * Normalize raw message from server / socket / cache
 * into strict Message type used everywhere
 */
export function normalizeMessage(raw: any): Message {
  

  // 🔑 ID is NON-NEGOTIABLE (IndexedDB keyPath)
  const id = raw.id ?? raw._id;

  if (!id) {
    console.error("❌ normalizeMessage: MISSING id", raw);
  }

  const message: Message = {
    id: String(id),

    chatId: String(raw.chatId ?? raw.chat?._id ?? raw.chat),

    senderId: String(raw.senderId ?? raw.sender?._id ?? raw.sender),

    type: raw.type ?? MessageType.TEXT,

    status: raw.status ?? MessageStatus.SENT,

    createdAt: raw.createdAt
      ? new Date(raw.createdAt).getTime()
      : Date.now(),

    updatedAt: raw.updatedAt
      ? new Date(raw.updatedAt).getTime()
      : undefined,
  };

  // Optional fields (ONLY if present)
if (raw.text !== undefined) {
  message.text = String(raw.text);
}
 
if (raw.media !== undefined) message.media = raw.media;
if (raw.replyTo !== undefined && raw.replyTo !== null) {
  const replyId =
    typeof raw.replyTo === "object"
      ? raw.replyTo.id ?? raw.replyTo._id
      : raw.replyTo;
  if (replyId !== undefined && replyId !== null) {
    message.replyTo = String(replyId);
  }
}
if (raw.clientId !== undefined) {
  message.clientId = String(raw.clientId);
}


  if (raw.edited !== undefined) message.edited = raw.edited;
  if (raw.pinned !== undefined) message.pinned = raw.pinned;
  if (raw.deleted !== undefined) message.deleted = raw.deleted;
if (message.type === MessageType.TEXT && message.text === undefined) {
  console.error("❌ TEXT MESSAGE WITHOUT CONTENT FROM BACKEND", raw);
}

  return message;
}
