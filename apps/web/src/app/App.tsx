import { useEffect } from "react";
import AppRoutes from "./routes";
import { useAuthStore } from "../store/auth.store";
import { useSocket } from "../hooks/useSocket";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { runSyncCycle } from "../services/sync.service";
import { useChatStore } from "../store/chat.store";

const RESET_ON_RESUME_FLAG = "reset_to_root_on_resume";

export default function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);
  const token = useAuthStore((s) => s.token);
  useSocket(token);
  const isOnline = useOnlineStatus();
  const hydrateChats = useChatStore((s) => s.hydrateFromCache);

  useEffect(() => {
    hydrateChats();
  }, [hydrateChats]);

  useEffect(() => {
    if (!isOnline) return;
    runSyncCycle();
  }, [isOnline]);

  useEffect(() => {
    restoreSession();

    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }, [restoreSession]);

  useEffect(() => {
    const isDesktop = Boolean((window as any).desktop?.isDesktop);
    if (isDesktop) return;

    // On mobile app start, always boot from first screen.
    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sessionStorage.setItem(RESET_ON_RESUME_FLAG, "1");
        return;
      }

      const shouldReset = sessionStorage.getItem(RESET_ON_RESUME_FLAG) === "1";
      if (shouldReset && window.location.pathname !== "/") {
        sessionStorage.removeItem(RESET_ON_RESUME_FLAG);
        window.location.replace("/");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return <AppRoutes />;
}
