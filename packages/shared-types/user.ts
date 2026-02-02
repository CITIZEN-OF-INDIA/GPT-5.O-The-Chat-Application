export type UserID = string;

export interface User {
  id: UserID;
  username: string;
  displayName?: string;
  avatarUrl?: string;

  online: boolean;
  lastSeen: number; // unix timestamp

  createdAt: number;
}

export interface UserPresence {
  userId: UserID;
  online: boolean;
  lastSeen: number;
  typingInChatId?: string;
}
