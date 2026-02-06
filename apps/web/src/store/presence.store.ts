import { create } from "zustand";

type PresenceUser = {
  online: boolean;
  lastSeen?: string;
};

type PresenceState = {
  users: Record<string, PresenceUser>;

  // 👇 means: we have received ANY presence data
  ready: boolean;

  hydrate: (users: Array<{ userId: string; online: boolean; lastSeen?: string }>) => void;
  setOnline: (userId: string) => void;
  setOffline: (userId: string, lastSeen?: string) => void;
};

export const usePresenceStore = create<PresenceState>((set) => ({
  users: {},
  ready: false,

  hydrate: (snapshot) =>
    set((state) => {
      const next = { ...state.users };

      snapshot.forEach((u) => {
        next[u.userId] = {
          online: u.online,
          lastSeen: u.lastSeen,
        };
      });

      return {
        users: next,
        ready: true, // ✅ IMPORTANT
      };
    }),

  setOnline: (userId) =>
    set((state) => ({
      users: {
        ...state.users,
        [userId]: { online: true },
      },
      ready: true, // ✅ IMPORTANT
    })),

  setOffline: (userId, lastSeen) =>
    set((state) => ({
      users: {
        ...state.users,
        [userId]: {
          online: false,
          lastSeen,
        },
      },
      ready: true, // ✅ IMPORTANT
    })),
}));
