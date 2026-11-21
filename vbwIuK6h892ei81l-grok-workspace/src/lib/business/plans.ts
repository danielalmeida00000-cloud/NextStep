export const PLAN_IDS = ["basic", "premium", "plus"] as const;
export const TERM_IDS = ["month", "half", "year"] as const;

export type PlanId = (typeof PLAN_IDS)[number];
export type TermId = (typeof TERM_IDS)[number];

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  half: number;
  year: number;
  blurb: string;
  includes: string[];
};

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 40,
    half: 200,
    year: 360,
    blurb: "Five posts a day. The $40 monthly plan is free for 7 days.",
    includes: [
      "7 days free on the $40 monthly plan. A card is required",
      "5 posts a day, then it stops until tomorrow",
      "Pull cars from a dealer link",
      "Plain caption and one-tap reword",
      "Extension fills the Facebook form",
      "You still press Publish",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 75,
    half: 400,
    year: 750,
    blurb: "Ten posts a day, written three ways, in a voice that reads like a person.",
    includes: [
      "10 posts a day, then it stops until tomorrow",
      "Everything in Basic",
      "Professional, casual, and short captions",
      "Price note and a group list",
      "You still press Publish",
    ],
  },
  {
    id: "plus",
    name: "Premium Plus",
    price: 100,
    half: 500,
    year: 850,
    blurb: "Unlimited posts, plus a realistic background behind the real car.",
    includes: [
      "Everything in Premium",
      "Dealer lot, street, or afternoon light",
      "The car itself is not changed",
      "One photo at a time",
      "You still press Publish",
    ],
  },
];

export function isPlanId(value: string): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}

export function isTermId(value: string): value is TermId {
  return TERM_IDS.includes(value as TermId);
}

export function normalizePlan(value: string | null | undefined): PlanId {
  if (value === "simple") return "basic";
  if (value === "mid") return "premium";
  if (value === "full" || value === "desk") return "plus";
  return isPlanId(value ?? "") ? (value as PlanId) : "basic";
}

export function normalizeTerm(value: string | null | undefined): TermId {
  return isTermId(value ?? "") ? (value as TermId) : "month";
}

export function dailyPostLimit(plan: PlanId): number | null {
  if (plan === "basic") return 5;
  if (plan === "premium") return 10;
  return null;
}

export function planById(id: string): Plan {
  return PLANS.find((plan) => plan.id === normalizePlan(id)) ?? PLANS[0];
}

export function termPrice(plan: Plan, term: TermId): number {
  if (term === "half") return plan.half;
  if (term === "year") return plan.year;
  return plan.price;
}

export function termLabel(term: string): string {
  if (term === "half") return "6 months";
  if (term === "year") return "12 months";
  return "Monthly";
}
