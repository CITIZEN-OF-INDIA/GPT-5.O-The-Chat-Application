import { Router } from "express";
import { UsersController } from "./users.controller";
import { requireAuth } from "../auth/auth.middleware";

const router = Router();

router.get("/search", requireAuth, UsersController.search);

export default router;
