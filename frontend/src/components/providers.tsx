"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { ToastProvider } from "./ui/toast";

let hydratedOnce = false;

/** True once persisted data has loaded on the client (mock data is seeded on first visit). */
export function useHydrated() {
  const [ready, setReady] = useState(hydratedOnce);
  useEffect(() => {
    if (hydratedOnce) return;
    void useSession.persist.rehydrate();
    const finish = () => {
      if (!useStore.getState().seeded) useStore.getState().seed();
      hydratedOnce = true;
      setReady(true);
    };
    if (useStore.persist.hasHydrated()) finish();
    else {
      const unsub = useStore.persist.onFinishHydration(finish);
      void useStore.persist.rehydrate();
      return unsub;
    }
  }, []);
  return ready;
}

function ThemeSync() {
  const theme = useStore((s) => s.profile?.theme ?? "system");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
      try {
        localStorage.setItem("cal-theme", theme);
      } catch {}
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ThemeSync />
      {children}
    </ToastProvider>
  );
}
