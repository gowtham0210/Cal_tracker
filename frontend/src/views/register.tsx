"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSessionReady } from "@/components/providers";
import { Button, Card, Field, Input } from "@/components/ui";
import { api, type RegisterRequest } from "@/lib/api";
import { useCurrentUser, useSession } from "@/lib/session";
import { useStore } from "@/lib/store";
import { errorsFrom, FormError, PasswordInput } from "./auth-form";

type Errors = Partial<Record<keyof RegisterRequest | "form", string>>;

// Same rules as RegisterRequest in api/openapi.yaml, so most mistakes are caught before a round trip.
function validate(v: RegisterRequest): Errors {
  const e: Errors = {};
  const name = v.name.trim();
  const email = v.email.trim();
  if (!name) e.name = "Name is required.";
  else if (name.length > 80) e.name = "Name must be at most 80 characters.";
  if (!email) e.email = "Email is required.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address.";
  if (v.password.length < 8) e.password = "Password must be at least 8 characters.";
  else if (v.password.length > 128) e.password = "Password must be at most 128 characters.";
  return e;
}

export function RegisterView() {
  const ready = useSessionReady();
  const router = useRouter();
  const signIn = useSession((s) => s.signIn);
  const currentUser = useCurrentUser();

  const [values, setValues] = useState<RegisterRequest>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof RegisterRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined, form: undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const session = await api.register({ ...values, name: values.name.trim(), email: values.email.trim() });
      useStore.getState().reset();
      signIn(session);
      router.replace("/onboarding");
    } catch (err) {
      setErrors(errorsFrom(err));
      setSubmitting(false);
    }
  }

  if (ready && currentUser && !submitting) {
    return (
      <Card className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">You&apos;re already signed in</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {currentUser.email}.</p>
        <Link href="/" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-medium text-brand-contrast">
          Go to your dashboard
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Save your progress and pick up where you left off on any device.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Name" htmlFor="r-name" error={errors.name}>
          <Input id="r-name" name="name" autoComplete="name" value={values.name} onChange={set("name")} aria-invalid={!!errors.name} maxLength={80} autoFocus />
        </Field>
        <Field label="Email" htmlFor="r-email" error={errors.email}>
          <Input id="r-email" name="email" type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="r-password" error={errors.password} hint="At least 8 characters.">
          <PasswordInput id="r-password" name="password" autoComplete="new-password" value={values.password} onChange={set("password")} aria-invalid={!!errors.password} maxLength={128} />
        </Field>
        <FormError message={errors.form} />
        <Button type="submit" size="lg" className="w-full" loading={submitting} disabled={!ready}>
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand-strong hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
