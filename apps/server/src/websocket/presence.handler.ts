import { Socket } from "socket.io";
import { presenceService } from "../modules/presence/presence.service";

export const registerPresenceHandlers = (socket: Socket) => {
  const userId = socket.data.userId;

  // join/leave chat rooms (needed for typing updates)
  socket.on("join", ({ chatId }) => {
    if (!chatId) return;
    socket.join(chatId);
  });

  socket.on("leave", ({ chatId }) => {
    if (!chatId) return;
    socket.leave(chatId);
  });

  /* TYPING */
  socket.on("typing:start", ({ chatId }) => {
    presenceService.setTyping(chatId, userId);

    socket.to(chatId).emit("typing:update", {
      chatId,
      userId,
      typing: true,
    });
  });

  socket.on("typing:stop", ({ chatId }) => {
    presenceService.stopTyping(chatId, userId);

    socket.to(chatId).emit("typing:update", {
      chatId,
      userId,
      typing: false,
    });
  });
};
