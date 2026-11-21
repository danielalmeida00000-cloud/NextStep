import { useMemo, useState } from "react";
import { miles, money, titleOf } from "@/lib/poster/model";
import { usePoster } from "@/lib/poster/store";
import { Photo } from "@/components/poster/photo";

export function RemoveLot() {
  const vehicles = usePoster((s) => s.vehicles);
  const removeVehicles = usePoster((s) => s.removeVehicles);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles.filter((car) => {
      if (!q) return true;
      return `${titleOf(car)} ${car.vin} ${car.stock}`.toLowerCase().includes(q);
    });
  }, [vehicles, query]);

  function toggle(id: string) {
    setConfirm(false);
    setPicked((cur) => (cur.includes(id) ? cur.filter((item) => item !== id) : [...cur, id]));
  }

  function remove() {
    removeVehicles(picked);
    setPicked([]);
    setConfirm(false);
  }

  return (
    <section className="py-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Remove from the lot</h1>
      <p className="mt-2 max-w-xl text-muted">
        Take a car off this desk. That does not delete the Facebook post. If it is still live, pull it first.
      </p>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the lot"
        aria-label="Search cars to remove"
        className="mt-4 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
      />
      {shown.length === 0 ? (
        <p className="mt-6 text-muted">Nothing on the lot matches.</p>
      ) : (
        <ul className="mt-3">
          {shown.map((car) => {
            const on = picked.includes(car.id);
            return (
              <li key={car.id} className="border-t border-line">
                <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-amber"
                    checked={on}
                    onChange={() => toggle(car.id)}
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
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {confirm ? (
          <>
            <button
              type="button"
              className="min-h-11 rounded-full bg-brake px-4 text-sm font-semibold text-fg"
              onClick={remove}
            >
              Remove {picked.length} from the lot
            </button>
            <button type="button" className="min-h-11 text-sm text-muted" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="min-h-11 rounded-full bg-brake px-4 text-sm font-semibold text-fg disabled:opacity-50"
            disabled={picked.length === 0}
            onClick={() => setConfirm(true)}
          >
            Remove selected
          </button>
        )}
      </div>
    </section>
  );
}
