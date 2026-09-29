"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { errorsFrom, FormError, PasswordInput, safeNext } from "./auth-form";

export function LoginView() {
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined, form: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!values.email.trim()) found.email = "Email is required.";
    if (!values.password) found.password = "Password is required.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const session = await api.login({ email: values.email.trim(), password: values.password });
      useStore.getState().reset();
      signIn(session);
      router.replace(safeNext());
    } catch (err) {
      setErrors(errorsFrom(err));
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to see your progress.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" htmlFor="l-email" error={errors.email}>
          <Input id="l-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set("email")} aria-invalid={!!errors.email} autoFocus />
        </Field>
        <Field label="Password" htmlFor="l-password" error={errors.password}>
          <PasswordInput id="l-password" name="password" autoComplete="current-password" value={values.password} onChange={set("password")} aria-invalid={!!errors.password} />
        </Field>
        <FormError message={errors.form} />
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        New to Lighter?{" "}
        <Link href="/register" className="font-medium text-brand-strong hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
