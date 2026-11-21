import { useState } from "react";
import { money, weekCounts, type LogItem, type Vehicle } from "@/lib/poster/model";
import { usePoster } from "@/lib/poster/store";

export function Desk({ now }: { now: number }) {
  const vehicles = usePoster((s) => s.vehicles);
  const logs = usePoster((s) => s.logs);
  const reset = usePoster((s) => s.reset);
  const counts = weekCounts(logs, now);
  const max = Math.max(1, ...counts.map((d) => d.count));
  const postedWeek = counts.reduce((sum, d) => sum + d.count, 0);
  const live = vehicles.filter((v) => v.fbLive && v.status === "stock");
  const pulls = vehicles.filter((v) => v.status === "sold" && v.fbLive);
  const leads = vehicles.reduce((sum, v) => sum + v.leads, 0);
  const [confirm, setConfirm] = useState(false);

  return (
    <section className="py-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">The desk</h1>
      <p className="mt-2 max-w-xl text-muted">
        The lot ranks itself. Sold cars come off first. New posts go up one an hour. You still press Publish.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Posts, 7 days" value={String(postedWeek)} />
        <Stat label="Live now" value={String(live.length)} />
        <Stat label="Still public, sold" value={String(pulls.length)} />
        <Stat label="Messages on live cars" value={String(leads)} />
      </dl>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-display text-lg font-semibold">Pace</h2>
        <p className="text-sm text-muted">One bar is a day of posts. Empty today means the plan is still in front of you.</p>
        <div className="mt-4 flex h-28 items-end gap-2">
          {counts.map((day, i) => (
            <div key={`${day.label}-${i}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-20 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-amber"
                  style={{ height: `${Math.max(8, (day.count / max) * 100)}%`, opacity: day.count ? 1 : 0.25 }}
                />
              </div>
              <span className="text-xs text-muted">
                {day.label}
                <span className="sr-only"> {day.count} posts</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <LogList title="Recent" logs={logs.slice(0, 8)} vehicles={vehicles} />
        <div>
          <h2 className="font-display text-lg font-semibold">This lot</h2>
          <p className="mt-2 text-sm text-muted">
            Clearing removes every car and the post history on this desk. Pull the dealer link again to bring the lot back.
          </p>
          <div className="mt-5">
            {confirm ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-full bg-brake px-4 text-sm font-semibold text-fg"
                  onClick={() => {
                    reset();
                    setConfirm(false);
                  }}
                >
                  Clear the lot
                </button>
                <button type="button" className="min-h-11 rounded-full border border-line px-4 text-sm" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="min-h-11 rounded-full border border-line px-4 text-sm" onClick={() => setConfirm(true)}>
                Clear the lot
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function LogList({ title, logs, vehicles }: { title: string; logs: LogItem[]; vehicles: Vehicle[] }) {
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <ul className="mt-2">
        {logs.map((item) => {
          const car = vehicles.find((v) => v.id === item.vehicleId);
          return (
            <li key={item.id} className="border-t border-line py-3 text-sm">
              <span className="block">{item.detail}</span>
              <span className="text-muted">
                {car ? money(car.price) : "Earlier this week"} · {item.kind}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

