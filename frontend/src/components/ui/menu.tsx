"use client";

import clsx from "clsx";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** An accessible menu button: arrow keys move, Enter/Space select, Esc closes and returns focus. */
export function Menu({ label, items, className, align = "right" }: { label: string; items: MenuItem[]; className?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const focusItem = (i: number) => {
    const els = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])");
    if (!els?.length) return;
    els[(i + els.length) % els.length].focus();
  };
  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => focusItem(0));
    const onDown = (e: PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div className={clsx("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-text"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            const els = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not([disabled])") ?? [])];
            const i = els.indexOf(document.activeElement as HTMLButtonElement);
            const target = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: els.length - 1 }[e.key];
            if (target !== undefined) {
              e.preventDefault();
              focusItem(target);
            } else if (e.key === "Escape" || e.key === "Tab") {
              close(e.key === "Escape");
            }
          }}
          className={clsx(
            "absolute z-40 mt-1 min-w-44 rounded-xl border border-border bg-surface p-1 shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((it) => (
            <li key={it.label} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={it.disabled}
                onClick={() => {
                  close();
                  it.onSelect();
                }}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none disabled:opacity-50",
                  it.danger ? "text-danger" : "text-text",
                )}
              >
                {it.icon}
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
