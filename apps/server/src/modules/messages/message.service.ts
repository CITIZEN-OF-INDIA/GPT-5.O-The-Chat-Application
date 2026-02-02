import { Message, saveMessageToDB } from '../../db/models/Message.model';



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
    // Fetch messages from DB
    const messages = await Message.find({
      chatId,
      createdAt: { $gt: since },
    }).sort({ createdAt: 1 }); // chronological

    return messages;
  }
}
