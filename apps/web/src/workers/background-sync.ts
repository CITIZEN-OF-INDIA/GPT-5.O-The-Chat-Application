import { flushQueuedMessages } from "../services/sync.service";
import { getSocket } from "../services/socket.service";

/**
 * Called when:
 * - app wakes up
 * - browser regains connectivity
 * - service worker resumes
 */
export async function syncQueuedMessages() {
  const socket = getSocket();
  if (!socket || !socket.connected) return;

  await flushQueuedMessages();
}
