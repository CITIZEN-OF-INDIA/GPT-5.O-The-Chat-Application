import { Router } from "express";
import { requireAuth } from "../auth";
import { sendMessage, getMessages } from "./message.controller";

const router = Router();

/**
 * POST /api/messages
 */
router.post("/", requireAuth, sendMessage);

/**
 * GET /api/messages?chatId=<id>&since=<timestamp>
 */
router.get("/", requireAuth, getMessages); // ✅ add this

export default router;
