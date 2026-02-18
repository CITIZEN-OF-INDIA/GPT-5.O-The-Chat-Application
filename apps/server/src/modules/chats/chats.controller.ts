import { Request, Response } from "express";
import { Types } from "mongoose";
import { ChatsService } from "./chats.service";
import { User } from "../../db/models/User.model";

export class ChatsController {
  private static escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * POST /api/chats
   */
  static async createChat(req: Request, res: Response) {
    const { participants } = req.body;

    const chat = await ChatsService.createChat(participants);
    res.status(201).json(chat);
  }

  /**
   * GET /api/chats
   */
  static async getMyChats(req: Request, res: Response) {
  const userId = (req as any).userId;

  // 🛑 CRITICAL GUARD
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const chats = await ChatsService.getUserChats(userId);

  // 🛑 SAFETY VALIDATION (prevents wrong payloads)
  if (!Array.isArray(chats)) {
    return res.status(500).json({ message: "Invalid chat data" });
  }

  res.json(chats);
}


  /**
   * POST /api/chats/direct
   * Create or open 1-to-1 chat by username
   */
  static async directChat(req: Request, res: Response) {
  try {
    const myUserId = (req as any).userId;
    const username = String(req.body?.username ?? "").trim();

    if (!username) {
      return res.status(400).json({ message: "Username required" });
    }

    const otherUser = await User.findOne({
      username: {
        $regex: `^${ChatsController.escapeRegex(username)}$`,
        $options: "i",
      },
    }).select("_id username");

    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (otherUser._id.toString() === myUserId) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    const chat = await ChatsService.createChat([
      myUserId,
      otherUser._id.toString(),
    ]);

    res.json(chat);
  } catch (err) {
    console.error("directChat error:", err);
    return res.status(503).json({
      message: "Service unavailable",
    });
  }
}

}
