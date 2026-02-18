import { io, Socket } from "socket.io-client";
import { registerPresenceListeners, resetPresenceListeners } from "./presence.service";
import { resolveSocketUrl } from "../utils/network";

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket) {
    socket.auth = { token };
    registerPresenceListeners();
    if (!socket.connected) {
      socket.connect();
    }
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
  if (!s) return () => {};

  const emitJoin = () => {
    s.emit("join", { chatId });
  };

  if (s.connected) {
    emitJoin();
  }

  s.on("connect", emitJoin);

  return () => {
    s.off("connect", emitJoin);
    if (s.connected) {
      s.emit("leave", { chatId });
    }
  };
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
