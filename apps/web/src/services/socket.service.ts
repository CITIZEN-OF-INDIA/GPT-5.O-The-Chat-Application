// apps/web/src/services/socket.service.ts
import { io, Socket } from "socket.io-client";
import { registerPresenceListeners } from "./presence.service";

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
      if (!socket) return;

    console.log("⚡ Socket connected:", socket?.id);
    registerPresenceListeners();
    socket.emit("presence:online");

    
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

// ───────── CHAT HELPERS ─────────

export const joinChat = (chatId: string) => {
  const socket = getSocket({ requireConnected: false });
  if (!socket) return;

  if (socket.connected) {
    socket.emit("join", { chatId });
    return;
  }

  const handleConnect = () => {
    socket.emit("join", { chatId });
    socket.off("connect", handleConnect);
  };

  socket.on("connect", handleConnect);
};

// ───────── TYPING ─────────

export const emitTypingStart = (chatId: string) => {
  const socket = getSocket({ requireConnected: false });
  if (!socket || !socket.connected) return;

  socket.emit("typing:start", { chatId });
};

export const emitTypingStop = (chatId: string) => {
  const socket = getSocket({ requireConnected: false });
  if (!socket || !socket.connected) return;

  socket.emit("typing:stop", { chatId });
};


export const onTypingUpdate = (
  handler: (data: {
    chatId: string;
    userId: string;
    typing: boolean;
  }) => void
) => {
  const socket = getSocket({ requireConnected: false });
  if (!socket) return;

  socket.on("typing:update", handler);
};

export const offTypingUpdate = (
  handler: (data: {
    chatId: string;
    userId: string;
    typing: boolean;
  }) => void
) => {
  const socket = getSocket({ requireConnected: false });
  if (!socket) return;

  socket.off("typing:update", handler);
};


