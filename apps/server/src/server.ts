import { verifyAccessToken } from "./modules/auth/auth.tokens";
import { createApp } from "./app";
import { env } from "./config/env";
import { APP_NAME } from "./config/constants";
import { connectDB } from "./db/connect";
import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { handleMessage } from "./websocket/message.handler";
import { registerPresenceHandlers } from "./websocket/presence.handler";
import { handleReceipts } from "./websocket/receipt.handler";
import { presenceService } from "./modules/presence/presence.service";

// 1️⃣ Create Express + HTTP server
const { server } = createApp();
const allowedSocketOrigins = [
  env.CLIENT_URL.replace(/\/+$/, ""),
  "null",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
];

// 2️⃣ Connect MongoDB (GLOBAL)
connectDB();

// 3️⃣ Initialize Socket.IO
export const io = new SocketIOServer(server as HttpServer, {
  cors: {
    origin: allowedSocketOrigins,
    credentials: true,
  },
});

// 🔐 Socket authentication middleware
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const payload = verifyAccessToken(token);
    socket.data.userId = payload.sub;

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// 4️⃣ Socket lifecycle
io.on("connection", async (socket) => {
  console.log("🔌 Socket connected:", socket.id);
  console.log("   userId    =", socket.data.userId);

  const userId = socket.data.userId;

  presenceService.setOnline(userId, socket.id);

  socket.join(userId);

  // ======================================================
  // 🧠 NEW (CRITICAL): SEND PRESENCE SNAPSHOT ON CONNECT
  // ======================================================
  // This fixes:
  // - server restart
  // - fresh login
  // - "other user never came online" problem
  // - missing lastSeen after crash
  // ======================================================
  try {
    const snapshot = await presenceService.getPresenceSnapshot(userId);

    // 🔁 Send snapshot ONLY to this socket
    socket.emit("presence:snapshot", snapshot);
      socket.broadcast.emit("user:online", { userId });

  } catch (err) {
    console.error("❌ Failed to send presence snapshot", err);
  }

  // ======================================================
  // 🟢 FRONTEND EXPLICITLY SAYS: "I AM ONLINE"
  // ======================================================
  socket.on("presence:online", () => {
    console.log("🟢 presence:online from", userId);

    presenceService.setOnline(userId, socket.id);

    // broadcast to everyone else
    socket.broadcast.emit("user:online", { userId });
  });

  // ======================================================
  // 🔴 FRONTEND EXPLICITLY SAYS: "I AM OFFLINE"
  // (used on logout)
  // ======================================================
  socket.on("presence:offline", async () => {
    console.log("🔴 presence:offline from", userId);

    presenceService.setOffline(userId);
    await presenceService.updateLastSeen(userId);

    socket.broadcast.emit("user:offline", {
      userId,
      lastSeen: new Date(),
    });
  });

  // register handlers
  registerPresenceHandlers(socket);
  handleMessage(socket);
  handleReceipts(socket);

  // ======================================================
  // ❌ SOCKET DISCONNECT (TAB CLOSE / REFRESH / NETWORK)
  // ======================================================
  socket.on("disconnect", async () => {
    console.log("❌ Socket disconnected:", socket.id);

    presenceService.setOffline(userId);
    await presenceService.updateLastSeen(userId);

    socket.broadcast.emit("user:offline", {
      userId,
      lastSeen: new Date(),
    });
  });
});

// 5️⃣ Start HTTP + Socket server
server.listen(env.PORT, () => {
  console.log(`🚀 ${APP_NAME} running on port ${env.PORT}`);
});
