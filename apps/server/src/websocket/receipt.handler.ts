// receipt.handler.ts
import { io } from "../server";
import { Socket } from "socket.io";
import { Message } from "../db/models/Message.model";

export const handleReceipts = (socket: Socket) => {
  const userId = socket.data.userId;

  // join personal room
  socket.join(userId);

  // ✅ DELIVERED
  socket.on("message:delivered", async ({ messageId }) => {
    const message = await Message.findById(messageId);
    if (!message) {
   
    return;
  }

    if (!message || message.status !== "sent") return;

    
    await message.save();

    
  
    io.to(message.senderId.toString()).emit("message:status", {
      messageId,
      status: "delivered",
    });
  });

  // ✅ READ
  socket.on("message:read", async ({ messageId }) => {
    const message = await Message.findById(messageId);
    if (!message || message.status === "read") return;

    message.status = "read";
    await message.save();

    io.to(message.senderId.toString()).emit("message:status", {
      messageId,
      status: "read",
    });
  });
};
