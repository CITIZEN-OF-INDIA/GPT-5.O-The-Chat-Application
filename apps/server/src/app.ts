import { requireAuth } from './modules/auth'
import { authRoutes } from './modules/auth'
import express from 'express'
import http from 'http'
import chatRoutes from "./modules/chats";
import messageRoutes from "./modules/messages";
import usersRoutes from "./modules/users";
import { env } from "./config/env";

export function createApp() {
  const app = express()

  const allowedOrigins = new Set([
    env.CLIENT_URL.replace(/\/+$/, ""),
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "ionic://localhost",
  ]);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (!origin || origin === "null" || allowedOrigins.has(origin)) {
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      }
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
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
