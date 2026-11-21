import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { confirmCheckout, startCheckout } from "./billing.functions.ts";
import { loadAccess, readAccess, requestSubscription } from "./access.functions.ts";
import { activateFromSession, termCharge } from "./stripe.server.ts";
import { planById, type PlanId, type TermId } from "./plans.ts";
import { stripePriceId } from "./stripe-catalog.ts";
import { Route as WebhookRoute } from "../../routes/api/stripe/webhook.ts";

type Sql = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

type SubRow = {
  user_id: string;
  status: string;
  plan: string;
  term: string | null;
  amount_cents: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

type ProfileRow = { user_id: string; role: string };

type MemorySql = Sql & { subs: SubRow[]; profiles: ProfileRow[] };

type FetchCall = { url: string; method: string; body: URLSearchParams | null };

const bag = globalThis as typeof globalThis & {
  __nextstepTestSql?: MemorySql;
  __nextstepUserId?: string;
  __nextstepTestRequest?: { headers: { get(name: string): string | null } };
  __nextstepSession?: Record<string, unknown>;
};

const calls: FetchCall[] = [];
let originalFetch: typeof fetch;

function memorySql(): MemorySql {
  const profiles: ProfileRow[] = [];
  const subs: SubRow[] = [];
  const users = [{ id: "user_a", email: "a@example.com" }];
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
    if (text.startsWith("select email")) {
      return users
        .filter((user) => user.id === values[0])
        .map((user) => ({ email: user.email }));
    }
    if (text.startsWith("insert into profiles")) {
      if (!text.includes("role = 'owner'") || !text.includes("'member'")) {
        throw new Error("profile insert shape changed");
      }
      const userId = String(values[0]);
      if (!profiles.some((profile) => profile.user_id === userId)) {
        const hasOwner = profiles.some((profile) => profile.role === "owner");
        profiles.push({ user_id: userId, role: hasOwner ? "member" : "owner" });
      }
      return [];
    }
    if (text.startsWith("insert into subscriptions")) {
      if (!text.includes("'none'") || !text.includes("'active'")) {
        throw new Error("subscription insert shape changed");
      }
      const userId = String(values[0]);
      if (!subs.some((sub) => sub.user_id === userId)) {
        const profile = profiles.find((item) => item.user_id === userId);
        const owner = profile?.role === "owner";
        subs.push({
          user_id: userId,
          status: owner ? "active" : "none",
          plan: owner ? "plus" : "basic",
          term: null,
          amount_cents: 0,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        });
      }
      return [];
    }
    if (text.startsWith("select p.role")) {
      const userId = String(values[0]);
      const profile = profiles.find((item) => item.user_id === userId);
      const sub = subs.find((item) => item.user_id === userId);
      if (!profile || !sub) return [];
      return [{ role: profile.role, status: sub.status, plan: sub.plan, term: sub.term }];
    }
    if (text.includes("status = 'pending'")) {
      const [plan, term, userId] = values;
      const sub = subs.find((item) => item.user_id === userId);
      if (sub && ["none", "canceled", "pending"].includes(sub.status)) {
        sub.plan = String(plan);
        sub.term = String(term);
        sub.status = "pending";
      }
      return [];
    }
    if (text.includes("amount_cents")) {
      const [plan, term, cents, customerId, subscriptionId, userId] = values;
      const sub = subs.find((item) => item.user_id === userId);
      if (!sub) return [];
      sub.status = "active";
      sub.plan = String(plan);
      sub.term = String(term);
      sub.amount_cents = Number(cents);
      sub.stripe_customer_id = String(customerId);
      sub.stripe_subscription_id = String(subscriptionId);
      return [];
    }
    if (text.includes("status = 'canceled'")) {
      const subscriptionId = String(values[0]);
      const sub = subs.find(
        (item) => item.stripe_subscription_id === subscriptionId && item.status === "active",
      );
      if (sub) sub.status = "canceled";
      return [];
    }
    if (text.includes("status = 'active'")) {
      const subscriptionId = String(values[0]);
      const sub = subs.find((item) => item.stripe_subscription_id === subscriptionId);
      if (sub) sub.status = "active";
      return [];
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }) as unknown as MemorySql;
  sql.subs = subs;
  sql.profiles = profiles;
  return sql;
}

