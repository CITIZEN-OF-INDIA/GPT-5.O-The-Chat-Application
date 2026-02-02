import { Router } from "express";
import { ChatsController } from "./chats.controller";
import { requireAuth } from "../auth/auth.middleware";

const router = Router();

router.post("/", requireAuth, ChatsController.createChat);
router.get("/", requireAuth, ChatsController.getMyChats);
// ADD THIS ROUTE (do NOT touch existing ones)
router.post("/direct", requireAuth, ChatsController.directChat);


export default router;
