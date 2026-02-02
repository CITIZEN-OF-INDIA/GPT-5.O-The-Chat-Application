import { Request, Response } from "express";
import { MessageService } from "./message.service";
import { Chat } from "../../db/models/Chat.model";

/**
 * Sends a message
 * Auto-creates chat if chatId is not provided
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const senderId = (req as any).userId;
    const { chatId, receiverId, text, clientId } = req.body;

if (!clientId) {
  return res.status(400).json({ error: "clientId is required" });
}

    if (!text) {
      return res.status(400).json({ error: "Message text required" });
    }

    let finalChatId = chatId;

    // 🔹 AUTO-CREATE CHAT
    if (!finalChatId) {
      if (!receiverId) {
        return res
          .status(400)
          .json({ error: "receiverId required to create chat" });
      }

      const existingChat = await Chat.findOne({
        participants: { $all: [senderId, receiverId] }
      });

      if (existingChat) {
        finalChatId = existingChat._id.toString();
      } else {
        const newChat = await Chat.create({
          participants: [senderId, receiverId]
        });
        finalChatId = newChat._id.toString();
      }
    }

    const message = await MessageService.sendTextMessage(
      finalChatId,
      senderId,
      text,
      req.body.clientId
    );

    res.status(201).json(message);
  } catch (err) {
    console.error("Message send failed:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
}

/**
 * GET /api/messages?chatId=<id>&since=<timestamp>
 * Fetch messages for a chat
 */
export async function getMessages(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const chatId = req.query.chatId as string;
    const since = Number(req.query.since ?? 0);

    if (!chatId) {
      return res.status(400).json({ error: "chatId query parameter required" });
    }

    // Ensure user is a participant in this chat
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(userId)) {
      return res.status(403).json({ error: "Not authorized for this chat" });
    }

    // Fetch messages from MessageService
    const messages = await MessageService.getMessages(chatId, since);

    res.status(200).json(messages);
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}
