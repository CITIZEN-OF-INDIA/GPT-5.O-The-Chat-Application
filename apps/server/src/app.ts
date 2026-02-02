import { requireAuth } from './modules/auth'
import { authRoutes } from './modules/auth'
import express from 'express'
import http from 'http'
import chatRoutes from "./modules/chats";
import messageRoutes from "./modules/messages";
import usersRoutes from "./modules/users";

export function createApp() {
  const app = express()

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
