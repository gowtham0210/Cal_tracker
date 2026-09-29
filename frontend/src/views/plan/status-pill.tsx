import clsx from "clsx";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import type { GoalStatus } from "@/lib/api";

const fmt = (n: number) => Math.round(Math.abs(n)).toLocaleString();

/** Day status in words and an icon, never colour alone (WCAG 1.4.1). */
export function StatusPill({ status, className, compact }: { status: GoalStatus; className?: string; compact?: boolean }) {
  if (status.state === "empty") return <span className={clsx("text-xs text-muted", className)}>Nothing planned</span>;
  const { Icon, text, tone } = {
    "on-target": { Icon: Check, text: "On target", tone: "bg-brand-soft text-brand-strong" },
    under: { Icon: ArrowDown, text: `${fmt(status.difference)} under`, tone: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200" },
    over: { Icon: ArrowUp, text: `${fmt(status.difference)} over`, tone: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200" },
  }[status.state];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular", tone, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden strokeWidth={2.6} />
      {compact && status.state !== "on-target" ? fmt(status.difference) : text}
      {compact && status.state !== "on-target" && <span className="sr-only">{status.state}</span>}
    </span>
  );
}

/** A small dot for day chips, with the status spelled out for screen readers. */
export function StatusDot({ status }: { status: GoalStatus }) {
  const cls = { "on-target": "bg-brand", under: "bg-sky-500", over: "bg-amber-500", empty: "bg-border" }[status.state];
  const label = { "on-target": "on target", under: "under goal", over: "over goal", empty: "nothing planned" }[status.state];
  return (
    <>
      <span className={clsx("size-1.5 rounded-full", cls)} aria-hidden />
      <span className="sr-only">, {label}</span>
    </>
  );
}
