import { requireAuth } from './modules/auth'
import { authRoutes } from './modules/auth'
import express from 'express'
import http from 'http'
import chatRoutes from "./modules/chats";
import messageRoutes from "./modules/messages";
import usersRoutes from "./modules/users";
import { env } from './config/env';

export function createApp() {
  const app = express()

  const allowedOrigins = new Set([
    env.CLIENT_URL.replace(/\/+$/, ""),
    "capacitor://localhost",
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:3000",
    "null",
  ]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (typeof origin === "string" && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Cache-Control, Pragma"
      );
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  });

  app.use(express.json())

  app.use("/api/chats", chatRoutes);
  app.use("/api/messages", messageRoutes); // ✅ ADD




app.use("/users", usersRoutes);

  app.get('/health', (_, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/auth', authRoutes);

    

  const server = http.createServer(app)

  return { app, server }
}

export default createApp
