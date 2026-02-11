import { create } from "zustand";

type PresenceUser = {
  online: boolean;
  lastSeen?: string;
};

type PresenceState = {
  users: Record<string, PresenceUser>;
  ready: boolean;
  hydrate: (users: Array<{ userId: string; online: boolean; lastSeen?: string }>) => void;
  setOnline: (userId: string) => void;
  setOffline: (userId: string, lastSeen?: string) => void;
  reset: () => void;
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
        ready: true,
      };
    }),

  setOnline: (userId) =>
    set((state) => ({
      users: {
        ...state.users,
        [userId]: { online: true },
      },
      ready: true,
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
      ready: true,
    })),

  reset: () =>
    set({
      users: {},
      ready: false,
    }),
}));
