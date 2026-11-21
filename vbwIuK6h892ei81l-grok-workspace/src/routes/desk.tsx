import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { PosterApp } from "@/components/poster/app";
import { useAccess } from "@/components/site/use-access";

export const Route = createFileRoute("/desk")({ component: DeskPage });

function DeskPage() {
  const { user, isPending, access, error } = useAccess();
  useEffect(() => {
    document.documentElement.dataset.app = "car-poster-pro";
    return () => {
      delete document.documentElement.dataset.app;
    };
  }, []);
  if (isPending || (user && !access && !error)) {
    return (
      <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
        <p className="text-muted">Opening the desk…</p>
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (error) {
    return (
      <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
        <p className="text-brake">{error}</p>
      </main>
    );
  }
  if (!access?.allowed) {
    return (
      <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
        <h1 className="font-display text-3xl font-semibold">Pay to open the desk</h1>
        <p className="mt-2 max-w-md text-muted">
          A new account does not include a plan. Basic, Premium, and Premium Plus start after the card goes through.
        </p>
        <Link
          to="/subscribe"
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink"
        >
          Choose a plan
        </Link>
      </main>
    );
  }
  return <PosterApp owner={access.role === "owner"} plan={access.plan} />;
}