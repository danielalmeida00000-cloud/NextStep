import { getSql } from "@/lib/db";
import { normalizePlan, normalizeTerm, planById, termPrice, type PlanId, type TermId } from "@/lib/business/plans";

import { readFileSync } from "node:fs";

function startupValue(name: string): string | null {
  const fromEnv = process.env[name]?.trim();
  if (fromEnv) return fromEnv;
  const paths = ["/workspace/startup.sh", `${process.cwd()}/startup.sh`];
  for (const path of paths) {
    try {
      const text = readFileSync(path, "utf8");
      const match = text.match(new RegExp(`export ${name}='([^']+)'`));
      if (match?.[1]) {
        process.env[name] = match[1];
        return match[1];
      }
    } catch {
      /* try the next path */
    }
  }
  return null;
}

export function stripeSecret(): string | null {
  return startupValue("STRIPE_SECRET_KEY");
}

export function webhookSecret(): string | null {
  return startupValue("STRIPE_WEBHOOK_SECRET");
}

export function termCharge(planId: PlanId, term: TermId): { cents: number; interval: "month" | "year"; count: number } {
  const plan = planById(planId);
  if (term === "half") return { cents: plan.half * 100, interval: "month", count: 6 };
  if (term === "year") return { cents: plan.year * 100, interval: "year", count: 1 };
  return { cents: plan.price * 100, interval: "month", count: 1 };
}

export async function stripeRequest(path: string, body?: URLSearchParams, method = "POST") {
  const key = stripeSecret();
  if (!key) throw new Error("Card payments aren’t turned on yet.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2026-11-18.endive",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
  });
  const json = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message || "Stripe refused that.");
  return json;
}

type StripeSession = {
  client_reference_id?: string | null;
  payment_status?: string;
  status?: string;
  customer?: string | { id: string } | null;
  subscription?: string | { id: string } | null;
  metadata?: { userId?: string; plan?: string; term?: string } | null;
};

function idOf(value: string | { id: string } | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.id;
}

export async function activateFromSession(session: StripeSession, userId: string) {
  const ownerId = session.metadata?.userId || session.client_reference_id || "";
  if (!ownerId || ownerId !== userId) throw new Error("That payment isn’t for this account.");
  if (session.status !== "complete" || (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")) {
    return { ok: false as const, error: "Payment is still processing." };
  }
  const plan = normalizePlan(session.metadata?.plan);
  const term = normalizeTerm(session.metadata?.term);
  const subscriptionId = idOf(session.subscription);
  const customerId = idOf(session.customer);
  if (!subscriptionId) return { ok: false as const, error: "Stripe didn’t start the subscription." };
  const cents = termCharge(plan, term).cents;
  const sql = await getSql();
  await sql`
    update subscriptions
    set status = 'active',
        plan = ${plan},
        term = ${term},
        amount_cents = ${cents},
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        updated_at = now()
    where user_id = ${userId}
  `;
  return { ok: true as const };
}

export async function syncSubscription(subscriptionId: string, stripeStatus: string) {
  if (!subscriptionId) return;
  const sql = await getSql();
  if (stripeStatus === "canceled" || stripeStatus === "unpaid" || stripeStatus === "incomplete_expired" || stripeStatus === "past_due") {
    await markStripeCanceled(subscriptionId);
    return;
  }
  if (stripeStatus === "active" || stripeStatus === "trialing") {
    await sql`
      update subscriptions
      set status = 'active', updated_at = now()
      where stripe_subscription_id = ${subscriptionId}
    `;
  }
}
export async function markStripeCanceled(subscriptionId: string) {
  if (!subscriptionId) return;
  const sql = await getSql();
  await sql`
    update subscriptions
    set status = 'canceled', updated_at = now()
    where stripe_subscription_id = ${subscriptionId}
      and status = 'active'
  `;
}
