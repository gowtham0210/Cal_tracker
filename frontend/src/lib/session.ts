"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Session, User } from "./api";

interface SessionState {
  accessToken: string | null;
  expiresAt: number | null;
  user: User | null;
  signIn: (s: Session) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      expiresAt: null,
      user: null,
      signIn: (s) => set({ accessToken: s.accessToken, expiresAt: Date.now() + s.expiresIn * 1000, user: s.user }),
      signOut: () => set({ accessToken: null, expiresAt: null, user: null }),
    }),
    // Hydrated in useHydrated() alongside the main store to avoid SSR mismatches.
    { name: "cal-tracker-session", skipHydration: true },
  ),
);

/** The signed-in user, or null when signed out or the token has expired. */
export function useCurrentUser(): User | null {
  return useSession((s) => (s.user && s.expiresAt && s.expiresAt > Date.now() ? s.user : null));
}
