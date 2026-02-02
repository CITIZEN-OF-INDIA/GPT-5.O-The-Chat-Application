import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  text: string;
  clientId: string;
  // Stored delivery state (NOT queued)
  status: 'sent' | 'read';

  createdAt: Date;
}

const MessageSchema: Schema<IMessage> = new Schema({
  chatId: {
    type: Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true,
  },

  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  clientId: {
  type: String,
  required: true,
  index: true,
},


  // TEXT message only (Phase 5)
  text: {
    type: String,
    required: true,
  },

  // Delivery status (starts at SENT)
  status: {
    type: String,
    enum: ['sent', 'read'],
    default: 'sent',
    index: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Fast chat message lookup
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index(
  { chatId: 1, senderId: 1, clientId: 1 },
  { unique: true }
);


export const Message = mongoose.model<IMessage>('Message', MessageSchema);

// Helper — SAFE, unchanged behavior
export const saveMessageToDB = async (data: {
  chatId: string;
  senderId: string;
  text: string;
  clientId: string;
}) => {
  try {
    const message = new Message({
      ...data,
      status: 'sent',
    });

    return await message.save();
  } catch (err: any) {
    // Duplicate message → fetch existing
    if (err.code === 11000) {
      return await Message.findOne({
        chatId: data.chatId,
        senderId: data.senderId,
        clientId: data.clientId,
      });
    }
    throw err;
  }
};

