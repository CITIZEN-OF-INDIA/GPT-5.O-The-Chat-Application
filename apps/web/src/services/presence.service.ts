import { getSocket } from "./socket.service";
import { usePresenceStore } from "../store/presence.store";

let registered = false; // prevent duplicate listeners

export const registerPresenceListeners = () => {
  if (registered) return;

  const socket = getSocket();
  if (!socket) return;

  registered = true;

  const { setOnline, setOffline } = usePresenceStore.getState();

  console.log("✅ Registering presence listeners on socket:", socket.id);


  socket.on("presence:snapshot", (users) => {
  console.log("📦 presence snapshot", users);

  usePresenceStore.getState().hydrate(users);
});


  socket.on("user:online", ({ userId }) => {
    console.log("🟢 RECEIVED user:online", userId);
    setOnline(userId);
  });

  socket.on("user:offline", ({ userId, lastSeen }) => {
    console.log("🔴 RECEIVED user:offline", userId, lastSeen);
    setOffline(userId, lastSeen);
  });
};
