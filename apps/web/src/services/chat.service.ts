import { apiFetch } from "./api";
import type { ChatDB } from "../db/indexedDB";
import { normalizeChat } from "../utils/normalizeChat"; // ✅ import instead of local function

export async function createDirectChat(username: string) {
  const res = await apiFetch("/api/chats/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });

  if (!res.ok) {
    throw new Error("User not found");
  }

  const rawChat = await res.json();
  return normalizeChat(rawChat); // ✅ use imported normalizeChat
}

export async function fetchChats(): Promise<ChatDB[]> {
  const res = await apiFetch("/api/chats");

  if (!res.ok) {
    throw new Error("Failed to fetch chats");
  }

  const rawChats = await res.json();
  return rawChats.map(normalizeChat); // ✅ use imported normalizeChat
}
