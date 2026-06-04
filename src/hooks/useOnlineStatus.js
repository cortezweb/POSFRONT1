import { useState, useEffect } from "react";

/**
 * Hook to track browser online/offline status.
 * @returns {boolean} isOnline - True if online, false if offline.
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    // navigator.onLine can be undefined in some SSR/rare environments, default to true
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Double check on mount
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
};
