// apps/web/src/services/socket.service.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket && socket.connected) {
    console.log("♻️ Reusing existing socket:", socket.id);
    return socket;
  }

  console.log("🔌 Creating new socket connection");

  socket = io(import.meta.env.VITE_WS_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
  });

  socket.on("connect", () => {
    console.log("⚡ Socket connected:", socket?.id);
    
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket disconnected:", reason);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    console.log("🚪 Manually disconnecting socket");
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (options?: { requireConnected?: boolean }) => {
  if (!socket) {
    console.warn("⚠️ Socket not ready yet");
    return null;
  }

  const requireConnected = options?.requireConnected ?? true;
  if (requireConnected && !socket.connected) {
    console.warn("⚠️ Socket not connected yet");
    return null;
  }

  return socket;
};

