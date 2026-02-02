import type { MessageID } from "./message";
import type { UserID } from "./user";


export type ChatID = string;

export interface Chat {
  id: ChatID;

  participants: UserID[];

  lastMessageId?: MessageID;
  lastMessagePreview?: string;
  lastMessageAt?: number;

  unreadCount: number;

  pinned?: boolean;
  wallpaperUrl?: string;

  createdAt: number;
  updatedAt: number;
}
