"use client";

import clsx from "clsx";
import { Activity, BookHeart, CalendarDays, Home, LineChart, LogOut, Menu, MessageCircle, Plus, Scale, Settings, Trophy, Utensils } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FoodDialog } from "../dialogs/food-dialog";
import { ExerciseDialog, MeasurementDialog, MoreDialog, MORE_LINKS, QuickAddDialog, WeightDialog } from "../dialogs/other-dialogs";
import { signOut, useAppData } from "../providers";
import { Button, Skeleton } from "../ui";
import { useUI } from "@/lib/ui";
import { useStore } from "@/lib/store";
import { currentStreak } from "@/lib/calc";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/food", label: "Food", icon: Utensils },
  { href: "/plan", label: "Plan", icon: CalendarDays },
  { href: "/body", label: "Body", icon: Scale },
  { href: "/exercise", label: "Exercise", icon: Activity },
  { href: "/journal", label: "Journal", icon: BookHeart },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/goals", label: "Goals", icon: Trophy },
  { href: "/coach", label: "AI Coach", icon: MessageCircle },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 font-semibold tracking-tight">
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-contrast shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <path d="M4 16c3-6 6-9 8-9s3 4 5 4 2.5-2 3-3" />
          <circle cx="4" cy="16" r="0.5" />
        </svg>
      </span>
      <span className="text-[17px]">Lighter</span>
    </Link>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const open = useUI((s) => s.open);
  const foods = useStore((s) => s.foods);
  const name = useStore((s) => s.profile?.name);
  const streak = foods ? currentStreak(foods) : 0;

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
      <Logo />
      <QuickAddButton onClick={() => open("quick")} />
      <nav aria-label="Main" className="mt-2 flex-1 space-y-0.5">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              <Icon className="size-[18px]" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-border pt-3">
        <Link
          href="/settings"
          aria-current={isActive(pathname, "/settings") ? "page" : undefined}
          className={clsx(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
            isActive(pathname, "/settings") ? "bg-brand-soft text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-text",
          )}
        >
          <Settings className="size-[18px]" />
          Settings
        </Link>
        {name && (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-contrast">
              {name[0]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="text-xs text-muted">🔥 {streak}-day streak</p>
            </div>
            <button
              onClick={signOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-8 place-items-center rounded-lg text-subtle transition hover:bg-border hover:text-text"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function QuickAddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-contrast shadow-sm transition hover:brightness-110 active:scale-[0.98]"
    >
      <Plus className="size-4" strokeWidth={2.6} />
      Quick add
    </button>
  );
}

function BottomNav() {
  const pathname = usePathname();
  const open = useUI((s) => s.open);
  const moreActive = MORE_LINKS.some((l) => isActive(pathname, l.href) && l.href !== "/progress");
  const items = [
    { href: "/", label: "Today", icon: Home },
    { href: "/food", label: "Food", icon: Utensils },
    null,
    { href: "/progress", label: "Progress", icon: LineChart },
  ];
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {items.map((n) =>
          n ? (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={clsx(
                "flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition",
                isActive(pathname, n.href) ? "text-brand" : "text-subtle",
              )}
            >
              <n.icon className="size-[22px]" strokeWidth={isActive(pathname, n.href) ? 2.4 : 2} />
              {n.label}
            </Link>
          ) : (
            <div key="fab" className="flex justify-center">
              <button
                onClick={() => open("quick")}
                aria-label="Quick add"
                className="-mt-6 grid size-14 place-items-center rounded-full bg-brand text-brand-contrast shadow-lg shadow-brand/30 ring-4 ring-bg transition active:scale-95"
              >
                <Plus className="size-7" strokeWidth={2.6} />
              </button>
            </div>
          ),
        )}
        <button
          onClick={() => open("more")}
          className={clsx("flex flex-col items-center gap-1 py-1 text-[11px] font-medium", moreActive ? "text-brand" : "text-subtle")}
        >
          <Menu className="size-[22px]" />
          More
        </button>
      </div>
    </nav>
  );
}

function MobileHeader() {
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/85 px-4 backdrop-blur-lg lg:hidden">
      <Logo />
      <Link
        href="/coach"
        className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-strong"
      >
        <MessageCircle className="size-3.5" />
        Ask AI
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading your data">
      <Skeleton className="h-9 w-52" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

function LoadError() {
  const error = useStore((s) => s.loadError);
  const load = useStore((s) => s.load);
  return (
    <div role="alert" className="mx-auto mt-16 max-w-sm text-center">
      <p className="font-semibold">Couldn&apos;t load your data</p>
      <p className="mt-1 text-sm text-muted">{error}</p>
      <div className="mt-5 flex justify-center gap-2">
        <Button onClick={() => void load()}>Try again</Button>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const status = useAppData();
  const ready = status === "ready";
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {ready && <Sidebar />}
      {!ready && <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          {ready ? children : status === "error" ? <LoadError /> : <LoadingSkeleton />}
        </main>
      </div>
      <BottomNav />
      {ready && (
        <>
          <FoodDialog />
          <WeightDialog />
          <ExerciseDialog />
          <MeasurementDialog />
          <QuickAddDialog />
          <MoreDialog />
        </>
      )}
    </div>
  );
}
