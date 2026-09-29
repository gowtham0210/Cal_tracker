"use client";

import { useToast } from "@/components/ui/toast";
import { usePlan } from "@/lib/plan-store";

/**
 * Runs a plan change and shows a toast with Undo, which puts the affected days back exactly as
 * they were. Changes happen immediately; there are no "are you sure?" dialogs.
 */
export function useUndoable() {
  const toast = useToast();
  const snapshotDays = usePlan((s) => s.snapshotDays);
  const restoreDays = usePlan((s) => s.restoreDays);
  return (dates: string[], change: () => void, message: string) => {
    const snapshot = snapshotDays([...new Set(dates)]);
    change();
    toast(message, { tone: "info", action: { label: "Undo", onClick: () => restoreDays(snapshot) } });
  };
}
