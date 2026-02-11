import { Types } from "mongoose";
import { Message, saveMessageToDB } from "../../db/models/Message.model";
import { MessageSync } from "../../db/models/MessageSync.model";
import { Chat } from "../../db/models/Chat.model";



export class MessageService {
  private static toClientMessage(doc: any) {
    return {
      id: doc._id.toString(),
      chatId: doc.chatId.toString(),
      senderId: doc.senderId.toString(),
      text: doc.text,
      clientId: doc.clientId,
      replyTo: doc.replyTo ? doc.replyTo.toString() : undefined,
      edited: Boolean(doc.edited),
      pinned: Boolean(doc.pinned),
      status: doc.status,
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.getTime()
          : new Date(doc.createdAt).getTime(),
      updatedAt: doc.updatedAt
        ? doc.updatedAt instanceof Date
          ? doc.updatedAt.getTime()
          : new Date(doc.updatedAt).getTime()
        : undefined,
    };
  }

  /**
   * Send a text message
   */
  static async sendTextMessage(
    chatId: string,
    senderId: string,
    text: string,
    clientId: string,
    replyTo?: string
  ) {
    const message = await saveMessageToDB({
  chatId,
  senderId,
  text: text,
  clientId,
  replyTo,
});

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: message?._id ?? null,
      updatedAt: new Date(),
    });

    return message;
  }

  /**
   * Fetch messages for a chat since a given timestamp
   * - Used for server sync / offline-first
   */
  static async getMessages(
    chatId: string,
    since = 0,
    userId?: string
  ) {
    // Sync includes new + edited/pinned records, so we compare against updatedAt.
    const sinceDate = new Date(since);
    const userObjectId = userId ? new Types.ObjectId(userId) : null;

    const messages = await Message.find({
      chatId,
      $or: [{ createdAt: { $gt: sinceDate } }, { updatedAt: { $gt: sinceDate } }],
      ...(userObjectId ? { deletedFor: { $ne: userObjectId } } : {}),
    }).sort({ createdAt: 1 });

    return messages;
  }

  static async editMessage(messageId: string, userId: string, text: string) {
    const msg = await Message.findById(messageId);
    if (!msg) return null;
    if (msg.senderId.toString() !== userId) return null;

    msg.text = text;
    msg.edited = true;
    await msg.save();

    return msg;
  }

  static async pinMessage(messageId: string, userId: string, pinned: boolean) {
    const msg = await Message.findById(messageId);
    if (!msg) return null;

    const chat = await Chat.findById(msg.chatId);
    if (!chat) return null;

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId
    );
    if (!isParticipant) return null;

    if (pinned) {
      await Message.updateMany(
        { chatId: msg.chatId, pinned: true, _id: { $ne: msg._id } },
        { $set: { pinned: false, updatedAt: new Date() } }
      );
    }

    msg.pinned = pinned;
    await msg.save();
    return msg;
  }

  static async deleteForMe(messageIds: string[], userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const validObjectIds = messageIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!validObjectIds.length) return [];

    const messages = await Message.find({ _id: { $in: validObjectIds } });
    const allowedIds: Types.ObjectId[] = [];

    for (const message of messages) {
      const chat = await Chat.findById(message.chatId);
      if (!chat) continue;
      const isParticipant = chat.participants.some(
        (p) => p.toString() === userId
      );
      if (isParticipant) {
        allowedIds.push(message._id as Types.ObjectId);
      }
    }

    if (!allowedIds.length) return [];

    await Message.updateMany(
      { _id: { $in: allowedIds } },
      { $addToSet: { deletedFor: userObjectId } }
    );

    return allowedIds.map((id) => id.toString());
  }

  static async deleteForEveryone(messageIds: string[], userId: string) {
    const validObjectIds = messageIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (!validObjectIds.length) {
      return { deletedMessageIds: [], deletedByChat: {} as Record<string, string[]> };
    }

    const mine = await Message.find({
      _id: { $in: validObjectIds },
      senderId: new Types.ObjectId(userId),
    });

    if (!mine.length) {
      return { deletedMessageIds: [], deletedByChat: {} as Record<string, string[]> };
    }

    const deletedMessageIds = mine.map((m) => m._id.toString());
    const deletedByChat = mine.reduce<Record<string, string[]>>((acc, m) => {
      const chatId = m.chatId.toString();
      if (!acc[chatId]) acc[chatId] = [];
      acc[chatId].push(m._id.toString());
      return acc;
    }, {});

    await Message.deleteMany({
      _id: { $in: mine.map((m) => m._id) },
    });

    return { deletedMessageIds, deletedByChat };
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

  static mapMessage(doc: any) {
    return this.toClientMessage(doc);
  }
}
