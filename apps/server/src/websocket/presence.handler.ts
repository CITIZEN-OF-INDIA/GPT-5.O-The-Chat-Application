import { Socket } from "socket.io";
import { presenceService } from "../modules/presence/presence.service";

export const registerPresenceHandlers = (socket: Socket) => {
  const userId = socket.data.userId;



  /* ───────── TYPING ───────── */
  socket.on("typing:start", ({ chatId }) => {
    presenceService.setTyping(chatId, userId);

    socket.to(chatId).emit("typing:update", {
      chatId,
      userId,
      typing: true
    });
  });



  socket.on("typing:stop", ({ chatId }) => {
    presenceService.stopTyping(chatId, userId);

    socket.to(chatId).emit("typing:update", {
      chatId,
      userId,
      typing: false
    });
  });



  /* ───────── DISCONNECT ───────── */
  socket.on("disconnect", async () => {
    presenceService.setOffline(userId);
    await presenceService.updateLastSeen(userId);

    socket.broadcast.emit("user:offline", {
      userId,
      lastSeen: new Date()
    });
  });
};
