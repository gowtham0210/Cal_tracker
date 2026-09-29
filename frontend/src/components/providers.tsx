"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { configureAuth } from "@/lib/api";
import { useCurrentUser, useSession } from "@/lib/session";
import { onSyncError, useStore, type Status } from "@/lib/store";
import { ToastProvider, useToast } from "./ui/toast";

// Every API call reads the token from the session; a 401 on a signed-in call ends the session.
configureAuth({
  token: () => useSession.getState().accessToken,
  onUnauthorized: () => {
    useSession.getState().signOut();
    useStore.getState().reset();
  },
});

let sessionHydrated = false;

/** True once the saved session has been read from local storage (client only). */
export function useSessionReady() {
  const [ready, setReady] = useState(sessionHydrated);
  useEffect(() => {
    if (sessionHydrated) return;
    void Promise.resolve(useSession.persist.rehydrate()).then(() => {
      sessionHydrated = true;
      setReady(true);
    });
  }, []);
  return ready;
}

/**
 * Guards the app: signed-out visitors go to /login, users without a profile go to /onboarding,
 * and everyone else gets their data loaded from the API. Returns the data status.
 */
export function useAppData(): Status {
  const sessionReady = useSessionReady();
  const user = useCurrentUser();
  const status = useStore((s) => s.status);
  const load = useStore((s) => s.load);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (status === "idle") void load();
    if (status === "needs-profile") router.replace("/onboarding");
  }, [sessionReady, user, status, load, router, pathname]);

  return sessionReady && user ? status : "loading";
}

/** Signs out and forgets the data on this device. */
export function signOut() {
  useSession.getState().signOut();
  useStore.getState().reset();
}

function SyncErrors() {
  const toast = useToast();
  useEffect(() => onSyncError((message) => toast(message, { tone: "error" })), [toast]);
  return null;
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
      <SyncErrors />
      {children}
    </ToastProvider>
  );
}
