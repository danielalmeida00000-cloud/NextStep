import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInGate } from "@/lib/auth/gates";
import { PLANS } from "@/lib/business/plans";
import { SiteFrame } from "@/components/site/chrome";
import { useAccess } from "@/components/site/use-access";

const STEPS = [
  {
    n: "01",
    title: "Paste the dealer link",
    body: "The lot comes in with the year, price, miles, and photos. Sold cars go to the top so you pull them first.",
  },
  {
    n: "02",
    title: "Read the post",
    body: "Basic gives you a plain caption you can reword. Premium writes a fuller one. Plus can change the background, not the car.",
  },
  {
    n: "03",
    title: "Fill Marketplace",
    body: "The extension drops the listing into Facebook. You check it. You press Publish. Nothing goes up while you sleep.",
  },
];

const SAMPLES = [
  { src: "/demo/cx5.jpg", title: "2021 Mazda CX-5", line: "Touring · 41,280 miles · $24,900" },
  { src: "/demo/tucson.jpg", title: "2020 Hyundai Tucson", line: "SEL · 52,110 miles · $19,400" },
  { src: "/demo/outback.jpg", title: "2019 Subaru Outback", line: "Limited · 63,440 miles · $21,200" },
];

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { access } = useAccess();
  return (
    <SiteFrame>
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-amber">For one salesperson</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Post the right car. Pull the sold one.
        </h1>
        <p className="mt-4 text-lg text-muted">
          NextStep pulls a dealer’s inventory, writes a caption that sounds like you, and fills Facebook Marketplace. The
          desk is yours. The publish button stays yours.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SignInGate
            fallback={
              <Link to="/login" className="inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink">
                Start with a plan
              </Link>
            }
          >
            <DeskEntry />
          </SignInGate>
          {!access?.allowed ? (
            <a href="#plans" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm">
              See the plans
            </a>
          ) : (
            <Link to="/reminders" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm">
              Reminders
            </Link>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-8 md:grid-cols-3">
        {STEPS.map((step) => (
          <article key={step.n}>
            <p className="font-display text-sm text-amber">{step.n}</p>
            <h2 className="mt-2 font-display text-xl font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-muted">{step.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">What a post starts from</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">Examples of the photo and line a listing starts from. Your dealer link replaces them.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {SAMPLES.map((car) => (
            <li key={car.src} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <img src={car.src} alt="" className="aspect-[3/2] w-full object-cover" />
              <div className="p-4">
                <p className="font-medium">{car.title}</p>
                <p className="mt-1 text-sm text-muted">{car.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {!access?.allowed ? (
      <section id="plans" className="mt-14 scroll-mt-20">
        <h2 className="font-display text-2xl font-semibold">Plans</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The $40 Basic plan is free for 7 days, then $40 a month. A card is required to start it. Six-month and yearly prices are charged when you pay. Cancel the free trial yourself before day 7 or the card is charged.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col rounded-2xl border bg-surface p-5 ${plan.id === "premium" ? "border-amber" : "border-line"}`}
            >
              {plan.id === "premium" ? <p className="text-sm font-medium text-amber">Most reps start here</p> : null}
              <h3 className="mt-1 font-display text-2xl font-semibold">{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                ${plan.price}
                <span className="text-base font-normal text-muted"> / month</span>
              </p>
              <p className="mt-1 text-sm tabular-nums text-muted">6 months ${plan.half}</p>
              {plan.id === "basic" ? <p className="mt-1 text-sm font-medium text-amber">7 days free, then $40. A card is required.</p> : null}
              <p className="text-sm tabular-nums text-muted">12 months ${plan.year}</p>
              <p className="mt-3 text-sm text-muted">{plan.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link
                to="/subscribe"
                search={{ plan: plan.id }}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-amber px-4 text-sm font-semibold text-ink"
              >
                Get {plan.name}
              </Link>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      <section className="mt-14 max-w-2xl border-t border-line pt-8">
        <h2 className="font-display text-2xl font-semibold">What it will not do</h2>
        <p className="mt-2 text-sm text-muted">
          It will not post while you are away, message buyers, or log into Facebook for you. You stay on your own
          account, and you press Publish.
        </p>
      </section>
    </SiteFrame>
  );
}

function DeskEntry() {
  const { access } = useAccess();
  if (!access) return <p className="text-sm text-muted">Checking your plan…</p>;
  if (!access.allowed) {
    return (
      <Link to="/subscribe" className="inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink">
        Choose a plan
      </Link>
    );
  }
  return (
    <Link to="/desk" className="inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink">
      Open the desk
    </Link>
  );
}
