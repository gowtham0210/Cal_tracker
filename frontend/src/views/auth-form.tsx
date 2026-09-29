"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui";
import { ApiError } from "@/lib/api";

/** Password input with a show/hide toggle. */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-1 grid w-10 place-items-center rounded-lg text-subtle hover:text-text"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      {message}
    </p>
  );
}

/** Maps an API error onto form fields, falling back to a form-level message. */
export function errorsFrom(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return { form: "Something went wrong. Please try again." };
  const { "": whole, ...fields } = err.fieldErrors();
  return Object.keys(fields).length ? fields : { form: whole ?? err.problem.title };
}

/** Only same-site paths are allowed as a post-login destination (no open redirects). */
export function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
