import type { Socket } from "socket.io-client";
import { usePresenceStore } from "../store/presence.store";
import { getSocket } from "./socket.service";

let boundSocket: Socket | null = null;

const onSnapshot = (users: Array<{ userId: string; online: boolean; lastSeen?: string }>) => {
  usePresenceStore.getState().hydrate(users);
};

const onUserOnline = ({ userId }: { userId: string }) => {
  usePresenceStore.getState().setOnline(userId);
};

const onUserOffline = ({ userId, lastSeen }: { userId: string; lastSeen?: string }) => {
  usePresenceStore.getState().setOffline(userId, lastSeen);
};

const unbindPresenceListeners = (socket: Socket) => {
  socket.off("presence:snapshot", onSnapshot);
  socket.off("user:online", onUserOnline);
  socket.off("user:offline", onUserOffline);
};

export const registerPresenceListeners = () => {
  const socket = getSocket();
  if (!socket) return;

  if (boundSocket && boundSocket !== socket) {
    unbindPresenceListeners(boundSocket);
  }

  unbindPresenceListeners(socket);
  socket.on("presence:snapshot", onSnapshot);
  socket.on("user:online", onUserOnline);
  socket.on("user:offline", onUserOffline);

  boundSocket = socket;
};

export const resetPresenceListeners = () => {
  if (boundSocket) {
    unbindPresenceListeners(boundSocket);
    boundSocket = null;
  }
};
