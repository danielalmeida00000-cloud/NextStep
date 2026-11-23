import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  buildCaption,
  extractFromText,
  suggestPrice,
  vehiclesFromCsv,
  titleOf,
  type LogItem,
  type StoreLine,
  type StyleName,
  type Vehicle,
} from "@/lib/poster/model";

export type TabId = "today" | "lot" | "post" | "desk" | "remove";

type State = {
  vehicles: Vehicle[];
  logs: LogItem[];
  tab: TabId;
  selectedId: string;
  style: StyleName;
  drafts: Record<string, Partial<Record<StyleName, string>>>;
  storeName: string;
  storeCity: string;
  dealerUrl: string;
  applyDealerPull: (incoming: Vehicle[], url: string, truncated: boolean) => { arrived: string[]; sold: string[]; added: number };
  select: (id: string, tab?: TabId) => void;
  setTab: (tab: TabId) => void;
  setStyle: (style: StyleName) => void;
  setDraft: (id: string, style: StyleName, text: string) => void;
  clearDraft: (id: string, style: StyleName) => void;
  markPosted: (id: string) => void;
  markPulled: (id: string) => void;
  markRefreshed: (id: string) => void;
  markSold: (id: string) => void;
  applyPrice: (id: string, price: number) => void;
  setNote: (id: string, notes: string) => void;
  addVehicles: (incoming: Vehicle[]) => void;
  importCsv: (text: string) => number;
  importText: (text: string) => number;
  setStore: (name: string, city: string) => void;
  removeVehicles: (ids: string[]) => void;
  reset: () => void;
};

function log(vehicleId: string, kind: LogItem["kind"], detail: string): LogItem {
  return {
    id: `log-${kind}-${vehicleId}-${Date.now()}`,
    vehicleId,
    kind,
    at: new Date().toISOString(),
    detail,
  };
}

const initialVehicles: Vehicle[] = [];

