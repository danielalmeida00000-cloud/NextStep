import { createFileRoute } from "@tanstack/react-router";
import { SiteFrame } from "@/components/site/chrome";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <SiteFrame>
      <article className="max-w-2xl">
        <h1 className="font-display text-3xl font-semibold">Terms</h1>
        <p className="mt-2 text-sm text-muted">NextStep Automotive Solutions · November 21, 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-6">
          <section>
            <h2 className="font-display text-xl font-semibold">What you are paying for</h2>
            <p className="mt-2 text-muted">
              NextStep is software. It pulls vehicles from a dealer page you choose, helps you write a Marketplace caption, and fills the Facebook form. You press Publish. It does not log into Facebook, message buyers, or post while you are away.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold">Facebook is your account</h2>
            <p className="mt-2 text-muted">
              You post from your own personal Facebook profile, on a device you control. A dealership Page cannot create Marketplace vehicle listings. NextStep does not own, operate, or insure your Facebook account.
            </p>
            <p className="mt-2 text-muted">
              Facebook can remove a listing, limit Marketplace, or disable an account for its own reasons. Those reasons include posting too many cars at once, repeating the same car, a price or description that does not match the vehicle, photos that are not the real car, or a new account posting a lot of inventory. Filling in the year, vehicle type, or VIN does not cause that. How you post can.
            </p>
            <p className="mt-2 text-muted">
              If Facebook restricts or bans your account, that is between you and Facebook. NextStep is not responsible, and it is not a reason for a refund or a card dispute.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold">No refund for a ban</h2>
            <p className="mt-2 text-muted">
              You agree not to ask your bank to charge back, reverse, or dispute a payment because a listing was removed, a buyer did not answer, a car did not sell, or Facebook limited or banned the account. The service you bought is access to the software. Once that access is on, the charge stands for the term you picked.
            </p>
            <p className="mt-2 text-muted">
              A bank can still let a cardholder open a dispute. If you do, NextStep will contest it with these terms and the record that the account was active. Winning a dispute is up to the bank, not this page.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold">You check the listing</h2>
            <p className="mt-2 text-muted">
              Captions and backgrounds are drafts. You confirm the year, price, miles, VIN, and that every photo is the actual vehicle before you publish. An edited background must not hide damage or change the car. NextStep does not promise sales, leads, or that Facebook will keep a listing up.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold">Plans and canceling</h2>
            <p className="mt-2 text-muted">
              Basic is $40 a month, $200 for 6 months, or $360 for 12 months. The $40 monthly plan starts with 7 days free, and a card is required before it starts. Nothing is charged on day one. The $40 charge starts when those 7 days end unless you cancel first. If no card is on file, the trial ends and the plan does not continue. The 6-month and 12-month Basic prices are charged when you pay. Basic includes 5 posts a day. Premium is $75, $400, or $750, with 10 posts a day and three caption styles. Premium Plus is $100, $500, or $850, with unlimited posts and a realistic background behind the real car. Premium and Premium Plus are charged when you pay. The longer terms renew at the end of that term, not every month.
            </p>
            <p className="mt-2 text-muted">
              Canceling is your job. If you do not want to keep the subscription, you must cancel it yourself in Manage billing within 7 days of the charge. NextStep will not cancel it for you. After those 7 days, or if you forget to cancel, the charge is not refunded. A term that has already been paid is not refunded.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl font-semibold">Contact</h2>
            <p className="mt-2 text-muted">
              Questions go to{" "}
              <a className="text-fg" href="mailto:nextstep.automotive.solutions@gmail.com">
                nextstep.automotive.solutions@gmail.com
              </a>
              . Paying, or creating an account, means you agree to these terms.
            </p>
          </section>
        </div>
      </article>
    </SiteFrame>
  );
}
