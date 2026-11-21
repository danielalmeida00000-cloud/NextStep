import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isPlanId } from "@/lib/business/plans";
import { SiteFrame } from "@/components/site/chrome";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => {
    if (typeof search.next === "string" && search.next.startsWith("/subscribe")) return { next: search.next };
    return {};
  },
  component: Login,
});

function Login() {
  const next = Route.useSearch().next ?? "/desk";
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function goNext() {
    const [path, query] = next.split("?");
    if (path === "/subscribe") {
      const plan = new URLSearchParams(query || "").get("plan") || "";
      void navigate({ to: "/subscribe", search: { plan: isPlanId(plan) ? plan : "premium" } });
      return;
    }
    void navigate({ to: "/desk" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result =
      mode === "up"
        ? await authClient.signUp.email({ email, password, name: name || email })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Couldn’t sign in.");
      return;
    }
    goNext();
  }

  if (isPending) {
    return (
      <SiteFrame>
        <p className="text-muted">Checking your account…</p>
      </SiteFrame>
    );
  }

  if (user) {
    return (
      <SiteFrame>
        <div className="mx-auto max-w-sm">
          <h1 className="font-display text-3xl font-semibold">You’re signed in</h1>
          <p className="mt-2 text-sm text-muted">{user.primaryEmail || "This account is already on the desk."}</p>
          <button
            type="button"
            className="mt-6 min-h-11 w-full rounded-full bg-amber font-semibold text-ink"
            onClick={goNext}
          >
            Continue
          </button>
          <p className="mt-4 text-sm">
            <Link to="/desk" className="text-muted">
              Open the desk
            </Link>
          </p>
        </div>
      </SiteFrame>
    );
  }

  return (
    <SiteFrame>
      <div className="mx-auto max-w-sm">
        <h1 className="font-display text-3xl font-semibold">{mode === "up" ? "Create your account" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-muted">
          {mode === "up" ? "Use the email you’ll run the desk with." : "Use the email on your NextStep account."}
        </p>
        <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
          {mode === "up" && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
            />
          )}
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            minLength={8}
            placeholder="Password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
          />
          {error && <p className="text-sm text-brake">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-full bg-amber font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
          </button>
        </form>
        <button type="button" className="mt-3 min-h-11 text-sm text-amber" onClick={() => setMode(mode === "up" ? "in" : "up")}>
          {mode === "up" ? "Already have an account" : "Need an account"}
        </button>
        <div className="mt-6 space-y-2">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              className="min-h-11 w-full rounded-full border border-line text-sm"
              onClick={() => void signIn(provider.providerId, { callbackURL: next })}
            >
              Continue with {provider.label}
            </button>
          ))}
        </div>
      </div>
    </SiteFrame>
  );
}
