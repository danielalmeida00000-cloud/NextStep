import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Gauge, LayoutList, Rows3, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ExtensionBridge, useExtensionReady } from "@/components/poster/extension-bridge";
import { ExtensionDownload } from "@/components/poster/extension-download";
import { pullDealerUrl } from "@/lib/poster/pull.functions";
import {
  blockedVehicles,
  buildPlan,
  headline,
  holdingVehicles,
  marketLine,
  miles,
  money,
  titleOf,
  verdict,
  type Vehicle,
} from "@/lib/poster/model";
import { usePoster, type TabId } from "@/lib/poster/store";
import { Photo } from "@/components/poster/photo";
import { PostDesk } from "@/components/poster/post-desk";
import { Desk } from "@/components/poster/desk";
import { RemoveLot } from "@/components/poster/remove-lot";
import { UserButton } from "@/lib/auth/gates";
import { Link } from "@tanstack/react-router";
import type { PlanId } from "@/lib/business/plans";
import { planById } from "@/lib/business/plans";

const TABS: { id: TabId; label: string; icon: typeof Gauge }[] = [
  { id: "today", label: "Today", icon: LayoutList },
  { id: "lot", label: "Lot", icon: Rows3 },
  { id: "post", label: "Post", icon: ClipboardList },
  { id: "remove", label: "Remove", icon: Trash2 },
  { id: "desk", label: "Desk", icon: Gauge },
];

export function PosterApp({ owner = false, plan = "basic" }: { owner?: boolean; plan?: PlanId }) {
  const [now, setNow] = useState<number | null>(null);
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
    return () => {
      live = false;
    };
  }, []);

  if (now === null) {
    return (
      <main className="min-h-dvh bg-bg px-4 py-8 text-fg">
        <h1 className="font-display text-3xl font-semibold">NextStep Automotive Solutions</h1>
        <p className="mt-2 text-muted">Your store name shows here after a dealer link.</p>
      </main>
    );
  }

  return <Shell now={now} owner={owner} plan={plan} />;
}

