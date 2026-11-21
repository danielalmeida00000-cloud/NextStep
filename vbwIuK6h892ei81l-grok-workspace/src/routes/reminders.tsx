import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { SiteFrame } from "@/components/site/chrome";
import { useAccess } from "@/components/site/use-access";
import { dailyPostLimit } from "@/lib/business/plans";
import { titleOf, verdict, type Vehicle } from "@/lib/poster/model";
import { usePoster } from "@/lib/poster/store";

export const Route = createFileRoute("/reminders")({ component: RemindersPage });

function RemindersPage() {
  const { user, isPending, access, error } = useAccess();
  const vehicles = usePoster((s) => s.vehicles);
  const [now, setNow] = useState<number | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    let live = true;
    const finish = () => {
      if (live) setNow(Date.now());
    };
    try {
      void Promise.resolve(usePoster.persist.rehydrate()).then(finish, finish);
    } catch {
      finish();
    }
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    setPerm("Notification" in window ? Notification.permission : "unsupported");
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (now === null || perm !== "granted") return;
    const notes = buildReminders(vehicles, now, access?.plan ?? "basic");
    for (const note of notes) {
      if (!note.ping || !due(note.id, note.gap)) continue;
      try {
        new Notification(note.title, { body: note.body });
      } catch {
        /* the page list still shows it */
      }
    }
  }, [now, perm, vehicles, access?.plan]);

  if (isPending || now === null || (user && !access && !error)) {
    return (
      <SiteFrame>
        <p className="text-muted">Loading reminders…</p>
      </SiteFrame>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (error) {
    return (
      <SiteFrame>
        <p className="text-brake">{error}</p>
      </SiteFrame>
    );
  }
  if (!access?.allowed) {
    return (
      <SiteFrame>
        <h1 className="font-display text-3xl font-semibold">Reminders start after a plan</h1>
        <Link to="/subscribe" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-amber px-5 font-semibold text-ink">
          Choose a plan
        </Link>
      </SiteFrame>
    );
  }

  const notes = buildReminders(vehicles, now, access.plan);

  return (
    <SiteFrame>
      <h1 className="font-display text-3xl font-semibold">Reminders</h1>
      <p className="mt-2 max-w-xl text-muted">
        Post another car each hour, check what’s still listed, pull a sold car, and confirm nothing left the lot.
      </p>
      {perm === "default" ? (
        <button
          type="button"
          className="mt-4 min-h-11 rounded-full border border-line px-4 text-sm"
          onClick={() => {
            void Notification.requestPermission().then((next) => setPerm(next));
          }}
        >
          Turn on notifications
        </button>
      ) : null}
      <ul className="mt-8 space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-medium">{note.title}</p>
            <p className="mt-1 text-sm text-muted">{note.body}</p>
            {note.href ? (
              <Link to="/desk" className="mt-3 inline-flex text-sm text-amber">
                Open the desk
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </SiteFrame>
  );
}

type Note = { id: string; title: string; body: string; ping: boolean; gap: number; href?: boolean };

function buildReminders(vehicles: Vehicle[], now: number, plan: "basic" | "premium" | "plus"): Note[] {
  const notes: Note[] = [];
  const dealerSold = vehicles.filter((car) => car.soldByDealer && car.status === "sold");
  if (dealerSold.length) {
    notes.push({
      id: `dealer-sold-${dealerSold.map((car) => car.id).join("-")}`,
      title: dealerSold.length === 1 ? "The dealer marked a car sold" : `The dealer marked ${dealerSold.length} cars sold`,
      body: `${dealerSold
        .slice(0, 6)
        .map((car) => titleOf(car))
        .join(", ")}. Pull any that are still on Facebook.`,
      ping: true,
      gap: 60 * 60 * 1000,
      href: true,
    });
  }
  const arrived = vehicles.filter((car) => car.arrivedAt && car.status === "stock" && !car.postedAt);
  if (arrived.length) {
    notes.push({
      id: `arrived-${arrived.map((car) => car.id).join("-")}`,
      title: arrived.length === 1 ? "A new car arrived on the lot" : `${arrived.length} new cars arrived on the lot`,
      body: arrived
        .slice(0, 6)
        .map((car) => titleOf(car))
        .join(", "),
      ping: true,
      gap: 3 * 60 * 60 * 1000,
      href: true,
    });
  }
  const cap = dailyPostLimit(plan);
  const posted = vehicles.filter((car) => postedToday(car.postedAt, now)).length;
  const last = latestPost(vehicles);
  const hourGone = last === null || now - last >= 60 * 60 * 1000;
  const room = cap === null || posted < cap;
  const waiting = vehicles.some((car) => verdict(car, now).kind === "post");
  if (room && waiting && hourGone) {
    notes.push({
      id: "post-hour",
      title: "Post another car",
      body: last === null ? "Nothing has been posted yet. One car an hour." : "An hour has passed since the last post.",
      ping: true,
      gap: 60 * 60 * 1000,
      href: true,
    });
  } else if (!room && cap !== null) {
    notes.push({
      id: "post-cap",
      title: "Daily posts are used",
      body: `${posted} of ${cap} posts used today. The next one waits until tomorrow.`,
      ping: false,
      gap: 0,
    });
  } else if (!hourGone && last !== null) {
    const mins = Math.max(1, Math.ceil((60 * 60 * 1000 - (now - last)) / 60000));
    notes.push({
      id: "post-wait",
      title: "Next post is on the hour",
      body: `About ${mins} minutes until the next one.`,
      ping: false,
      gap: 0,
    });
  }

  const listed = vehicles.filter((car) => car.fbLive && car.status === "stock");
  notes.push({
    id: "listed",
    title: listed.length ? `Check ${listed.length} listed ${listed.length === 1 ? "car" : "cars"}` : "No cars are listed",
    body: listed.length
      ? listed
          .slice(0, 4)
          .map((car) => titleOf(car))
          .join(", ")
      : "When a car is on Marketplace, it shows up here to check.",
    ping: listed.length > 0,
    gap: 3 * 60 * 60 * 1000,
    href: listed.length > 0,
  });

  const pulls = vehicles.filter((car) => verdict(car, now).kind === "pull");
  if (pulls.length) {
    notes.push({
      id: `pull-${pulls.map((car) => car.id).join("-")}`,
      title: pulls.length === 1 ? "Pull this car" : `Pull ${pulls.length} cars`,
      body: pulls.map((car) => titleOf(car)).join(", ") + ". Sold on the lot and still public.",
      ping: true,
      gap: 60 * 60 * 1000,
      href: true,
    });
  }

  if (listed.length) {
    notes.push({
      id: "sold-check",
      title: "Check if a listed car has sold",
      body: "Open each live listing. If the car left the lot, mark it sold, then pull the post.",
      ping: true,
      gap: 3 * 60 * 60 * 1000,
      href: true,
    });
  }

  return notes;
}

function latestPost(vehicles: Vehicle[]) {
  let max = 0;
  for (const car of vehicles) {
    const time = car.postedAt ? Date.parse(car.postedAt) : 0;
    if (time > max) max = time;
  }
  return max || null;
}

function postedToday(iso: string | null, now: number) {
  if (!iso) return false;
  const posted = new Date(iso);
  const today = new Date(now);
  return (
    posted.getFullYear() === today.getFullYear() &&
    posted.getMonth() === today.getMonth() &&
    posted.getDate() === today.getDate()
  );
}

function due(id: string, gap: number) {
  const key = `nextstep-reminder-${id}`;
  const last = Number(localStorage.getItem(key) || 0);
  if (Date.now() - last < gap) return false;
  localStorage.setItem(key, String(Date.now()));
  return true;
}
