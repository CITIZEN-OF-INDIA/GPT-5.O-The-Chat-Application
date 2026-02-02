import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId | null; // 🔹 added
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema: Schema<IChat> = new Schema(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: 'User', required: true }
    ],

    // 🔹 added for Phase 6.1
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    // 🔹 ensures updatedAt auto-changes when lastMessage updates
    timestamps: true
  }
);

// Existing index kept + still valid
ChatSchema.index({ participants: 1, updatedAt: -1 });

export const Chat = mongoose.model<IChat>('Chat', ChatSchema);
