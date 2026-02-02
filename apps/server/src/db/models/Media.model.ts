import mongoose, { Schema, Document } from 'mongoose';

export interface IMedia extends Document {
  messageId: mongoose.Types.ObjectId;
  url: string;
  type: string; // 'image', 'video', 'audio'
  createdAt: Date;
}

const MediaSchema: Schema<IMedia> = new Schema({
  messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
  url: { type: String, required: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const Media = mongoose.model<IMedia>('Media', MediaSchema);
