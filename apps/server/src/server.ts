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

// 1️⃣ Create Express + HTTP server
const { server } = createApp();

// 2️⃣ Connect MongoDB (GLOBAL)
connectDB();

// 3️⃣ Initialize Socket.IO
export const io = new SocketIOServer(server as HttpServer, {
  cors: {
    origin: [env.CLIENT_URL, "null"],
    credentials: true,
  },
});


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
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);
    console.log("   userId    =", socket.data.userId);

    socket.join(socket.data.userId);

    console.log(
    "🏠 JOINED ROOMS:",
    Array.from(socket.rooms)
  );

  /**
   * IMPORTANT:
   * socket.data.userId MUST be set by auth middleware
   * (JWT handshake / auth phase)
   */

  // Presence (online / typing / last seen)
  registerPresenceHandlers(socket);

  // Messages
  handleMessage(socket);

  // Receipts (delivered / seen)
  handleReceipts(socket);

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// 5️⃣ Start HTTP + Socket server
server.listen(env.PORT, () => {
  console.log(`🚀 ${APP_NAME} running on port ${env.PORT}`);
});
