import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SignInGate, UserButton } from "@/lib/auth/gates";
import { useAccess } from "@/components/site/use-access";

function PlanOrReminders() {
  const { access } = useAccess();
  if (access?.allowed) {
    return (
      <Link to="/reminders" className="text-muted">
        Reminders
      </Link>
    );
  }
  return (
    <a href="/#plans" className="text-muted">
      Plans
    </a>
  );
}

function OwnerLink() {
  const { access } = useAccess();
  if (access?.role !== "owner") return null;
  return (
    <Link to="/admin" className="text-amber">
      Admin
    </Link>
  );
}

export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="currentColor" className="text-surface" />
      <rect x="6" y="17.25" width="19" height="6" rx="3" className="fill-amber" />
      <rect x="12" y="8.75" width="13" height="6" rx="3" className="fill-amber" />
    </svg>
  );
}

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <Mark />
            <span className="truncate font-display text-base font-semibold tracking-tight">NextStep</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <PlanOrReminders />
            <Link to="/desk" className="text-muted">
              Desk
            </Link>
            <SignInGate fallback={<Link to="/login">Sign in</Link>}>
              <OwnerLink />
              <UserButton />
            </SignInGate>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>NextStep Automotive Solutions</p>
          <div className="flex gap-4">
            <Link to="/terms" className="text-fg">
              Terms
            </Link>
            <a className="text-fg" href="mailto:nextstep.automotive.solutions@gmail.com">
              nextstep.automotive.solutions@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
