import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { isPlanId, isTermId, type PlanId, type TermId } from "@/lib/business/plans";
import { activateFromSession, stripeRequest, stripeSecret } from "@/lib/business/stripe.server";
import { stripePriceId } from "@/lib/business/stripe-catalog";
import { readAccess, type Access } from "@/lib/business/access.functions";

export const stripeReady = createServerFn({ method: "GET" }).handler(async () => {
  return { ready: Boolean(stripeSecret()) };
});

export const startCheckout = createServerFn({ method: "POST" })
  .validator((input: { plan: string; term: string }) => {
    const plan = String(input?.plan ?? "");
    const term = String(input?.term ?? "");
    if (!isPlanId(plan) || !isTermId(term)) throw new Error("Pick a plan and how long you’re paying.");
    return { plan, term };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const access = await readAccess(context.userId);
    if (access.role === "owner") throw new Error("The owner account doesn’t pay.");
    const origin = getRequest()?.headers.get("origin") ?? "";
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("Open this page in the browser to pay.");
    const chosen = data.plan as PlanId;
    const term = data.term as TermId;
    const sql = await getSql();
    const emails = await sql<{ email: string | null }>`select email from "user" where id = ${context.userId}`;
    const email = emails[0]?.email ?? "";
    const suffix = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
    const body = new URLSearchParams();
    body.set("mode", "subscription");
    body.set("success_url", `${origin}/subscribe?session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${origin}/subscribe`);
    body.set("client_reference_id", context.userId);
    if (email) body.set("customer_email", email);
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price]", stripePriceId(chosen, term));
    body.set("managed_payments[enabled]", "true");
    body.set("integration_identifier", `nextstep-${suffix}`);
    body.set("metadata[userId]", context.userId);
    body.set("metadata[plan]", chosen);
    body.set("metadata[term]", term);
    body.set("subscription_data[metadata][userId]", context.userId);
    body.set("subscription_data[metadata][plan]", data.plan);
    body.set("subscription_data[metadata][term]", data.term);
    if (chosen === "basic" && term === "month") {
      body.set("subscription_data[trial_period_days]", "7");
      body.set("subscription_data[trial_settings][end_behavior][missing_payment_method]", "cancel");
      body.set("payment_method_collection", "always");
    }
    const session = (await stripeRequest("checkout/sessions", body)) as { url?: string };
    if (!session.url) throw new Error("Stripe didn’t return a checkout page.");
    return { url: session.url };
  });

export const confirmCheckout = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string }) => {
    const sessionId = String(input?.sessionId ?? "").trim();
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("That payment link is bad.");
    return { sessionId };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<Access> => {
    const session = (await stripeRequest(
      `checkout/sessions/${data.sessionId}`,
      undefined,
      "GET",
    )) as Parameters<typeof activateFromSession>[0];
    const result = await activateFromSession(session, context.userId);
    if (!result.ok) throw new Error(result.error);
    return readAccess(context.userId);
  });

const PORTAL_CONFIGURATION = "bpc_1UeG8eQWPRrCB9F4I268AZgM";
const PORTAL_LOGIN = "https://billing.stripe.com/p/login/dRmcN7cm084I61mesPbAs00";

export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await readAccess(context.userId);
    if (access.role === "owner") throw new Error("The owner account doesn’t pay.");
    const origin = getRequest()?.headers.get("origin") ?? "";
    if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error("Open this page in the browser to manage billing.");
    const sql = await getSql();
    const rows = await sql<{ stripe_customer_id: string | null }>`
      select stripe_customer_id from subscriptions where user_id = ${context.userId}
    `;
    const customer = rows[0]?.stripe_customer_id ?? "";
    if (!customer) return { url: PORTAL_LOGIN };
    const body = new URLSearchParams();
    body.set("customer", customer);
    body.set("configuration", PORTAL_CONFIGURATION);
    body.set("return_url", `${origin}/subscribe`);
    const session = (await stripeRequest("billing_portal/sessions", body)) as { url?: string };
    if (!session.url) return { url: PORTAL_LOGIN };
    return { url: session.url };
  });
