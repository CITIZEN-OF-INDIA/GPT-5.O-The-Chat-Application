import { useEffect } from "react";
import AppRoutes from "./routes";
import { useAuthStore } from "../store/auth.store";
import { useSocket } from "../hooks/useSocket";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { runSyncCycle } from "../services/sync.service";
import { useChatStore } from "../store/chat.store";


export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const token = useAuthStore((s) => s.token);
  useSocket(token);
  const isOnline = useOnlineStatus();
  const hydrateChats = useChatStore((s) => s.hydrateFromCache);


  


  useEffect(() => {
    hydrateChats(); // 🔥 loads chat list instantly
  }, []);
  
  useEffect(() => {
    if (!isOnline) return;

    // 🔥 fires:
    // 1. on app load
    // 2. when internet reconnects
    runSyncCycle();
  }, [isOnline]);

  useEffect(() => {
    restoreSession();

    // 🔒 Lock global scrolling for app shell
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }, [restoreSession]);

  // ✅ SOCKET STARTS ONLY AFTER TOKEN EXISTS
  

  return <AppRoutes />;
}