export const usePoster = create<State>()(
  persist(
    (set) => ({
      vehicles: initialVehicles,
      logs: [],
      tab: "today",
      selectedId: "",
      style: "professional",
      drafts: {},
      storeName: "",
      storeCity: "",
      dealerUrl: "",
      applyDealerPull: (incoming, url, truncated) => {
        const summary = { arrived: [] as string[], sold: [] as string[], added: 0 };
        set((s) => {
          const host = hostname(url);
          const page = dealerPage(url);
          const same = !s.dealerUrl || hostname(s.dealerUrl) === host;
          const tracked = s.vehicles.filter((car) => {
            if (!car.fromDealer || car.status !== "stock") return false;
            if (car.dealerPage) return car.dealerPage === page;
            if (car.dealerHost) return car.dealerHost === host && dealerPage(s.dealerUrl) === page;
            return same && hostname(s.dealerUrl) === host && dealerPage(s.dealerUrl) === page;
          });
          const hadDealerCars = tracked.length > 0;
          const incomingKeys = new Set(incoming.map(carKey));
          const overlap = tracked.filter((car) => incomingKeys.has(carKey(car))).length;
          // Sold marks stay on this inventory page. Another page, or a pull that
          // shares none of its cars, is not proof the rest of the lot left.
          const canMarkSold =
            hadDealerCars &&
            !truncated &&
            overlap > 0 &&
            incoming.length >= Math.ceil(tracked.length * 0.8);
          const soldIds = new Set<string>();
          if (canMarkSold) {
            for (const car of tracked) {
              if (!incomingKeys.has(carKey(car))) soldIds.add(car.id);
            }
          }
          for (const fresh of incoming) {
            if (fresh.status !== "sold") continue;
            const match = s.vehicles.find((car) => carKey(car) === carKey(fresh));
            if (match) soldIds.add(match.id);
          }
          const existingKeys = new Set(s.vehicles.map(carKey));
          const nowIso = new Date().toISOString();
          const arrived = incoming.filter((car) => car.status !== "sold" && !existingKeys.has(carKey(car)));
          let vehicles = s.vehicles.map((car) => {
            const fresh = incoming.find((item) => carKey(item) === carKey(car));
            const sold = soldIds.has(car.id);
            if (!fresh && !sold) return car;
            return {
              ...car,
              ...(fresh
                ? {
                    mileage: car.mileage || fresh.mileage,
                    price: fresh.price || car.price,
                    trim: car.trim || fresh.trim,
                    exterior: car.exterior || fresh.exterior,
                    interior: car.interior || fresh.interior,
                    imageUrls: car.imageUrls.length ? car.imageUrls : fresh.imageUrls,
                    description: car.description || fresh.description,
                    fromDealer: true,
                    dealerHost: host,
                    dealerPage: page,
                  }
                : {}),
              status: sold ? ("sold" as const) : car.status,
              soldByDealer: sold ? true : car.soldByDealer,
            };
          });
          const addedCars = arrived.map((car) => ({
            ...car,
            fromDealer: true,
            dealerHost: host,
            dealerPage: page,
            arrivedAt: hadDealerCars ? nowIso : null,
          }));
          vehicles = [...vehicles, ...addedCars];
          summary.arrived = addedCars.filter((car) => car.arrivedAt).map((car) => titleOf(car));
          summary.sold = vehicles.filter((car) => soldIds.has(car.id)).map((car) => titleOf(car));
          summary.added = addedCars.length;
          return { vehicles, dealerUrl: url || s.dealerUrl };
        });
        return summary;
      },
      select: (id, tab) => set({ selectedId: id, ...(tab ? { tab } : {}) }),
      setTab: (tab) => set({ tab }),
      setStyle: (style) => set({ style }),
      setDraft: (id, style, text) =>
        set((s) => ({
          drafts: { ...s.drafts, [id]: { ...s.drafts[id], [style]: text } },
        })),
      clearDraft: (id, style) =>
        set((s) => {
          const next = { ...s.drafts[id] };
          delete next[style];
          return { drafts: { ...s.drafts, [id]: next } };
        }),
      markPosted: (id) =>
        set((s) => {
          const v = s.vehicles.find((car) => car.id === id);
          if (!v || v.status === "sold") return s;
          return {
            vehicles: s.vehicles.map((car) =>
              car.id === id ? { ...car, postedAt: new Date().toISOString(), fbLive: true } : car,
            ),
            logs: [log(id, "posted", `Posted ${v.year} ${v.make} ${v.model}`), ...s.logs],
          };
        }),
      markPulled: (id) =>
        set((s) => {
          const v = s.vehicles.find((car) => car.id === id);
          if (!v) return s;
          return {
            vehicles: s.vehicles.map((car) => (car.id === id ? { ...car, fbLive: false } : car)),
            logs: [log(id, "pulled", `Pulled ${v.year} ${v.make} ${v.model}`), ...s.logs],
          };
        }),
      markRefreshed: (id) =>
        set((s) => {
          const v = s.vehicles.find((car) => car.id === id);
          if (!v) return s;
          return {
            vehicles: s.vehicles.map((car) =>
              car.id === id ? { ...car, postedAt: new Date().toISOString(), fbLive: true } : car,
            ),
            logs: [log(id, "refreshed", `Refreshed ${v.year} ${v.make} ${v.model}`), ...s.logs],
          };
        }),
      markSold: (id) =>
        set((s) => ({
          vehicles: s.vehicles.map((car) => (car.id === id ? { ...car, status: "sold" } : car)),
        })),
      applyPrice: (id, price) =>
        set((s) => {
          const v = s.vehicles.find((car) => car.id === id);
          if (!v) return s;
          return {
            vehicles: s.vehicles.map((car) => (car.id === id ? { ...car, price } : car)),
            logs: [log(id, "priced", `Priced ${v.year} ${v.model} at $${price}`), ...s.logs],
          };
        }),
      setNote: (id, notes) =>
        set((s) => ({
          vehicles: s.vehicles.map((car) => (car.id === id ? { ...car, notes } : car)),
        })),
      addVehicles: (incoming) =>
        set((s) => {
          const incomingByVin = new Map(incoming.filter((car) => car.vin).map((car) => [car.vin, car]));
          const vehicles = s.vehicles.map((car) => {
            const fresh = car.vin ? incomingByVin.get(car.vin) : undefined;
            if (!fresh) return car;
            return {
              ...car,
              mileage: car.mileage || fresh.mileage,
              price: car.price || fresh.price,
              trim: car.trim || fresh.trim,
              exterior: car.exterior || fresh.exterior,
              interior: car.interior || fresh.interior,
              imageUrls: car.imageUrls.length ? car.imageUrls : fresh.imageUrls,
              description: car.description || fresh.description,
            };
          });
          const ids = new Set(vehicles.map((v) => v.id));
          const vins = new Set(vehicles.map((v) => v.vin).filter(Boolean));
          const added = incoming.filter((v) => !ids.has(v.id) && !(v.vin && vins.has(v.vin)));
          return { vehicles: [...vehicles, ...added] };
        }),
      importCsv: (text) => {
        const parsed = vehiclesFromCsv(text);
        let added = 0;
        set((s) => {
          const vins = new Set(s.vehicles.map((v) => v.vin).filter(Boolean));
          const fresh = parsed.filter((v) => !(v.vin && vins.has(v.vin)));
          added = fresh.length;
          return { vehicles: [...s.vehicles, ...fresh] };
        });
        return added;
      },
      importText: (text) => {
        const parsed = extractFromText(text);
        let added = 0;
        set((s) => {
          const vins = new Set(s.vehicles.map((v) => v.vin).filter(Boolean));
          const fresh = parsed.filter((v) => !(v.vin && vins.has(v.vin)));
          added = fresh.length;
          return { vehicles: [...s.vehicles, ...fresh] };
        });
        return added;
      },
      setStore: (name, city) => set({ storeName: name, storeCity: city }),
      removeVehicles: (ids) =>
        set((s) => {
          const drop = new Set(ids);
          const vehicles = s.vehicles.filter((car) => !drop.has(car.id));
          const selectedId = drop.has(s.selectedId) ? (vehicles[0]?.id ?? "") : s.selectedId;
          return { vehicles, selectedId };
        }),
      reset: () =>
        set({
          vehicles: [],
          logs: [],
          tab: "lot",
          selectedId: "",
          drafts: {},
        }),
    }),
    {
      name: "car-poster-pro",
      version: 4,
      skipHydration: true,
      migrate: (persisted) => {
        const prev = persisted && typeof persisted === "object" ? (persisted as Partial<State>) : {};
        const seed = new Set(["crv", "rav4", "f150", "equinox", "camry", "wrangler", "accord", "civic", "rogue"]);
        const vehicles = Array.isArray(prev.vehicles) ? prev.vehicles : [];
        const sample = vehicles.length > 0 && vehicles.every((car) => seed.has(car.id));
        return {
          vehicles: sample ? [] : vehicles,
          logs: sample || !Array.isArray(prev.logs) ? [] : prev.logs,
          tab: prev.tab || "today",
          selectedId: sample ? "" : prev.selectedId || "",
          style: prev.style || "professional",
          drafts: prev.drafts || {},
          storeName: prev.storeName || "",
          storeCity: prev.storeCity || "",
          dealerUrl: prev.dealerUrl || "",
        };
      },
      partialize: (s) => ({
        vehicles: s.vehicles,
        logs: s.logs,
        tab: s.tab,
        selectedId: s.selectedId,
        style: s.style,
        drafts: s.drafts,
        storeName: s.storeName,
        storeCity: s.storeCity,
        dealerUrl: s.dealerUrl,
      }),
    },
  ),
);

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function dealerPage(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${host}${path}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function carKey(car: Vehicle) {
  if (car.vin) return `v:${car.vin.toUpperCase()}`;
  if (car.stock) return `s:${car.stock.toUpperCase()}`;
  return `n:${car.year}|${car.make}|${car.model}|${car.trim}`.toLowerCase();
}

export function captionFor(
  v: Vehicle,
  style: StyleName,
  drafts: State["drafts"],
  store: StoreLine = { name: "", city: "" },
): { text: string; dropped: string[]; edited: boolean } {
  const edited = drafts[v.id]?.[style];
  if (edited !== undefined) return { text: edited, dropped: buildCaption(v, style, store).dropped, edited: true };
  const built = buildCaption(v, style, store);
  return { ...built, edited: false };
}

export function nextPrice(v: Vehicle, now: number): number | null {
  return suggestPrice(v, now);
}
