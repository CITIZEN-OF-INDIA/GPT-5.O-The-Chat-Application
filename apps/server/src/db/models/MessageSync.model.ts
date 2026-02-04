import mongoose, { Schema, Document } from "mongoose";

export interface IMessageSync extends Document {
  userId: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  lastSyncedAt: Date;
  updatedAt: Date;
}

const MessageSyncSchema: Schema<IMessageSync> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

MessageSyncSchema.index({ userId: 1, chatId: 1 }, { unique: true });

export const MessageSync = mongoose.model<IMessageSync>(
  "MessageSync",
  MessageSyncSchema
);
