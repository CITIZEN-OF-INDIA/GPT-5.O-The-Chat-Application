import { io } from "../server";
import { Socket } from "socket.io";
import { saveMessageToDB } from "../db/models/Message.model";
import { MessageStatus } from "../../../../packages/shared-types/message";

export const handleMessage = (socket: Socket) => {
  const senderId = socket.data.userId;

  if (!senderId) {
    console.error("Socket missing userId");
    return;
  }

  socket.join(senderId);

  socket.on(
    "message:send",
    async (
      data: {
        chatId: string;
        receiverId: string;
        text: string;
        clientId: string;
        replyTo?: string;
      },
      ack?: (res: { ok: boolean; message?: any }) => void
    ) => {
      const { chatId, receiverId, text, clientId, replyTo } = data;

      if (!text || !clientId) {
        ack?.({ ok: false });
        return;
      }

      try {
        const messageDoc = await saveMessageToDB({
          chatId,
          senderId,
          text,
          clientId,
          replyTo,
        });

        if (!messageDoc) {
          throw new Error("Message dedupe returned null");
        }

        const message = {
          id: messageDoc._id.toString(),
          chatId: messageDoc.chatId.toString(),
          senderId: messageDoc.senderId.toString(),
          text: messageDoc.text,
          clientId: messageDoc.clientId,
          replyTo: messageDoc.replyTo?.toString(),
          edited: Boolean(messageDoc.edited),
          pinned: Boolean(messageDoc.pinned),
          status: MessageStatus.SENT,
          createdAt: messageDoc.createdAt.getTime(),
          updatedAt: messageDoc.updatedAt?.getTime?.(),
        };

        ack?.({ ok: true, message });
        io.to(senderId).emit("message:new", message);

        if (io.sockets.adapter.rooms.has(receiverId)) {
          io.to(receiverId).emit("message:new", message);
        }
      } catch (err) {
        console.error("Failed to handle message:", err);
        ack?.({ ok: false });
      }
    }
  );
};
