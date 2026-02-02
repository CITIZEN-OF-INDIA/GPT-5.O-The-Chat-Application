import { OnlineUser } from "./presence.types";
import { User } from "../../db/models/User.model";

class PresenceService {
  private onlineUsers = new Map<string, string>();
  private typingUsers = new Map<string, Set<string>>();

  /* ───────── ONLINE ───────── */

  setOnline(userId: string, socketId: string) {
    this.onlineUsers.set(userId, socketId);
  }

  setOffline(userId: string) {
    this.onlineUsers.delete(userId);
  }

  isOnline(userId: string) {
    return this.onlineUsers.has(userId);
  }

  getSocketId(userId: string) {
    return this.onlineUsers.get(userId);
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  /* ───────── LAST SEEN ───────── */

  async updateLastSeen(userId: string) {
    await User.findByIdAndUpdate(userId, {
      lastSeen: new Date()
    });
  }

  /* ───────── TYPING ───────── */

  setTyping(chatId: string, userId: string) {
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }
    this.typingUsers.get(chatId)!.add(userId);
  }

  stopTyping(chatId: string, userId: string) {
    this.typingUsers.get(chatId)?.delete(userId);
  }

  getTypingUsers(chatId: string) {
    return Array.from(this.typingUsers.get(chatId) || []);
  }
}

export const presenceService = new PresenceService();
