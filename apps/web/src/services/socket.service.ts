import { io, Socket } from "socket.io-client";
import { registerPresenceListeners, resetPresenceListeners } from "./presence.service";
import { resolveSocketUrl } from "../utils/network";

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(resolveSocketUrl(), {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
  });

  socket.on("connect", () => {
    if (!socket) return;
    registerPresenceListeners();
    socket.emit("presence:online");
  });

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  resetPresenceListeners();
  socket.disconnect();
  socket = null;
};

export const getSocket = (options?: { requireConnected?: boolean }) => {
  if (!socket) return null;

  const requireConnected = options?.requireConnected ?? true;
  if (requireConnected && !socket.connected) return null;

  return socket;
};

export const joinChat = (chatId: string) => {
  const s = getSocket({ requireConnected: false });
  if (!s) return;

  if (s.connected) {
    s.emit("join", { chatId });
    return;
  }

  const handleConnect = () => {
    s.emit("join", { chatId });
    s.off("connect", handleConnect);
  };

  s.on("connect", handleConnect);
};

export const emitTypingStart = (chatId: string) => {
  const s = getSocket({ requireConnected: false });
  if (!s || !s.connected) return;
  s.emit("typing:start", { chatId });
};

export const emitTypingStop = (chatId: string) => {
  const s = getSocket({ requireConnected: false });
  if (!s || !s.connected) return;
  s.emit("typing:stop", { chatId });
};

export const onTypingUpdate = (
  handler: (data: {
    chatId: string;
    userId: string;
    typing: boolean;
  }) => void
) => {
  const s = getSocket({ requireConnected: false });
  if (!s) return;
  s.on("typing:update", handler);
};

export const offTypingUpdate = (
  handler: (data: {
    chatId: string;
    userId: string;
    typing: boolean;
  }) => void
) => {
  const s = getSocket({ requireConnected: false });
  if (!s) return;
  s.off("typing:update", handler);
};
