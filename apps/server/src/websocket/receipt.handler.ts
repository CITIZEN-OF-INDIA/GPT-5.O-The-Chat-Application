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
    console.log("✅ DELIVERED EVENT");
  console.log("   by user:", userId);
  console.log("   message:", messageId);
    const message = await Message.findById(messageId);
    if (!message) {
    console.log("❌ Message not found");
    return;
  }
    console.log("📌 Current status:", message.status);

    if (!message || message.status !== "sent") return;

    message.status = "delivered";
    await message.save();

    console.log(
    "📤 EMIT STATUS → sender",
    message.senderId.toString()
  );
  
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
