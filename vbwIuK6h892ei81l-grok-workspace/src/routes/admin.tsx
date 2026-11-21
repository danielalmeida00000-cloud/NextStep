import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { PLANS, planById, termLabel, termPrice, type PlanId, type TermId } from "@/lib/business/plans";
import { listSubscribers, setSubscription, type Subscriber } from "@/lib/business/access.functions";
import { stripeReady } from "@/lib/business/billing.functions";
import { SiteFrame } from "@/components/site/chrome";
import { useAccess } from "@/components/site/use-access";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function asTerm(value: string): TermId {
  return value === "half" || value === "year" ? value : "month";
}

function AdminPage() {
  const { user, isPending, access, error } = useAccess();
  const [rows, setRows] = useState<Subscriber[] | null>(null);
  const [note, setNote] = useState("");
  const [cards, setCards] = useState(false);

  useEffect(() => {
    if (access?.role !== "owner") return;
    let live = true;
    listSubscribers()
      .then((list) => {
        if (live) setRows(list);
      })
      .catch((err: unknown) => {
        if (live) setNote(err instanceof Error ? err.message : "Couldn’t load accounts.");
      });
    void stripeReady()
      .then((row) => {
        if (live) setCards(row.ready);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [access?.role]);

  if (isPending || (user && !access && !error)) {
    return (
      <SiteFrame>
        <p className="text-muted">Opening admin…</p>
      </SiteFrame>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (access?.role !== "owner") return <Navigate to="/desk" />;

  async function save(row: Subscriber, next: { plan?: PlanId; term?: TermId; status?: "pending" | "active" | "canceled" }) {
    setNote("");
    const plan = next.plan ?? planById(row.plan).id;
    const term = next.term ?? asTerm(row.term);
    const status = next.status ?? (row.status === "active" || row.status === "canceled" ? row.status : "pending");
    try {
      await setSubscription({ data: { userId: row.userId, status, plan, term } });
      setRows((cur) => cur?.map((item) => (item.userId === row.userId ? { ...item, status, plan, term } : item)) ?? cur);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn’t update that account.");
    }
  }

  const people = (rows ?? []).filter((row) => row.role !== "owner");
  const active = people.filter((row) => row.status === "active");
  const pending = people.filter((row) => row.status === "pending");
  const paying = active.filter((row) => row.paid);
  const collected = paying.reduce((sum, row) => sum + row.amountCents, 0);
  const booked = active.reduce((sum, row) => sum + termPrice(planById(row.plan), asTerm(row.term)), 0);

  return (
    <SiteFrame>
      <h1 className="font-display text-3xl font-semibold">Admin</h1>
      <p className="mt-2 max-w-xl text-muted">
        You see every account, what they asked to pay, and what has actually been charged. Turn a plan on, change the term, or cancel it. A salesperson never sees this page.
      </p>
      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Charged" value={`$${(collected / 100).toFixed(0)}`} note="Paid through Stripe" />
        <Stat label="On the books" value={`$${booked}`} note="Active plans, if they pay" />
        <Stat label="Waiting" value={String(pending.length)} note="Asked, not turned on" />
        <Stat label="Active" value={String(active.length)} note={`${people.length} salesperson accounts`} />
      </dl>
      <p className="mt-3 text-sm text-muted">
        {cards ? "Stripe can charge cards." : "Stripe isn’t connected yet, so Charged stays at $0 until the secret key is on the host."}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
        {PLANS.map((plan) => (
          <li key={plan.id} className="rounded-full border border-line px-3 py-1">
            {plan.name} {active.filter((row) => row.plan === plan.id).length}
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-brake">{error}</p>}
      {note && <p className="mt-3 text-sm text-brake">{note}</p>}
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {(rows ?? []).map((row) => (
          <li key={row.userId} className="flex flex-col gap-3 py-4">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-muted">
                {row.email} ·{" "}
                {row.role === "owner"
                  ? "Owner"
                  : row.status === "none"
                    ? "No plan yet"
                    : `${planById(row.plan).name} · ${termLabel(row.term)} · $${termPrice(planById(row.plan), asTerm(row.term))} · ${row.paid ? "paid" : row.status}`}
              </p>
            </div>
            {row.role === "owner" ? (
              <p className="text-sm text-amber">Owner · full desk, this page, no plan to pay</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["month", "Month"],
                    ["half", "6 mo"],
                    ["year", "12 mo"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`min-h-11 rounded-full border px-3 text-sm ${row.term === id ? "border-amber text-fg" : "border-line text-muted"}`}
                    onClick={() => void save(row, { term: id })}
                  >
                    {label}
                  </button>
                ))}
                {PLANS.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className={`min-h-11 rounded-full border px-3 text-sm ${row.plan === plan.id && row.status === "active" ? "border-amber" : "border-line"}`}
                    onClick={() => void save(row, { plan: plan.id, status: "active" })}
                  >
                    {plan.name}
                  </button>
                ))}
                {row.status !== "active" ? (
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-amber px-3 text-sm font-semibold text-ink"
                    onClick={() => void save(row, { status: "active" })}
                  >
                    Turn on
                  </button>
                ) : null}
                <button
                  type="button"
                  className="min-h-11 rounded-full bg-brake px-3 text-sm text-fg"
                  onClick={() => void save(row, { status: "canceled" })}
                >
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!rows && <p className="mt-4 text-sm text-muted">Loading accounts…</p>}
      <p className="mt-6 text-sm">
        <Link to="/desk" className="text-amber">
          Back to the desk
        </Link>
      </p>
    </SiteFrame>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</dd>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
