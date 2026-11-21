import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { absoluteImage, sendToExtension } from "@/components/poster/extension-bridge";
import { ExtensionDownload } from "@/components/poster/extension-download";
import {
  GROUPS,
  captionFlags,
  groupsFor,
  listingFields,
  marketLine,
  money,
  miles,
  shareBlurb,
  titleOf,
  verdict,
  type StyleName,
  type Vehicle,
} from "@/lib/poster/model";
import { captionFor, nextPrice, usePoster } from "@/lib/poster/store";
import { Photo } from "@/components/poster/photo";
import { dailyPostLimit, type PlanId } from "@/lib/business/plans";
import { newBackground, rewordPost } from "@/lib/poster/ai.functions";

const STYLES: { id: StyleName; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
  { id: "short", label: "Short" },
];

export function PostDesk({ now, plan = "basic" }: { now: number; plan?: PlanId }) {
  const vehicle = usePoster((s) => s.vehicles.find((car) => car.id === s.selectedId) ?? null);
  const vehicles = usePoster((s) => s.vehicles);
  const style = usePoster((s) => s.style);
  const drafts = usePoster((s) => s.drafts);
  const setStyle = usePoster((s) => s.setStyle);
  const setDraft = usePoster((s) => s.setDraft);
  const clearDraft = usePoster((s) => s.clearDraft);
  const markPosted = usePoster((s) => s.markPosted);
  const markPulled = usePoster((s) => s.markPulled);
  const markRefreshed = usePoster((s) => s.markRefreshed);
  const markSold = usePoster((s) => s.markSold);
  const applyPrice = usePoster((s) => s.applyPrice);
  const setNote = usePoster((s) => s.setNote);
  const select = usePoster((s) => s.select);
  const storeName = usePoster((s) => s.storeName);
  const storeCity = usePoster((s) => s.storeCity);
  const store = { name: storeName, city: storeCity };
  const [cover, setCover] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [aiBusy, setAiBusy] = useState("");
  const selectedId = usePoster((s) => s.selectedId);
  useEffect(() => {
    setCover("");
    setAiNote("");
  }, [selectedId]);

  if (!vehicle) {
    return (
      <section className="py-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Pick a car</h1>
        <p className="mt-2 max-w-md text-muted">Open one from today’s plan or the lot. The listing card fills from there.</p>
      </section>
    );
  }

  const advanced = plan !== "basic";
  const postsToday = vehicles.filter((car) => postedToday(car.postedAt, now)).length;
  const dailyCap = dailyPostLimit(plan);
  const atDailyLimit = dailyCap !== null && postsToday >= dailyCap && !postedToday(vehicle.postedAt, now);
  const styles = STYLES.filter((item) => advanced || item.id === "short");
  const activeStyle = styles.some((item) => item.id === style) ? style : styles[0].id;
  const built = captionFor(vehicle, activeStyle, drafts, store);
  const flags = captionFlags(built.text, vehicle);
  const call = verdict(vehicle, now);
  const suggested = nextPrice(vehicle, now);
  const posting = cover ? { ...vehicle, imageUrls: [cover, ...vehicle.imageUrls.filter((url) => url !== cover)] } : vehicle;
  const others = vehicles.filter((car) => car.id !== vehicle.id);

  return (
    <section className="grid gap-6 py-5 md:grid-cols-2">
      <div className="contents md:block">
        <div>
          <Gallery vehicle={posting} />
          {plan === "plus" && <Backgrounds vehicle={vehicle} busy={aiBusy} onBusy={setAiBusy} onNote={setAiNote} onCover={setCover} />}
          <p className="mt-4 text-xs font-medium text-amber">{kindLabel(call.kind, vehicle)}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{titleOf(vehicle)}</h1>
          <p className="mt-1 text-lg tabular-nums">
            {money(vehicle.price)}
            <span className="text-muted"> · {miles(vehicle.mileage)}</span>
          </p>
          <p className="mt-2 text-sm text-muted">{call.reason}</p>
          {marketLine(vehicle) && <p className="mt-1 text-sm">{marketLine(vehicle)}</p>}
          {vehicle.notes && <p className="mt-3 text-sm text-muted">{vehicle.notes}</p>}
          {dailyCap !== null && (
            <p className="mt-3 text-sm text-muted">
              {atDailyLimit
                ? `${plan === "premium" ? "Premium" : "Basic"} is ${dailyCap} posts a day. This one waits until tomorrow.`
                : `${plan === "premium" ? "Premium" : "Basic"} is ${dailyCap} posts a day. ${postsToday} of ${dailyCap} used today.`}
            </p>
          )}
        </div>
        <div className="order-3 md:order-none">
          <div className="mt-4 flex flex-wrap gap-2">
            {call.kind === "pull" && (
              <button
                type="button"
                className="min-h-11 rounded-full bg-brake px-4 text-sm font-semibold text-fg"
                onClick={() => markPulled(vehicle.id)}
              >
                Mark pulled
              </button>
            )}
            {call.kind === "post" && (
              <button
                type="button"
                className="min-h-11 rounded-full bg-amber px-4 text-sm font-semibold text-ink disabled:opacity-60"
                disabled={atDailyLimit}
                onClick={() => markPosted(vehicle.id)}
              >
                Mark posted
              </button>
            )}
            {call.kind === "refresh" && (
              <button
                type="button"
                className="min-h-11 rounded-full bg-amber px-4 text-sm font-semibold text-ink"
                onClick={() => markRefreshed(vehicle.id)}
              >
                Mark refreshed
              </button>
            )}
            {vehicle.status === "stock" && (
              <button
                type="button"
                className="min-h-11 rounded-full border border-line px-4 text-sm"
                onClick={() => markSold(vehicle.id)}
              >
                Mark sold on the lot
              </button>
            )}
            {advanced && suggested !== null && (
              <button
                type="button"
                className="min-h-11 rounded-full border border-line px-4 text-sm"
                onClick={() => applyPrice(vehicle.id, suggested)}
              >
                Use {money(suggested)}
              </button>
            )}
          </div>
          {advanced && suggested !== null && (
            <p className="mt-2 text-sm text-muted">
              Suggested ask {money(suggested)}. Similar cars are near {money(vehicle.market)}.
            </p>
          )}

          <label className="mt-5 block text-sm text-muted" htmlFor="note">
            Note on this car
          </label>
          <input
            id="note"
            value={vehicle.notes}
            onChange={(e) => setNote(vehicle.id, e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
          />

          <div className="mt-6">
            <h2 className="font-display text-lg font-semibold">Also on the lot</h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {others.map((car) => (
                <li key={car.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm"
                    onClick={() => select(car.id)}
                  >
                    <span>{titleOf(car)}</span>
                    <span className="tabular-nums text-muted">{money(car.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="order-2 md:order-none">
        <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-surface p-1">
          {styles.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "min-h-11 rounded-full text-sm",
                activeStyle === item.id ? "bg-amber font-semibold text-ink" : "text-muted",
              )}
              onClick={() => setStyle(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {built.dropped.length > 0 && (
          <p className="mt-3 text-sm text-brake">
            Left out of the caption: {built.dropped.join(", ")}. Those lines stay in the dealer blurb, not the post.
          </p>
        )}
        {flags.length > 0 && (
          <ul className="mt-2 text-sm text-brake">
            {flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        )}

        <label className="mt-3 block text-sm text-muted" htmlFor="caption">
          Caption
        </label>
        <textarea
          id="caption"
          value={built.text}
          onChange={(e) => setDraft(vehicle.id, activeStyle, e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-2xl border border-line bg-surface p-3 text-sm"
        />
        <div className="mt-2 flex gap-2">
          <CopyButton label="Copy caption" value={built.text} />
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm disabled:opacity-60"
            disabled={aiBusy === "reword"}
            onClick={() => {
              setAiBusy("reword");
              setAiNote("");
              void rewordPost({ data: { text: built.text, advanced } })
                .then((result) => {
                  if (result.ok) setDraft(vehicle.id, activeStyle, result.text);
                  else setAiNote(result.error);
                })
                .catch(() => setAiNote("Couldn’t reword that."))
                .finally(() => setAiBusy(""));
            }}
          >
            {aiBusy === "reword" ? "Rewording…" : "Reword"}
          </button>
          {built.edited && (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm"
              onClick={() => clearDraft(vehicle.id, activeStyle)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        {aiNote && <p className="mt-2 text-sm text-brake">{aiNote}</p>}
        <FacebookFill vehicle={posting} caption={built.text} blocked={atDailyLimit} cap={dailyCap} />
        <ListingCard vehicle={posting} caption={built.text} />
        {advanced && <Groups vehicle={vehicle} />}
      </div>
    </section>
  );
}

function FacebookFill({
  vehicle,
  caption,
  blocked,
  cap,
}: {
  vehicle: Vehicle;
  caption: string;
  blocked: boolean;
  cap: number | null;
}) {
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "sent" | "missing">("idle");

  async function fill() {
    setBusy(true);
    const packet = {
      id: vehicle.id,
      title: titleOf(vehicle),
      year: String(vehicle.year),
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      vin: vehicle.vin,
      vehicleType: "Car/Truck",
      price: String(vehicle.price),
      mileage: vehicle.mileage ? String(vehicle.mileage) : "",
      body: vehicle.body,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      exterior: vehicle.exterior,
      interior: vehicle.interior,
      description: caption,
      imageUrls: vehicle.imageUrls.map(absoluteImage).filter((url) => /^https?:\/\//i.test(url)),
    };
    const ok = await sendToExtension(packet);
    setState(ok ? "sent" : "missing");
    setBusy(false);
  }

  return (
    <div className="mt-6 rounded-2xl border border-amber bg-surface p-4">
      <h2 className="font-display text-lg font-semibold">Facebook</h2>
      <p className="mt-1 text-sm text-muted">
        The Chrome extension opens Marketplace and types this listing in. It does not press Publish.
      </p>
      <button
        type="button"
        className="mt-3 min-h-11 rounded-full bg-amber px-4 text-sm font-semibold text-ink disabled:opacity-60"
        onClick={() => void fill()}
        disabled={busy || blocked}
      >
        {busy ? "Opening Facebook…" : "Fill on Facebook"}
      </button>
        {blocked && cap !== null && <p className="mt-2 text-sm text-muted">This plan stops at {cap} posts a day.</p>}
      {state === "sent" && (
        <p className="mt-2 text-sm text-amber">
          Facebook should open on the vehicle form. Review it, publish there, then mark this car posted.
        </p>
      )}
      {state === "missing" && (
        <div className="mt-3 text-sm text-muted">
          <p>
            Chrome can’t see the desk from inside this chat. Open the desk in its own tab, click the NextStep extension
            so it says Desk connected, then press Fill again.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <ExtensionDownload>Download the extension</ExtensionDownload> and unzip it.
            </li>
            <li>Open chrome://extensions and turn on Developer mode.</li>
            <li>Click Load unpacked and choose that folder.</li>
            <li>Come back to this car and press Fill on Facebook again.</li>
          </ol>
        </div>
      )}
    </div>
  );
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

function kindLabel(kind: string, vehicle: Vehicle): string {
  if (vehicle.status === "sold" && !vehicle.fbLive) return "Pulled";
  if (kind === "pull") return "Pull";
  if (kind === "post") return "Post next";
  if (kind === "refresh") return "Refresh";
  if (kind === "blocked") return "Blocked";
  return "Hold";
}

function Gallery({ vehicle }: { vehicle: Vehicle }) {
  const [index, setIndex] = useState(0);
  const photos = vehicle.imageUrls;
  const src = photos[index];
  return (
    <div>
      <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-line">
        <Photo src={src} alt={titleOf(vehicle)} />
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              className={cn("h-11 w-16 overflow-hidden rounded-lg border", i === index ? "border-amber" : "border-line")}
              onClick={() => setIndex(i)}
              aria-label={`Photo ${i + 1}`}
            >
              <Photo src={url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Backgrounds({
  vehicle,
  busy,
  onBusy,
  onNote,
  onCover,
}: {
  vehicle: Vehicle;
  busy: string;
  onBusy: (value: string) => void;
  onNote: (value: string) => void;
  onCover: (url: string) => void;
}) {
  const scenes = [
    { id: "lot", label: "Dealer row" },
    { id: "street", label: "Street" },
    { id: "afternoon", label: "Afternoon" },
  ];
  const photo = vehicle.imageUrls.find((url) => url.startsWith("https://"));

  function run(scene: string) {
    if (!photo) {
      onNote("This car needs a photo with a public link.");
      return;
    }
    onBusy(scene);
    onNote("");
    void newBackground({ data: { imageUrl: photo, scene } })
      .then((result) => {
        if (result.ok) onCover(result.url);
        else onNote(result.error);
      })
      .catch(() => onNote("Couldn’t make that background."))
      .finally(() => onBusy(""));
  }

  return (
    <div className="mt-3">
      <p className="text-sm text-muted">New background. The car stays the same.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            className="min-h-11 rounded-full border border-line px-3 text-sm disabled:opacity-60"
            disabled={busy !== ""}
            onClick={() => run(scene.id)}
          >
            {busy === scene.id ? "Working…" : scene.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ListingCard({ vehicle, caption }: { vehicle: Vehicle; caption: string }) {
  const storeName = usePoster((s) => s.storeName);
  const storeCity = usePoster((s) => s.storeCity);
  const fields = useMemo(
    () => listingFields(vehicle, caption, { name: storeName, city: storeCity }),
    [vehicle, caption, storeName, storeCity],
  );
  const [filled, setFilled] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setFilled(0);
    setPlaying(false);
  }, [vehicle.id, caption]);

  useEffect(() => {
    if (!playing) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFilled(fields.length);
      setPlaying(false);
      return;
    }
    const id = window.setInterval(() => {
      setFilled((count) => {
        if (count >= fields.length) {
          window.clearInterval(id);
          setPlaying(false);
          return count;
        }
        return count + 1;
      });
    }, 280);
    return () => window.clearInterval(id);
  }, [playing, fields.length]);

  const done = filled >= fields.length && filled > 0;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Listing card</h2>
          <p className="text-sm text-muted">Same fields the extension types in. You still hit Publish.</p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-full bg-amber px-4 text-sm font-semibold text-ink"
          onClick={() => {
            setFilled(0);
            setPlaying(true);
          }}
        >
          {playing ? "Filling" : done ? "Fill again" : "Fill card"}
        </button>
      </div>
      <ol className="mt-3" aria-live="polite">
        {fields.map((field, i) => {
          const show = i < filled;
          return (
            <li key={field.label} className="border-t border-line">
              <button
                type="button"
                className="flex min-h-11 w-full items-start justify-between gap-3 py-2 text-left"
                onClick={() => {
                  if (show) void navigator.clipboard.writeText(field.value);
                }}
                disabled={!show}
              >
                <span>
                  <span className="block text-xs text-muted">{field.label}</span>
                  <span className={cn("block text-sm", field.label === "Description" && "line-clamp-3")}>
                    {show ? field.value : "—"}
                  </span>
                </span>
                {show && <Check className="mt-1 size-4 shrink-0 text-amber" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      {done && <p className="pt-2 text-sm text-muted">Card filled. Review it, then publish on Marketplace yourself.</p>}
    </div>
  );
}

function Groups({ vehicle }: { vehicle: Vehicle }) {
  const storeName = usePoster((s) => s.storeName);
  const storeCity = usePoster((s) => s.storeCity);
  const suggested = groupsFor(vehicle);
  const [picked, setPicked] = useState<string[]>(suggested);
  useEffect(() => {
    setPicked(groupsFor(vehicle));
  }, [vehicle.id]);
  const blurb = shareBlurb(vehicle, { name: storeName, city: storeCity });
  return (
    <div className="mt-6">
      <h2 className="font-display text-lg font-semibold">After publish, share here</h2>
      <p className="mt-1 text-sm text-muted">Two groups that match this body style. Shift the checkboxes if you know a better room.</p>
      <ul className="mt-2">
        {GROUPS.map((group) => {
          const on = picked.includes(group.id);
          return (
            <li key={group.id} className="border-t border-line">
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
                onClick={() =>
                  setPicked((cur) => (cur.includes(group.id) ? cur.filter((id) => id !== group.id) : [...cur, group.id]))
                }
                aria-pressed={on}
              >
                <span>
                  <span className="block text-sm">{group.name}</span>
                  <span className="block text-xs text-muted">{group.members} members</span>
                </span>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-md border",
                    on ? "border-amber bg-amber text-ink" : "border-line",
                  )}
                >
                  {on && <Check className="size-3" aria-hidden="true" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm">{blurb}</p>
      <div className="mt-2">
        <CopyButton label="Copy group note" value={blurb} />
      </div>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="min-h-11 rounded-full border border-line px-4 text-sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}
