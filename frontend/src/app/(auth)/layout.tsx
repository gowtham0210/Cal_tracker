import { Logo } from "@/components/layout/app-shell";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <div className="flex justify-center">
        <Logo />
      </div>
      {children}
    </main>
  );
}