function Shell({ now, owner, plan }: { now: number; owner: boolean; plan: PlanId }) {
  const tab = usePoster((s) => s.tab);
  const setTab = usePoster((s) => s.setTab);
  const storeName = usePoster((s) => s.storeName);
  const storeCity = usePoster((s) => s.storeCity);
  const storeLine = [storeName, storeCity].filter(Boolean).join(" · ");
  const extension = useExtensionReady();
  const tabs = TABS;
  const shown = tabs.some((item) => item.id === tab) ? tab : "lot";
  const planName = planById(plan).name;
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">NextStep Automotive Solutions</p>
            <p className="text-sm text-muted">
              {planName} plan
              {storeLine ? ` · ${storeLine}` : ""}
              {extension === true ? " · Extension on" : extension === false ? " · Open this desk in its own Chrome tab" : ""}
            </p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              {owner ? (
                <Link to="/admin" className="text-amber">
                  Admin
                </Link>
              ) : null}
              <Link to="/reminders" className="text-muted">
                Reminders
              </Link>
              <Link to="/" className="text-muted">
                Site
              </Link>
              <UserButton />
            </div>
          </div>
          <ExtensionDownload prominent>Download extension</ExtensionDownload>
        </div>
      </header>
      <ExtensionBridge />
      <main className="mx-auto w-full max-w-5xl px-4 pb-28">
        {shown === "today" && <Today now={now} />}
        {shown === "lot" && <Lot now={now} />}
        {shown === "post" && <PostDesk now={now} plan={plan} />}
        {shown === "remove" && <RemoveLot />}
        {shown === "desk" && <Desk now={now} />}
      </main>
      <nav className="dock fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg" aria-label="Sections">
        <ul className="mx-auto flex max-w-5xl">
          {tabs.map((item) => {
            const Icon = item.icon;
            const on = shown === item.id;
            return (
              <li key={item.id} className="flex-1">
                <button
                  type="button"
                  className={cn(
                    "flex min-h-14 w-full flex-col items-center justify-center gap-1 text-xs",
                    on ? "text-amber" : "text-muted",
                  )}
                  onClick={() => setTab(item.id)}
                  aria-current={on ? "page" : undefined}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Today({ now }: { now: number }) {
  const vehicles = usePoster((s) => s.vehicles);
  const select = usePoster((s) => s.select);
  const setTab = usePoster((s) => s.setTab);
  const plan = useMemo(() => buildPlan(vehicles, now), [vehicles, now]);
  const lead = headline(vehicles, now);
  const blocked = blockedVehicles(vehicles, now);
  const holding = holdingVehicles(vehicles, now);
  const firstPost = plan.find((item) => item.kind !== "pull");
  const later = Boolean(firstPost && !/^\d/.test(firstPost.when));

  return (
    <section className="py-5">
      <p className="text-sm text-amber">{new Date(now).toLocaleDateString("en-US", { weekday: "long" })} desk</p>
      <h1 className="mt-1 max-w-xl font-display text-3xl font-semibold tracking-tight">{lead.title}</h1>
      <p className="mt-2 max-w-xl text-muted">{lead.lede}</p>
      <button type="button" className="mt-3 min-h-11 text-sm text-amber" onClick={() => setTab("lot")}>
        Pull cars from a dealer URL
      </button>

      <div className="mt-6 grid gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          {plan.length === 0 && <p className="text-sm text-muted">No pulls, posts, or refreshes.</p>}
          <ol className="space-y-3">
            {plan.map((item, index) => {
              const car = vehicles.find((v) => v.id === item.vehicleId);
              if (!car) return null;
              const showBreak = index > 0 && item.kind !== "pull" && plan[index - 1]?.kind === "pull" && later;
              return (
                <li key={item.vehicleId}>
                  {showBreak && (
                    <p className="mb-3 text-sm text-muted">Next morning, one an hour. Nothing else goes up tonight.</p>
                  )}
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 rounded-2xl border bg-surface p-3 text-left",
                      index === 0 ? "border-amber" : "border-line",
                    )}
                    onClick={() => select(car.id, "post")}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <Photo src={car.imageUrls[0]} alt="" />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("text-xs font-medium", item.kind === "pull" ? "text-brake" : "text-amber")}>
                          {item.kind === "pull" ? "Pull" : item.kind === "post" ? "Post" : "Refresh"}
                        </span>
                        <span className="text-xs tabular-nums text-muted">{item.when}</span>
                      </span>
                      <span className="mt-1 block font-medium">{titleOf(car)}</span>
                      <span className="mt-1 block text-sm text-muted">
                        {money(car.price)} · {car.daysOnLot} days
                        {marketLine(car) ? ` · ${marketLine(car)}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <aside className="space-y-6 md:col-span-2">
          <SideList title="Leave up" cars={holding} now={now} />
          <SideList title="Can’t post yet" cars={blocked} now={now} />
        </aside>
      </div>
    </section>
  );
}

function SideList({ title, cars, now }: { title: string; cars: Vehicle[]; now: number }) {
  const select = usePoster((s) => s.select);
  if (cars.length === 0) return null;
  return (
    <div>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <ul className="mt-2">
        {cars.map((car) => (
          <li key={car.id} className="border-t border-line">
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
              onClick={() => select(car.id, "post")}
            >
              <span>
                <span className="block text-sm">{titleOf(car)}</span>
                <span className="block text-xs text-muted">{verdict(car, now).reason}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "post", label: "Unposted" },
  { id: "live", label: "Live" },
  { id: "sold", label: "Sold" },
  { id: "blocked", label: "No photos" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function Lot({ now }: { now: number }) {
  const vehicles = usePoster((s) => s.vehicles);
  const select = usePoster((s) => s.select);
  const importCsv = usePoster((s) => s.importCsv);
  const importText = usePoster((s) => s.importText);
  const addVehicles = usePoster((s) => s.addVehicles);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const shown = vehicles.filter((car) => {
    const blob = `${titleOf(car)} ${car.vin} ${car.stock}`.toLowerCase();
    if (q && !blob.includes(q.toLowerCase())) return false;
    const call = verdict(car, now).kind;
    if (filter === "post") return !car.postedAt && car.status === "stock";
    if (filter === "live") return car.fbLive;
    if (filter === "sold") return car.status === "sold";
    if (filter === "blocked") return call === "blocked";
    return true;
  });

  return (
    <section className="py-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">The lot</h1>
          <p className="mt-1 text-sm text-muted">{vehicles.length} cars on this desk</p>
        </div>
        <button type="button" className="min-h-11 rounded-full bg-amber px-4 text-sm font-semibold text-ink" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Add cars"}
        </button>
      </div>

      <DealerPull />

      {open && (
        <AddCars
          onCsv={(text) => {
            const n = importCsv(text);
            setNotice(n ? `Added ${n} from the CSV.` : "Nothing new in that CSV.");
            setOpen(false);
          }}
          onPaste={(text) => {
            const n = importText(text);
            setNotice(n ? `Added ${n} from the pasted page.` : "No vehicles found in that text.");
            setOpen(false);
          }}
          onOne={(car) => {
            addVehicles([car]);
            setNotice(`Added ${titleOf(car)}.`);
            setOpen(false);
            select(car.id, "post");
          }}
        />
      )}
      {notice && <p className="mt-3 text-sm text-amber">{notice}</p>}

      <label className="mt-4 block text-sm text-muted" htmlFor="search">
        Search
      </label>
      <input
        id="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Year, make, stock, VIN"
        className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm",
              filter === item.id ? "border-amber bg-amber text-ink" : "border-line text-muted",
            )}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ul className="mt-4">
        {shown.length === 0 && <li className="py-6 text-sm text-muted">No cars match.</li>}
        {shown.map((car) => {
          const call = verdict(car, now);
          return (
            <li key={car.id} className="border-t border-line">
              <button
                type="button"
                className="flex w-full items-center gap-3 py-3 text-left"
                onClick={() => select(car.id, "post")}
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <Photo src={car.imageUrls[0]} alt="" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{titleOf(car)}</span>
                  <span className="block text-sm tabular-nums text-muted">
                    {money(car.price)} · {miles(car.mileage)}
                  </span>
                </span>
                <span className={cn("text-xs", call.kind === "pull" || car.soldByDealer ? "text-brake" : car.arrivedAt && !car.postedAt ? "text-amber" : "text-muted")}>
                  {car.soldByDealer && car.status === "sold"
                    ? "Dealer sold"
                    : car.arrivedAt && !car.postedAt
                      ? "New"
                      : call.kind === "pull"
                        ? "Pull"
                        : call.kind === "post"
                          ? "Post"
                          : call.kind === "refresh"
                            ? "Refresh"
                            : call.kind === "blocked"
                              ? "No photo"
                              : "Hold"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DealerPull() {
  const applyDealerPull = usePoster((s) => s.applyDealerPull);
  const dealerUrl = usePoster((s) => s.dealerUrl);
  const select = usePoster((s) => s.select);
  const storeName = usePoster((s) => s.storeName);
  const storeCity = usePoster((s) => s.storeCity);
  const setStore = usePoster((s) => s.setStore);
  const [url, setUrl] = useState(dealerUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [found, setFound] = useState<Vehicle[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    if (dealerUrl) setUrl((current) => current || dealerUrl);
  }, [dealerUrl]);

  async function run(target: string) {
    const value = target.trim();
    if (!value) {
      setError("Paste a dealer link.");
      return;
    }
    setBusy(true);
    setError("");
    setNote("");
    try {
      const result = await pullDealerUrl({ data: { url: value } });
      setFound(result.vehicles);
      setPicked(result.vehicles.map((car) => car.id));
      setTruncated(Boolean(result.truncated));
      setUrl(value);
      if (result.dealer?.name || result.dealer?.city) {
        const current = usePoster.getState();
        setStore(result.dealer.name || current.storeName, result.dealer.city || current.storeCity);
      }
      if (result.vehicles.length) setNote(result.note);
      else setError(result.note);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn’t pull that page.";
      setError(message || "Couldn’t pull that page.");
    } finally {
      setBusy(false);
    }
  }

  function addChosen() {
    const chosen = found.filter((car) => picked.includes(car.id));
    const partial = picked.length !== found.length;
    const summary = applyDealerPull(chosen, url, truncated || partial);
    setFound([]);
    const parts = [];
    if (summary.arrived.length) parts.push(`New on the lot: ${summary.arrived.join(", ")}.`);
    if (summary.sold.length) parts.push(`Dealer marked sold: ${summary.sold.join(", ")}. Pull them if they’re still on Facebook.`);
    if (!summary.arrived.length && !summary.sold.length && summary.added) parts.push(`Added ${summary.added} to the lot.`);
    if (truncated) parts.push("This page was only part of the inventory, so missing cars were not marked sold.");
    setNote(parts.join(" ") || "No new cars, and nothing newly sold.");
    if (summary.added === 1) {
      const added = usePoster.getState().vehicles.find((car) => car.arrivedAt);
      if (added) select(added.id, "post");
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-semibold">Your store</h2>
      <p className="mt-1 text-sm text-muted">
        Captions use this name. It was never your store before. A dealer link fills it from the site, and you can correct it.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          value={storeName}
          onChange={(event) => setStore(event.target.value, storeCity)}
          placeholder="Store name"
          aria-label="Store name"
          className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <input
          value={storeCity}
          onChange={(event) => setStore(storeName, event.target.value)}
          placeholder="City"
          aria-label="City"
          className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm"
        />
      </div>
      <h2 className="mt-5 font-display text-lg font-semibold">Dealer website</h2>
      <p className="mt-1 text-sm text-muted">
        Paste the inventory link. Cars land here, then the plan tells you what to post. On a dealer site that only finishes loading in the browser, open that page in Chrome and use Pull this page in the extension.
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void run(url);
        }}
      >
        <label className="sr-only" htmlFor="dealer-url">
          Dealer inventory URL
        </label>
        <input
          id="dealer-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://dealer.com/used-inventory"
          inputMode="url"
          className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 shrink-0 rounded-full bg-amber px-4 text-sm font-semibold text-ink"
        >
          {busy ? "Pulling…" : "Pull cars"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-brake">{error}</p>}
      {note && !error && <p className="mt-2 text-sm text-amber">{note}</p>}
      {found.length > 0 && (
        <div className="mt-3">
          <ul>
            {found.map((car) => {
              const on = picked.includes(car.id);
              return (
                <li key={car.id} className="border-t border-line">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-amber"
                      checked={on}
                      onChange={() =>
                        setPicked((cur) => (cur.includes(car.id) ? cur.filter((id) => id !== car.id) : [...cur, car.id]))
                      }
                    />
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                      <Photo src={car.imageUrls[0]} alt="" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{titleOf(car)}</span>
                      <span className="block text-xs tabular-nums text-muted">
                        {money(car.price)} · {miles(car.mileage)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-full bg-amber px-4 text-sm font-semibold text-ink"
            onClick={addChosen}
            disabled={picked.length === 0}
          >
            Add {picked.length || ""} to the lot
          </button>
        </div>
      )}
      <p className="mt-3 text-sm text-muted">
        <ExtensionDownload>Download the Chrome extension</ExtensionDownload>
        . Unzip it, open chrome://extensions, turn on Developer mode, then Load unpacked.
      </p>
    </div>
  );
}

function AddCars({
  onCsv,
  onPaste,
  onOne,
}: {
  onCsv: (text: string) => void;
  onPaste: (text: string) => void;
  onOne: (car: Vehicle) => void;
}) {
  const [paste, setPaste] = useState("");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">CSV</h2>
        <p className="text-sm text-muted">Columns: year, make, model, price, mileage, vin.</p>
        <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-4 text-sm">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then(onCsv);
            }}
          />
        </label>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold">Paste a dealer page</h2>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={4}
          placeholder={"2021 Honda CR-V\n$24,989\n38,412 miles"}
          className="mt-2 w-full rounded-xl border border-line bg-bg p-3 text-sm"
        />
        <button type="button" className="mt-2 min-h-11 rounded-full border border-line px-4 text-sm" onClick={() => onPaste(paste)}>
          Extract vehicles
        </button>
      </div>
      <form
        className="grid gap-2 sm:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const y = Number(year);
          const p = Number(price.replace(/[$,]/g, ""));
          const m = Number(mileage.replace(/,/g, ""));
          if (!y || !make.trim() || !model.trim()) return;
          onOne({
            id: `manual-${y}-${make}-${model}-${Date.now()}`,
            year: y,
            make: make.trim(),
            model: model.trim(),
            trim: "",
            price: Number.isFinite(p) ? p : 0,
            mileage: Number.isFinite(m) ? m : 0,
            vin: "",
            stock: "",
            exterior: "",
            interior: "",
            transmission: "Automatic",
            fuel: "Gasoline",
            body: "SUV",
            description: "",
            imageUrls: [],
            notes: "",
            status: "stock",
            daysOnLot: 1,
            market: Number.isFinite(p) ? p : 0,
            postedAt: null,
            fbLive: false,
            leads: 0,
          });
        }}
      >
        <h2 className="font-display text-lg font-semibold sm:col-span-5">One car</h2>
        <input required value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm" />
        <input required value={make} onChange={(e) => setMake(e.target.value)} placeholder="Make" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm" />
        <input required value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm" />
        <input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="Miles" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm" />
        <button type="submit" className="min-h-11 rounded-full bg-amber px-4 text-sm font-semibold text-ink sm:col-span-5 sm:w-fit">
          Add to the lot
        </button>
      </form>
    </div>
  );
}
