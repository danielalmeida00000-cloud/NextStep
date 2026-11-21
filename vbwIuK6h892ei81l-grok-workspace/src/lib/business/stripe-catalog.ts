import type { PlanId, TermId } from "@/lib/business/plans";

/** Live Prices on the NextStep Stripe account. One product per plan. */
export const STRIPE_PRICES: Record<`${PlanId}:${TermId}`, string> = {
  "basic:month": "price_1UeFiHQWPRrCB9F4hYiAmSlz",
  "basic:half": "price_1UeFiHQWPRrCB9F4djHpJ4NA",
  "basic:year": "price_1UeFiGQWPRrCB9F4RVgd7bqa",
  "premium:month": "price_1UeFiGQWPRrCB9F4nFChSh2Z",
  "premium:half": "price_1UeFiFQWPRrCB9F424cZFw85",
  "premium:year": "price_1UeFiEQWPRrCB9F45wtroBdk",
  "plus:month": "price_1UeFiGQWPRrCB9F4TVHO5UnF",
  "plus:half": "price_1UeFiGQWPRrCB9F4HoWcXdzQ",
  "plus:year": "price_1UeFiFQWPRrCB9F4LQfyqAqi",
};

export function stripePriceId(plan: PlanId, term: TermId): string {
  return STRIPE_PRICES[`${plan}:${term}`];
}
