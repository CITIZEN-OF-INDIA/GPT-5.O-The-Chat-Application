import { apiFetch } from "./api";
import { normalizeMessage } from "../utils/normalizeMessage";
import type { Message } from "../../../../packages/shared-types/message";

export async function editMessageOnServer(
  messageId: string,
  text: string
): Promise<Message> {
  const res = await apiFetch(`/api/messages/${messageId}/edit`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("Failed to edit message");
  }

  return normalizeMessage(await res.json());
}

export async function pinMessageOnServer(
  messageId: string,
  pinned: boolean
): Promise<Message> {
  const res = await apiFetch(`/api/messages/${messageId}/pin`, {
    method: "PATCH",
    body: JSON.stringify({ pinned }),
  });

  if (!res.ok) {
    throw new Error("Failed to pin/unpin message");
  }

  return normalizeMessage(await res.json());
}

export async function deleteMessagesForMeOnServer(
  messageIds: string[]
): Promise<string[]> {
  const res = await apiFetch("/api/messages/delete-for-me", {
    method: "POST",
    body: JSON.stringify({ messageIds }),
  });

  if (!res.ok) {
    throw new Error("Failed to delete messages for me");
  }

  const data = await res.json();
  return Array.isArray(data?.deletedMessageIds)
    ? data.deletedMessageIds.map(String)
    : [];
}

export async function deleteMessagesForEveryoneOnServer(
  messageIds: string[]
): Promise<string[]> {
  const res = await apiFetch("/api/messages/delete-for-everyone", {
    method: "POST",
    body: JSON.stringify({ messageIds }),
  });

  if (!res.ok) {
    throw new Error("Failed to delete messages for everyone");
  }

  const data = await res.json();
  return Array.isArray(data?.deletedMessageIds)
    ? data.deletedMessageIds.map(String)
    : [];
}