function paramsOf(raw: BodyInit | null | undefined): URLSearchParams | null {
  if (raw instanceof URLSearchParams) return raw;
  if (typeof raw === "string") return new URLSearchParams(raw);
  return null;
}

function amountDueTodayCents(body: URLSearchParams, plan: PlanId, term: TermId): number {
  const trialDays = Number(body.get("subscription_data[trial_period_days]") ?? "0");
  if (Number.isFinite(trialDays) && trialDays > 0) return 0;
  return termCharge(plan, term).cents;
}

async function checkout(plan: PlanId, term: TermId = "month") {
  calls.length = 0;
  const result = await startCheckout({ data: { plan, term } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "POST");
  assert.match(calls[0]?.url ?? "", /\/v1\/checkout\/sessions$/);
  const body = calls[0]?.body;
  assert.ok(body);
  assert.equal(body.get("mode"), "subscription");
  assert.equal(body.get("line_items[0][price]"), stripePriceId(plan, term));
  assert.equal(typeof result.url, "string");
  assert.match(result.url, /^https:\/\/checkout\.example\.test\//);
  return body;
}

function sessionFor(userId: string) {
  return {
    client_reference_id: userId,
    payment_status: "no_payment_required",
    status: "complete",
    customer: "cus_test",
    subscription: "sub_test",
    metadata: { userId, plan: "basic", term: "month" },
  };
}

function signature(raw: string): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

type WebhookPost = (ctx: { request: Request }) => Promise<Response>;

function webhookPost(): WebhookPost {
  const route = WebhookRoute as unknown as {
    server?: { handlers?: { POST?: WebhookPost } };
    options?: { server?: { handlers?: { POST?: WebhookPost } } };
  };
  const post = route.server?.handlers?.POST ?? route.options?.server?.handlers?.POST;
  if (!post) throw new Error("webhook POST handler missing");
  return post;
}

async function postRaw(raw: string, header: string) {
  const request = new Request("https://desk.example/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: raw,
  });
  return webhookPost()({ request });
}

async function postSigned(event: unknown) {
  const raw = JSON.stringify(event);
  return postRaw(raw, signature(raw));
}

async function armActive() {
  if (!bag.__nextstepTestSql?.profiles.some((profile) => profile.role === "owner")) {
    bag.__nextstepUserId = "user_owner";
    await loadAccess();
  }
  bag.__nextstepUserId = "user_a";
  await loadAccess();
  await activateFromSession(sessionFor("user_a"), "user_a");
  const access = await readAccess("user_a");
  assert.equal(access.role, "member");
  assert.equal(access.status, "active");
  assert.equal(access.allowed, true);
}

describe("checkout rules", { concurrency: false }, () => {
  beforeEach(() => {
    calls.length = 0;
    bag.__nextstepTestSql = memorySql();
    bag.__nextstepUserId = "user_a";
    bag.__nextstepSession = sessionFor("user_a");
    bag.__nextstepTestRequest = {
      headers: {
        get(name: string) {
          return name.toLowerCase() === "origin" ? "https://desk.example" : null;
        },
      },
    };
    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      calls.push({ url, method, body: paramsOf(init?.body) });
      if (method === "GET" && /\/checkout\/sessions\/cs_/.test(url)) {
        return Response.json(bag.__nextstepSession ?? {});
      }
      if (method === "POST" && url.endsWith("/checkout/sessions")) {
        return Response.json({ url: "https://checkout.example.test/pay" });
      }
      return Response.json({ id: "sub_test" });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("gives the $40 basic monthly plan a 7-day trial that still requires a card", async () => {
    const body = await checkout("basic", "month");
    assert.equal(planById("basic").price, 40);
    assert.equal(termCharge("basic", "month").cents, 4000);
    assert.equal(body.get("subscription_data[trial_period_days]"), "7");
    assert.equal(body.get("payment_method_collection"), "always");
    assert.equal(
      body.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
      "cancel",
    );
    assert.equal(amountDueTodayCents(body, "basic", "month"), 0);
  });

  it("does not give Premium or Premium Plus a trial", async () => {
    for (const plan of ["premium", "plus"] as const) {
      const body = await checkout(plan, "month");
      assert.equal(body.get("subscription_data[trial_period_days]"), null);
      assert.equal(
        body.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),
        null,
      );
      assert.equal(body.get("payment_method_collection"), null);
    }
  });

  it("keeps a new account off the desk until checkout", async () => {
    bag.__nextstepUserId = "user_owner";
    await loadAccess();
    bag.__nextstepUserId = "user_new";
    const created = await loadAccess();
    assert.equal(created.role, "member");
    assert.equal(created.status, "none");
    assert.equal(created.allowed, false);
    const pending = await requestSubscription({ data: { plan: "premium", term: "month" } });
    assert.equal(pending.plan, "premium");
    assert.equal(pending.status, "pending");
    assert.equal(pending.allowed, false);
    assert.equal(calls.length, 0);
  });

  it("turns the plan on when checkout completes with no payment required", async () => {
    bag.__nextstepUserId = "user_owner";
    await loadAccess();
    bag.__nextstepUserId = "user_a";
    await loadAccess();
    const response = await postSigned({
      type: "checkout.session.completed",
      data: { object: sessionFor("user_a") },
    });
    assert.equal(response.status, 200);
    const access = await readAccess("user_a");
    assert.equal(access.status, "active");
    assert.equal(access.plan, "basic");
    assert.equal(access.allowed, true);
  });

  it("rejects a checkout session that belongs to someone else", async () => {
    bag.__nextstepSession = sessionFor("user_a");
    bag.__nextstepUserId = "user_other";
    await assert.rejects(
      () => confirmCheckout({ data: { sessionId: "cs_test_other" } }),
      /That payment isn.t for this account/,
    );
  });

  it("cancels past_due, unpaid, incomplete_expired, and deleted subscriptions", async () => {
    for (const status of ["past_due", "unpaid", "incomplete_expired"]) {
      await armActive();
      const response = await postSigned({
        type: "customer.subscription.updated",
        data: { object: { id: "sub_test", status } },
      });
      assert.equal(response.status, 200);
      const access = await readAccess("user_a");
      assert.equal(access.status, "canceled");
      assert.equal(access.allowed, false);
    }
    await armActive();
    const deleted = await postSigned({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_test" } },
    });
    assert.equal(deleted.status, 200);
    const access = await readAccess("user_a");
    assert.equal(access.status, "canceled");
    assert.equal(access.allowed, false);
  });

  it("leaves the subscription active when an invoice is paid", async () => {
    await armActive();
    const sub = bag.__nextstepTestSql?.subs.find((item) => item.user_id === "user_a");
    assert.ok(sub);
    sub.status = "pending";
    const response = await postSigned({
      type: "invoice.paid",
      data: { object: { subscription: "sub_test" } },
    });
    assert.equal(response.status, 200);
    const access = await readAccess("user_a");
    assert.equal(access.status, "active");
    assert.equal(access.allowed, true);
  });

  it("returns 400 for a bad stripe signature and does not log secrets", async () => {
    const methods = ["log", "info", "warn", "error", "debug"] as const;
    const originals = new Map(methods.map((name) => [name, console[name]]));
    let leaked = false;
    for (const name of methods) {
      console[name] = ((...args: unknown[]) => {
        const text = args.map((item) => String(item)).join(" ");
        const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
        const key = process.env.STRIPE_SECRET_KEY ?? "";
        if ((secret && text.includes(secret)) || (key && text.includes(key))) leaked = true;
      }) as (typeof console)[typeof name];
    }
    try {
      const raw = JSON.stringify({ type: "checkout.session.completed" });
      const response = await postRaw(
        raw,
        `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
      );
      assert.equal(response.status, 400);
      assert.equal(await response.text(), "Bad signature");
      assert.equal(leaked, false);
    } finally {
      for (const [name, fn] of originals) console[name] = fn;
    }
  });
});
