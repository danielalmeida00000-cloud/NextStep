import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { isPlanId, PLANS, planById, termLabel, termPrice, type PlanId, type TermId } from "@/lib/business/plans";
import { requestSubscription } from "@/lib/business/access.functions";
import { confirmCheckout, openBillingPortal, startCheckout, stripeReady } from "@/lib/business/billing.functions";
import { SiteFrame } from "@/components/site/chrome";
import { useAccess } from "@/components/site/use-access";

export const Route = createFileRoute("/subscribe")({
  validateSearch: (search: Record<string, unknown>): { plan?: PlanId } => {
    if (typeof search.plan === "string" && isPlanId(search.plan)) return { plan: search.plan };
    return {};
  },
  component: SubscribePage,
});

function SubscribePage() {
  const fromLink = Route.useSearch().plan ?? "premium";
  const { user, isPending, access, error, setAccess } = useAccess();
  const [picked, setPicked] = useState<PlanId>(fromLink);
  const [term, setTerm] = useState<TermId>("month");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [cards, setCards] = useState<boolean | null>(null);

  useEffect(() => {
    setPicked(fromLink);
  }, [fromLink]);

  useEffect(() => {
    let live = true;
    void stripeReady()
      .then((row) => {
        if (live) setCards(row.ready);
      })
      .catch(() => {
        if (live) setCards(false);
      });
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) return () => {
      live = false;
    };
    setBusy(true);
    void confirmCheckout({ data: { sessionId } })
      .then((next) => {
        if (!live) return;
        setAccess(next);
        window.history.replaceState({}, "", "/subscribe");
        setNote("Payment received. Your plan is on.");
      })
      .catch((err: unknown) => {
        if (live) setNote(err instanceof Error ? err.message : "Couldn’t confirm that payment.");
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [setAccess]);

  if (isPending || (user && !access && !error)) {
    return (
      <SiteFrame>
        <p className="text-muted">Loading plans…</p>
      </SiteFrame>
    );
  }
  if (!user) return <Navigate to="/login" search={{ next: `/subscribe?plan=${picked}` }} />;

  const owner = access?.role === "owner";
  if (access?.allowed) {
    return (
      <SiteFrame>
        <h1 className="font-display text-3xl font-semibold">
          {owner ? "You’re the owner" : `${planById(access.plan).name} is on`}
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          {owner
            ? "This login runs the business. The plan picker stays closed."
            : "This account already has a plan, so the plan picker stays closed."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/desk" className="inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink">
            Open the desk
          </Link>
          <Link to="/reminders" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm">
            Reminders
          </Link>
          {owner ? (
            <Link to="/admin" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm">
              Admin
            </Link>
          ) : null}
        </div>
      </SiteFrame>
    );
  }

  async function pay() {
    if (!agreed) {
      setNote("Agree to the terms before paying.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const session = await startCheckout({ data: { plan: picked, term } });
      window.location.href = session.url;
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn’t open checkout.");
      setBusy(false);
    }
  }

  async function portal() {
    setBusy(true);
    setNote("");
    try {
      const session = await openBillingPortal();
      window.location.href = session.url;
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn’t open billing.");
      setBusy(false);
    }
  }

  async function ask() {
    if (!agreed) {
      setNote("Agree to the terms before requesting a plan.");
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const next = await requestSubscription({ data: { plan: picked, term } });
      setAccess(next);
      setNote(`${planById(picked).name} is requested for ${termLabel(term).toLowerCase()}. Card checkout isn’t on yet, so the owner turns this plan on from Admin.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn’t request that plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteFrame>
      <h1 className="font-display text-3xl font-semibold">Pick a plan</h1>
      {owner ? (
        <p className="mt-2 max-w-xl text-muted">
          This login runs the business. It doesn’t take a plan. A salesperson creates their own account, then pays here.
        </p>
      ) : (
        <p className="mt-2 max-w-xl text-muted">
          {cards === null
            ? "Checking card checkout…"
            : cards
              ? "The $40 Basic plan is free for 7 days, and a card is required to start it. Nothing is charged today. $40 starts on day 7 unless you cancel. Six-month and yearly prices, and Premium or Premium Plus, are charged now."
              : "Card checkout isn’t connected yet. Choosing a plan sends the request to the owner, who turns it on from Admin."}
          {access?.status === "pending" ? ` You already asked for ${planById(access.plan).name}, ${termLabel(access.term).toLowerCase()}.` : ""}
          {access?.allowed ? ` ${planById(access.plan).name} is already on.` : ""}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["month", "Monthly"],
            ["half", "6 months"],
            ["year", "12 months"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTerm(id)}
            className={`min-h-11 rounded-full border px-4 text-sm ${term === id ? "border-amber text-fg" : "border-line text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => setPicked(plan.id)}
            className={`rounded-2xl border p-5 text-left ${picked === plan.id ? "border-amber bg-surface" : "border-line"}`}
          >
            <span className="font-display text-2xl font-semibold">{plan.name}</span>
            <span className="mt-2 block text-2xl tabular-nums">${termPrice(plan, term)}</span>
            <span className="block text-sm text-muted">{termLabel(term)}</span>
            {plan.id === "basic" && term === "month" ? (
              <span className="mt-1 block text-sm font-medium text-amber">7 days free. A card is required. $40 on day 7.</span>
            ) : null}
            <span className="mt-2 block text-sm tabular-nums text-muted">
              ${plan.price}/mo · 6 mo ${plan.half} · 12 mo ${plan.year}
            </span>
            <span className="mt-2 block text-sm text-muted">{plan.blurb}</span>
            <span className="mt-3 block space-y-1 text-sm">
              {plan.includes.map((item) => (
                <span key={item} className="block">
                  {item}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      {owner ? (
        <Link to="/admin" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink">
          Open admin
        </Link>
      ) : (
        <>
          <label className="mt-6 flex max-w-xl items-start gap-3 text-sm text-muted">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-amber"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" className="text-amber">
                terms
              </Link>
              . If Facebook removes a listing or restricts my account, that is on me, not NextStep, and it is not a reason to reverse the charge.
            </span>
          </label>
          <button
            type="button"
            disabled={busy || cards === null || !agreed}
            onClick={() => void (cards ? pay() : ask())}
            className="mt-4 min-h-11 rounded-full bg-amber px-5 font-semibold text-ink disabled:opacity-60"
          >
            {busy ? "Working…" : cards === null ? "Checking checkout…" : cards && picked === "basic" && term === "month" ? "Start 7-day free trial" : cards ? `Pay $${termPrice(planById(picked), term)}` : `Request ${planById(picked).name}`}
          </button>
        </>
      )}
      {!owner ? (
        <button type="button" disabled={busy} onClick={() => void portal()} className="mt-3 min-h-11 text-sm text-amber">
          Manage billing
        </button>
      ) : null}
      {note && <p className="mt-3 text-sm text-amber">{note}</p>}
      {error && <p className="mt-3 text-sm text-brake">{error}</p>}
      <p className="mt-6 text-sm">
        <Link to="/desk" className="text-muted">
          Back to the desk
        </Link>
      </p>
    </SiteFrame>
  );
}
