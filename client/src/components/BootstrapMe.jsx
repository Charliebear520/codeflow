import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

export default function BootstrapMe() {
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
      } catch (e) {
        console.error("bootstrap /api/me failed:", e);
      }
    })();
  }, [isSignedIn, getToken]);

  return null;
}