import { useEffect, useState } from "react";
import { isEffectivelyOnline } from "../utils/network";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(isEffectivelyOnline());

  useEffect(() => {
    const handleOnline = () => setIsOnline(isEffectivelyOnline());
    const handleOffline = () => setIsOnline(isEffectivelyOnline());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
