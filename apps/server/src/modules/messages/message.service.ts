import { Types } from "mongoose";
import { Message, saveMessageToDB } from "../../db/models/Message.model";
import { MessageSync } from "../../db/models/MessageSync.model";



export class MessageService {
  /**
   * Send a text message
   */
  static async sendTextMessage(
    chatId: string,
    senderId: string,
    text: string,
    clientId: string
  ) {
    const message = await saveMessageToDB({
  chatId,
  senderId,
  text: text,
  clientId,
});

    return message;
  }

  /**
   * Fetch messages for a chat since a given timestamp
   * - Used for server sync / offline-first
   */
  static async getMessages(
    chatId: string,
    since = 0
  ) {
    // Mongo stores createdAt as Date; compare using Date to avoid type-ordering bugs
    const sinceDate = new Date(since);

    // Fetch messages from DB
    const messages = await Message.find({
      chatId,
      createdAt: { $gt: sinceDate },
    }).sort({ createdAt: 1 }); // chronological

    return messages;
  }

  /**
   * Fetch last synced timestamp (server-side cursor)
   */
  static async getLastSyncedAt(userId: string, chatId: string) {
    const record = await MessageSync.findOne({
      userId: new Types.ObjectId(userId),
      chatId: new Types.ObjectId(chatId),
    });

    return record?.lastSyncedAt ?? null;
  }

  /**
   * Update last synced timestamp (server-side cursor)
   */
  static async setLastSyncedAt(
    userId: string,
    chatId: string,
    lastSyncedAt: Date
  ) {
    await MessageSync.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        chatId: new Types.ObjectId(chatId),
      },
      { $set: { lastSyncedAt } },
      { upsert: true, new: true }
    );
  }
}
