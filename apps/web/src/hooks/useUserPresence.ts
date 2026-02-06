import { usePresenceStore } from "../store/presence.store";

export function useUserPresence(userId?: string) {
  return usePresenceStore((state) => {
    if (!userId) return undefined;
    return state.users[userId];
  });
}
