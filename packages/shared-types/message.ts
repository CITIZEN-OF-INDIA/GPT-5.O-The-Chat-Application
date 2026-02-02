import type { ChatID } from "./chat";
import type { Media } from "./media";
import type { UserID } from "./user";


export type MessageID = string;

export enum MessageStatus {
  QUEUED = "queued",       // ⏳
  SENT = "sent",           // ✓
  READ = "read",           // ✓✓ blue
  SENDING = "sending",     // 🔄
}

export enum MessageType {
  TEXT = "text",
  MEDIA = "media",
  SYSTEM = "system",
}

export interface Message {
  id: MessageID;
  chatId: ChatID;

  senderId: UserID;

  type: MessageType;

  clientId?: string; // temporary ID assigned by client
  text?: string;
  media?: Media;

  replyTo?: MessageID;

  status: MessageStatus;

  edited?: boolean;
  pinned?: boolean;
  deleted?: boolean;

  createdAt: number;
  updatedAt?: number;
}
