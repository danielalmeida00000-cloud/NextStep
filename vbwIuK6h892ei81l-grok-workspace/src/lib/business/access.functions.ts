import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { isPlanId, isTermId, normalizePlan, normalizeTerm, type PlanId, type TermId } from "@/lib/business/plans";
import { stripeRequest, stripeSecret } from "@/lib/business/stripe.server";

export type Access = {
  role: "owner" | "member";
  status: "none" | "pending" | "active" | "canceled";
  plan: PlanId;
  term: TermId;
  allowed: boolean;
};

export type Subscriber = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  plan: string;
  term: string;
  amountCents: number;
  paid: boolean;
};

const STATUSES = ["none", "pending", "active", "canceled"] as const;
type Status = (typeof STATUSES)[number];

function asStatus(value: string | null | undefined): Status {
  return STATUSES.includes(value as Status) ? (value as Status) : "none";
}

function toAccess(
  role: string | null | undefined,
  status: string | null | undefined,
  plan: string | null | undefined,
  term: string | null | undefined,
): Access {
  const owner = role === "owner";
  const state = asStatus(status);
  return {
    role: owner ? "owner" : "member",
    status: owner ? "active" : state,
    plan: owner ? "plus" : normalizePlan(plan),
    term: normalizeTerm(term),
    allowed: owner || state === "active",
  };
}

export const loadAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Access> => {
    const sql = await getSql();
    await sql`
      insert into profiles (user_id, role)
      select ${context.userId}, case when exists (select 1 from profiles where role = 'owner') then 'member' else 'owner' end
      where not exists (select 1 from profiles where user_id = ${context.userId})
    `;
    await sql`
      insert into subscriptions (user_id, status, plan)
      select p.user_id,
        case when p.role = 'owner' then 'active' else 'none' end,
        case when p.role = 'owner' then 'plus' else 'basic' end
      from profiles p
      where p.user_id = ${context.userId}
      on conflict (user_id) do nothing
    `;
    return loadRow(context.userId);
  });

export const requestSubscription = createServerFn({ method: "POST" })
  .validator((input: { plan: string; term: string }) => {
    const plan = String(input?.plan ?? "");
    const term = String(input?.term ?? "");
    if (!isPlanId(plan) || !isTermId(term)) throw new Error("Pick a plan and how long you’re paying.");
    return { plan, term };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<Access> => {
    const sql = await getSql();
    await sql`
      update subscriptions
      set plan = ${data.plan}, term = ${data.term}, status = 'pending', updated_at = now()
      where user_id = ${context.userId}
        and status in ('none', 'canceled', 'pending')
    `;
    return loadRow(context.userId);
  });

export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Subscriber[]> => {
    await requireOwner(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      user_id: string;
      name: string | null;
      email: string | null;
      role: string;
      status: string | null;
      plan: string | null;
      term: string | null;
      amount_cents: number | null;
      stripe_subscription_id: string | null;
    }>`
      select p.user_id, u.name, u.email, p.role, s.status, s.plan, s.term, s.amount_cents, s.stripe_subscription_id
      from profiles p
      left join subscriptions s on s.user_id = p.user_id
      left join "user" u on u.id = p.user_id
      order by p.created_at
    `;
    return rows.map((row) => ({
      userId: row.user_id,
      name: row.name || "No name",
      email: row.email || "No email",
      role: row.role,
      status: row.status || "none",
      plan: normalizePlan(row.plan),
      term: normalizeTerm(row.term),
      amountCents: Number(row.amount_cents ?? 0),
      paid: Boolean(row.stripe_subscription_id),
    }));
  });

export const setSubscription = createServerFn({ method: "POST" })
  .validator((input: { userId: string; status: string; plan: string; term: string }) => {
    const userId = String(input?.userId ?? "").trim();
    const status = String(input?.status ?? "");
    const plan = String(input?.plan ?? "");
    const term = String(input?.term ?? "");
    if (!userId || !STATUSES.includes(status as Status) || !isPlanId(plan) || !isTermId(term)) {
      throw new Error("Bad subscription.");
    }
    return { userId, status: status as Status, plan, term };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireOwner(context.userId);
    const sql = await getSql();
    const target = await sql<{ role: string }>`select role from profiles where user_id = ${data.userId}`;
    if (!target[0]) throw new Error("That account is not on the site.");
    if (target[0].role === "owner") return { ok: true };
    if (data.status === "canceled" && stripeSecret()) {
      const current = await sql<{ stripe_subscription_id: string | null }>`
        select stripe_subscription_id from subscriptions where user_id = ${data.userId}
      `;
      const stripeId = current[0]?.stripe_subscription_id;
      if (stripeId) await stripeRequest(`subscriptions/${stripeId}`, undefined, "DELETE");
    }
    await sql`
      insert into subscriptions (user_id, status, plan, term)
      values (${data.userId}, ${data.status}, ${data.plan}, ${data.term})
      on conflict (user_id) do update set status = ${data.status}, plan = ${data.plan}, term = ${data.term}, updated_at = now()
    `;
    return { ok: true };
  });

async function requireOwner(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`select role from profiles where user_id = ${userId}`;
  if (rows[0]?.role !== "owner") throw new Error("Only the owner can do that.");
}

export async function readAccess(userId: string): Promise<Access> {
  return loadRow(userId);
}

async function loadRow(userId: string): Promise<Access> {
  const sql = await getSql();
  const rows = await sql<{ role: string; status: string; plan: string; term: string }>`
    select p.role, s.status, s.plan, s.term
    from profiles p
    join subscriptions s on s.user_id = p.user_id
    where p.user_id = ${userId}
  `;
  const row = rows[0];
  return toAccess(row?.role, row?.status, row?.plan, row?.term);
}
