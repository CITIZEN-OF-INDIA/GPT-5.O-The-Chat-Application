import type { MessageStatus } from "./message";

export type MediaID = string;

export enum MediaType {
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  FILE = "file",
}

export interface Media {
  id: MediaID;

  type: MediaType;

  mimeType: string;
  size: number; // bytes (compressed)

  originalName?: string;

  url?: string;        // backend storage
  localCacheKey?: string; // IndexedDB / cache

  duration?: number; // audio / video (seconds)
  waveform?: number[]; // audio preview

  width?: number;
  height?: number;

  status: MessageStatus;

  createdAt: number;
}
