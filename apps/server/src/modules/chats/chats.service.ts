import { Types } from "mongoose";
import { Chat } from "../../db/models/Chat.model";

export class ChatsService {
  // chats.service.ts
static async createChat(userIds: string[]) {
  const participants = userIds.map((id) => new Types.ObjectId(id));

  // check if chat already exists
  let existingChat = await Chat.findOne({
    participants: { $all: participants, $size: participants.length },
  }).populate("participants", "_id username"); // ✅ populate usernames

  if (existingChat) return existingChat;

  const chat = await Chat.create({ participants });
  return await chat.populate("participants", "_id username");
}

static async getUserChats(userId: string) {
  return Chat.find({
    participants: new Types.ObjectId(userId),
  })
    .populate("participants", "_id username") // ✅ populate usernames
    .populate("lastMessage")
    .sort({ updatedAt: -1 });
}


  static async updateLastMessage(chatId: string, messageId: string) {
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: new Types.ObjectId(messageId),
    });
  }
}
