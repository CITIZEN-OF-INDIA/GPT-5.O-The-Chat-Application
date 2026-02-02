import type { ChatDB } from "../db/indexedDB";
import {
  type Message,
  MessageType,
  MessageStatus,
} from "../../../../packages/shared-types/message";

export function normalizeChat(raw: any): ChatDB {
  // Normalize last message
  const lastMsg: Message | undefined = raw.lastMessage
    ? {
        id: String(raw.lastMessage._id ?? raw.lastMessage.id),
        chatId: String(raw._id ?? raw.id),
        senderId: String(
          raw.lastMessage.senderId ?? raw.lastMessage.sender ?? "unknown"
        ),
        text: raw.lastMessage.text ?? "",
        type: raw.lastMessage.type ?? MessageType.TEXT,
        status: raw.lastMessage.status ?? MessageStatus.SENT,
        createdAt: raw.lastMessage.createdAt
          ? new Date(raw.lastMessage.createdAt).getTime()
          : Date.now(),
      }
    : undefined;

  // Determine updatedAt
  let updatedAt = Date.now();
  if (raw.updatedAt) updatedAt = new Date(raw.updatedAt).getTime();
  else if (lastMsg?.createdAt) updatedAt = lastMsg.createdAt;

  return {
    id: String(raw._id ?? raw.id),

    // 🔑 FIX: ALWAYS normalize participants into objects
    participants: (raw.participants ?? []).map((p: any) => {
      if (typeof p === "object" && p !== null) {
        return {
          id: String(p._id ?? p.id),
          username: p.username ?? "Unknown",
        };
      }

      // fallback if stored as string (old cache / bad data)
      return {
        id: String(p),
        username: "Unknown",
      };
    }),

    lastMessage: lastMsg,
    updatedAt,
  };
}
