import { Router } from "express";
import { requireAuth } from "../auth";
import {
  sendMessage,
  getMessages,
  editMessage,
  pinMessage,
  deleteMessagesForMe,
  deleteMessagesForEveryone,
} from "./message.controller";

const router = Router();

/**
 * POST /api/messages
 */
router.post("/", requireAuth, sendMessage);

/**
 * GET /api/messages?chatId=<id>&since=<timestamp>
 */
router.get("/", requireAuth, getMessages); // ✅ add this

router.patch("/:id/edit", requireAuth, editMessage);
router.patch("/:id/pin", requireAuth, pinMessage);
router.post("/delete-for-me", requireAuth, deleteMessagesForMe);
router.post("/delete-for-everyone", requireAuth, deleteMessagesForEveryone);

export default router;
