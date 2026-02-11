import { Request, Response } from "express";
import { MessageService } from "./message.service";
import { Chat } from "../../db/models/Chat.model";
import { io } from "../../server";

async function emitToChatParticipants(chatId: string, event: string, payload: any) {
  const chat = await Chat.findById(chatId).select("participants");
  if (!chat) return;

  chat.participants.forEach((participantId) => {
    io.to(participantId.toString()).emit(event, payload);
  });
}

/**
 * Sends a message
 * Auto-creates chat if chatId is not provided
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const senderId = (req as any).userId;
    const { chatId, receiverId, text, clientId, replyTo } = req.body;

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
      req.body.clientId,
      replyTo
    );

    res.status(201).json(MessageService.mapMessage(message));
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
    let since = Number(req.query.since ?? 0);
    if (!Number.isFinite(since)) since = 0;

    if (!chatId) {
      return res.status(400).json({ error: "chatId query parameter required" });
    }

    // Ensure user is a participant in this chat
    const chat = await Chat.findById(chatId);
    const isParticipant = chat?.participants.some(
      (p) => p.toString() === userId
    );
    if (!chat || !isParticipant) {
      return res.status(403).json({ error: "Not authorized for this chat" });
    }

    // If client has no cursor, fall back to server-side cursor
    let effectiveSince = since;
    if (effectiveSince <= 0) {
      const serverLast = await MessageService.getLastSyncedAt(
        userId,
        chatId
      );
      if (serverLast) {
        effectiveSince = serverLast.getTime();
      }
    }

    // Fetch messages from MessageService
    const messages = await MessageService.getMessages(
      chatId,
      effectiveSince,
      userId
    );

    // Update server-side cursor on successful sync (use updatedAt for edit/pin changes)
    if (messages.length > 0) {
      const newest = messages.reduce((max, m) => {
        const candidate = m.updatedAt ?? m.createdAt;
        const ts = candidate instanceof Date ? candidate.getTime() : 0;
        return ts > max ? ts : max;
      }, 0);
      if (newest > 0) {
        await MessageService.setLastSyncedAt(
          userId,
          chatId,
          new Date(newest)
        );
      }
    } else if (effectiveSince > 0) {
      await MessageService.setLastSyncedAt(
        userId,
        chatId,
        new Date(effectiveSince)
      );
    }

    console.log("getMessages", {
      chatId,
      since,
      effectiveSince,
      count: messages.length,
    });


    res.status(200).json(messages.map((m) => MessageService.mapMessage(m)));
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

export async function editMessage(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const messageId = req.params.id;
    const text = String(req.body?.text ?? "").trim();

    if (!text) {
      return res.status(400).json({ error: "Message text required" });
    }

    const updated = await MessageService.editMessage(messageId, userId, text);
    if (!updated) {
      return res.status(404).json({ error: "Message not found or not editable" });
    }

    const mapped = MessageService.mapMessage(updated);
    await emitToChatParticipants(mapped.chatId, "message:updated", mapped);

    return res.status(200).json(mapped);
  } catch (err) {
    console.error("editMessage failed:", err);
    return res.status(500).json({ error: "Failed to edit message" });
  }
}

export async function pinMessage(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const messageId = req.params.id;
    const pinned = Boolean(req.body?.pinned);

    const updated = await MessageService.pinMessage(messageId, userId, pinned);
    if (!updated) {
      return res.status(404).json({ error: "Message not found or unauthorized" });
    }

    const mapped = MessageService.mapMessage(updated);
    await emitToChatParticipants(mapped.chatId, "message:updated", mapped);

    return res.status(200).json(mapped);
  } catch (err) {
    console.error("pinMessage failed:", err);
    return res.status(500).json({ error: "Failed to pin/unpin message" });
  }
}

export async function deleteMessagesForMe(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const messageIds = Array.isArray(req.body?.messageIds)
      ? req.body.messageIds.map(String)
      : [];

    if (!messageIds.length) {
      return res.status(400).json({ error: "messageIds required" });
    }

    const deletedMessageIds = await MessageService.deleteForMe(messageIds, userId);

    return res.status(200).json({ deletedMessageIds });
  } catch (err) {
    console.error("deleteMessagesForMe failed:", err);
    return res.status(500).json({ error: "Failed to delete messages for me" });
  }
}

export async function deleteMessagesForEveryone(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const messageIds = Array.isArray(req.body?.messageIds)
      ? req.body.messageIds.map(String)
      : [];

    if (!messageIds.length) {
      return res.status(400).json({ error: "messageIds required" });
    }

    const { deletedMessageIds, deletedByChat } =
      await MessageService.deleteForEveryone(messageIds, userId);

    for (const [chatId, ids] of Object.entries(deletedByChat)) {
      await emitToChatParticipants(chatId, "message:deleted", {
        chatId,
        messageIds: ids,
      });
    }

    return res.status(200).json({ deletedMessageIds });
  } catch (err) {
    console.error("deleteMessagesForEveryone failed:", err);
    return res.status(500).json({ error: "Failed to delete messages for everyone" });
  }
}
