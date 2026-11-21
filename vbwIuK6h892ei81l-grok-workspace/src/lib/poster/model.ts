export type StyleName = "professional" | "casual" | "short";
export type VehicleStatus = "stock" | "sold";
export type LogKind = "posted" | "pulled" | "priced" | "refreshed";

export type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  price: number;
  mileage: number;
  vin: string;
  stock: string;
  exterior: string;
  interior: string;
  transmission: string;
  fuel: string;
  body: string;
  description: string;
  imageUrls: string[];
  notes: string;
  status: VehicleStatus;
  daysOnLot: number;
  market: number;
  postedAt: string | null;
  fbLive: boolean;
  leads: number;
  fromDealer?: boolean;
  dealerHost?: string;
  soldByDealer?: boolean;
  arrivedAt?: string | null;
};

export type LogItem = {
  id: string;
  vehicleId: string;
  kind: LogKind;
  at: string;
  detail: string;
};

export type PlanKind = "pull" | "post" | "refresh";

export type PlanItem = {
  vehicleId: string;
  kind: PlanKind;
  reason: string;
  score: number;
  when: string;
};

export const STORE_NAME = "";
export const STORE_CITY = "";

export type StoreLine = { name: string; city: string };
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

const RISKY: { re: RegExp; label: string }[] = [
  { re: /guaranteed approval/i, label: "Guaranteed approval" },
  { re: /no credit check/i, label: "No-credit-check claim" },
  { re: /best price in/i, label: "“Best price” claim" },
  { re: /won['’]?t last/i, label: "Urgency spam" },
  { re: /act now/i, label: "Urgency spam" },
  { re: /no money down/i, label: "Financing promise" },
  { re: /nobody.{0,20}(declin|turn)/i, label: "Nobody-declined claim" },
  { re: /bad credit ok/i, label: "Credit guarantee" },
];

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function miles(n: number): string {
  if (!n) return "Miles not listed";
  return `${new Intl.NumberFormat("en-US").format(n)} mi`;
}

export function titleOf(v: Pick<Vehicle, "year" | "make" | "model" | "trim">): string {
  return [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
}

export function ageHours(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return (now - new Date(iso).getTime()) / HOUR_MS;
}

export function ageLabel(iso: string | null, now: number): string {
  const h = ageHours(iso, now);
  if (h === null) return "Not posted";
  if (h < 24) return "Posted today";
  const d = Math.floor(h / 24);
  return d === 1 ? "Posted 1 day ago" : `Posted ${d} days ago`;
}

function ago(days: number, hours = 4): string {
  return new Date(Date.now() - (days * 24 + hours) * HOUR_MS).toISOString();
}

function inferBody(model: string): string {
  if (/f-150|silverado|ram|sierra|tundra|tacoma|ranger/i.test(model)) return "Truck";
  if (/wrangler|cr-v|rav4|equinox|rogue|explorer|tahoe|pilot|highlander/i.test(model)) return "SUV";
  if (/camry|accord|civic|altima|sentra|malibu|corolla/i.test(model)) return "Sedan";
  return "SUV";
}

export function seedVehicles(): Vehicle[] {
  return [
    {
      id: "crv",
      year: 2021,
      make: "Honda",
      model: "CR-V",
      trim: "EX",
      price: 24989,
      mileage: 38412,
      vin: "1HGCY2F53MA123456",
      stock: "A1234",
      exterior: "White",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "SUV",
      description:
        "One-owner CR-V EX with Honda Sensing, sunroof, and leather. Clean service history.",
      imageUrls: [
        "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1400&q=80",
      ],
      notes: "Sunroof and sensing package are the two things buyers ask about.",
      status: "stock",
      daysOnLot: 18,
      market: 26100,
      postedAt: null,
      fbLive: false,
      leads: 0,
    },
    {
      id: "rav4",
      year: 2022,
      make: "Toyota",
      model: "RAV4",
      trim: "XLE",
      price: 28995,
      mileage: 22150,
      vin: "2T3BFREV5NW123456",
      stock: "A1235",
      exterior: "White",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "SUV",
      description: "RAV4 XLE, all-wheel drive, backup camera, Toyota Safety Sense. No accidents reported.",
      imageUrls: [
        "https://images.unsplash.com/photo-1702945794178-b890b4772fad?auto=format&fit=crop&w=1400&q=80",
      ],
      notes: "",
      status: "stock",
      daysOnLot: 9,
      market: 29400,
      postedAt: null,
      fbLive: false,
      leads: 0,
    },
    {
      id: "f150",
      year: 2020,
      make: "Ford",
      model: "F-150",
      trim: "XLT",
      price: 32500,
      mileage: 45600,
      vin: "1FTEW1E58LFA12345",
      stock: "A1236",
      exterior: "Blue",
      interior: "Gray",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "Truck",
      description:
        "F-150 XLT SuperCrew, 4x4, tow package. Description on the website still says $30,900 from last month's ad.",
      imageUrls: [
        "https://images.unsplash.com/photo-1566320239253-36240c3d0db8?auto=format&fit=crop&w=1400&q=80",
      ],
      notes: "A buyer asked about the tow package yesterday. Price is the holdup.",
      status: "stock",
      daysOnLot: 36,
      market: 30900,
      postedAt: ago(4, 3),
      fbLive: true,
      leads: 1,
    },
    {
      id: "equinox",
      year: 2023,
      make: "Chevrolet",
      model: "Equinox",
      trim: "LT",
      price: 26900,
      mileage: 18500,
      vin: "3GNAXUEG8PL123456",
      stock: "A1237",
      exterior: "Black",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "SUV",
      description: "Equinox LT with low miles, Apple CarPlay, and heated seats.",
      imageUrls: [],
      notes: "",
      status: "stock",
      daysOnLot: 6,
      market: 27400,
      postedAt: ago(1, 5),
      fbLive: true,
      leads: 6,
    },
    {
      id: "camry",
      year: 2021,
      make: "Toyota",
      model: "Camry",
      trim: "SE",
      price: 22950,
      mileage: 31200,
      vin: "4T1G11AK8MU123456",
      stock: "A1238",
      exterior: "Gray",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "Sedan",
      description: "Camry SE, one owner, clean Carfax. Ready for a test drive this weekend.",
      imageUrls: [
        "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1400&q=80",
      ],
      notes: "",
      status: "stock",
      daysOnLot: 22,
      market: 23600,
      postedAt: null,
      fbLive: false,
      leads: 0,
    },
    {
      id: "wrangler",
      year: 2022,
      make: "Jeep",
      model: "Wrangler",
      trim: "Unlimited Sport",
      price: 34900,
      mileage: 18750,
      vin: "1C4HJXDG2NW123456",
      stock: "A1239",
      exterior: "Green",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "SUV",
      description: "Wrangler Unlimited, soft top, clean interior. Adventure-ready, not a rock crawler.",
      imageUrls: [
        "https://images.unsplash.com/photo-1598958075612-0ebed261f4ee?auto=format&fit=crop&w=1400&q=80",
      ],
      notes: "",
      status: "stock",
      daysOnLot: 14,
      market: 35800,
      postedAt: null,
      fbLive: false,
      leads: 0,
    },
    {
      id: "accord",
      year: 2019,
      make: "Honda",
      model: "Accord",
      trim: "Sport",
      price: 19950,
      mileage: 61200,
      vin: "1HGCV1F34KA123456",
      stock: "A1244",
      exterior: "Gray",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "Sedan",
      description: "Accord Sport. Sold this afternoon off a phone lead.",
      imageUrls: [
        "https://images.unsplash.com/photo-1751601396135-db2dbe684b9e?auto=format&fit=crop&w=1400&q=80",
      ],
      notes: "Funded. Buyer picks up Saturday. Listing is still public.",
      status: "sold",
      daysOnLot: 11,
      market: 20500,
      postedAt: ago(6, 2),
      fbLive: true,
      leads: 4,
    },
    {
      id: "civic",
      year: 2018,
      make: "Honda",
      model: "Civic",
      trim: "LX",
      price: 14500,
      mileage: 89000,
      vin: "2HGFC2F59JH123456",
      stock: "A1250",
      exterior: "Silver",
      interior: "Gray",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "Sedan",
      description:
        "GUARANTEED APPROVAL even with no credit check. Best price in Georgia. Won't last. Act now.",
      imageUrls: [],
      notes: "On the back line. No photos yet, and the website blurb is not safe to paste.",
      status: "stock",
      daysOnLot: 54,
      market: 13900,
      postedAt: null,
      fbLive: false,
      leads: 0,
    },
    {
      id: "rogue",
      year: 2020,
      make: "Nissan",
      model: "Rogue",
      trim: "SV",
      price: 21850,
      mileage: 41000,
      vin: "5N1AT2MT5LC123456",
      stock: "A1255",
      exterior: "Pearl",
      interior: "Black",
      transmission: "Automatic",
      fuel: "Gasoline",
      body: "SUV",
      description: "Rogue SV with remote start and a clean interior. Quiet week on this one.",
      imageUrls: [],
      notes: "",
      status: "stock",
      daysOnLot: 27,
      market: 22100,
      postedAt: ago(5, 6),
      fbLive: true,
      leads: 0,
    },
  ];
}

export function seedLogs(): LogItem[] {
  return [
    { id: "log-accord", vehicleId: "accord", kind: "posted", at: ago(6, 2), detail: "Posted 2019 Honda Accord Sport" },
    { id: "log-malibu", vehicleId: "hist-malibu", kind: "posted", at: ago(5, 3), detail: "Posted 2017 Malibu, later sold and pulled" },
    { id: "log-rogue", vehicleId: "rogue", kind: "posted", at: ago(5, 6), detail: "Posted 2020 Nissan Rogue SV" },
    { id: "log-f150", vehicleId: "f150", kind: "posted", at: ago(4, 3), detail: "Posted 2020 Ford F-150 XLT" },
    { id: "log-escape", vehicleId: "hist-escape", kind: "posted", at: ago(3, 4), detail: "Posted 2018 Escape, pulled after it sold" },
    { id: "log-tucson", vehicleId: "hist-tucson", kind: "posted", at: ago(2, 2), detail: "Posted 2019 Tucson" },
    { id: "log-altima", vehicleId: "hist-altima", kind: "posted", at: ago(2, 6), detail: "Posted 2020 Altima" },
    { id: "log-equinox", vehicleId: "equinox", kind: "posted", at: ago(1, 5), detail: "Posted 2023 Chevrolet Equinox LT" },
  ];
}

export type Verdict = {
  kind: PlanKind | "hold" | "blocked";
  reason: string;
  score: number;
};

export function verdict(v: Vehicle, now: number): Verdict {
  if (v.status === "sold" && v.fbLive) {
    return {
      kind: "pull",
      reason: "Sold on the lot and still public. Messages on this one waste the hour.",
      score: 1000,
    };
  }
  if (v.status === "sold") {
    return { kind: "hold", reason: "Sold, and the Marketplace post is down.", score: 0 };
  }
  if (v.imageUrls.length === 0 && !v.fbLive) {
    return {
      kind: "blocked",
      reason: "No photos. A text-only car dies in the feed, so it stays off the plan.",
      score: 0,
    };
  }
  const hours = ageHours(v.postedAt, now);
  const over = v.market > 0 && v.price > v.market + 200;
  const under = v.market > 0 && v.price < v.market - 100;
  const stale = hours !== null && hours >= 72;

  if (v.fbLive && (stale || over)) {
    const bits: string[] = [];
    if (stale && hours !== null) bits.push(`live ${Math.floor(hours / 24)} days`);
    if (over) bits.push(`${money(v.price - v.market)} over similar asks`);
    if (v.leads === 0) bits.push("no messages");
    const aged = hours === null ? 0 : Math.min(hours / 24, 40);
    return {
      kind: "refresh",
      reason: `Refresh it. ${bits.join(", ")}.`,
      score: 70 + aged + (over ? 24 : 0) + (v.leads === 0 ? 8 : 0),
    };
  }

  if (!v.postedAt && !v.fbLive) {
    const gap = under ? `${money(v.market - v.price)} under similar local asks` : "priced in range";
    let score = 100 + Math.min(v.daysOnLot, 50);
    if (under) score += 22;
    if (v.market > 0 && v.price < v.market * 0.97) score += 8;
    return {
      kind: "post",
      reason: `${v.daysOnLot} days on the lot, never posted, ${gap}.`,
      score,
    };
  }

  return {
    kind: "hold",
    reason: "Posted recently and priced close to the market. Leave it up.",
    score: 0,
  };
}

export function buildPlan(vehicles: Vehicle[], now: number): PlanItem[] {
  const ranked = vehicles
    .map((v) => ({ v, d: verdict(v, now) }))
    .filter((x) => x.d.kind === "pull" || x.d.kind === "post" || x.d.kind === "refresh")
    .sort((a, b) => b.d.score - a.d.score || a.v.stock.localeCompare(b.v.stock));

  const pulls = ranked.filter((x) => x.d.kind === "pull");
  const rest = ranked.filter((x) => x.d.kind !== "pull");
  const times = postingTimes(rest.length, now);
  const items: PlanItem[] = pulls.map((x, i) => ({
    vehicleId: x.v.id,
    kind: "pull",
    reason: x.d.reason,
    score: x.d.score,
    when: i === 0 ? "Now" : "Before you post",
  }));
  rest.forEach((x, i) => {
    items.push({
      vehicleId: x.v.id,
      kind: x.d.kind as PlanKind,
      reason: x.d.reason,
      score: x.d.score,
      when: times[i] ?? "",
    });
  });
  return items;
}

export function postingTimes(count: number, nowMs: number): string[] {
  const labels: string[] = [];
  const now = new Date(nowMs);
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  if (now.getHours() < 9) cursor.setHours(9);
  else if (now.getHours() >= 18) {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(9);
  } else cursor.setHours(now.getHours() + 1);

  while (labels.length < count) {
    const hour = cursor.getHours();
    if (hour >= 18) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(9, 0, 0, 0);
      continue;
    }
    if (hour < 9) {
      cursor.setHours(9, 0, 0, 0);
      continue;
    }
    const same = cursor.toDateString() === now.toDateString();
    const time = cursor.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const day = cursor.toLocaleDateString("en-US", { weekday: "short" });
    labels.push(same ? time : `${day} ${time}`);
    cursor.setHours(cursor.getHours() + 1);
  }
  return labels;
}

export function blockedVehicles(vehicles: Vehicle[], now: number): Vehicle[] {
  return vehicles.filter((v) => verdict(v, now).kind === "blocked");
}

export function holdingVehicles(vehicles: Vehicle[], now: number): Vehicle[] {
  return vehicles.filter((v) => verdict(v, now).kind === "hold" && v.status !== "sold");
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function droppedClaims(text: string): string[] {
  const found: string[] = [];
  for (const rule of RISKY) {
    if (rule.re.test(text)) found.push(rule.label);
  }
  return [...new Set(found)];
}

export function cleanBlurb(v: Vehicle): { kept: string; dropped: string[] } {
  const dropped: string[] = [];
  const kept: string[] = [];
  const parts = splitSentences(v.description);
  const source = parts.length ? parts : [v.description.trim()].filter(Boolean);
  for (const sentence of source) {
    const hits = RISKY.filter((r) => r.re.test(sentence)).map((r) => r.label);
    const mismatch = priceMentions(sentence).some((n) => Math.abs(n - v.price) > 50);
    if (hits.length) dropped.push(...hits);
    else if (mismatch) dropped.push(`A ${money(priceMentions(sentence)[0] ?? 0)} mention that doesn’t match ${money(v.price)}`);
    else if (sentence) kept.push(sentence);
  }
  return { kept: kept.join(" "), dropped: [...new Set(dropped)] };
}

export function priceMentions(text: string): number[] {
  const out: number[] = [];
  const re = /\$\s?([\d,]{3,})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const n = Number(match[1].replace(/,/g, ""));
    if (n >= 1000) out.push(n);
  }
  return out;
}

export function captionFlags(text: string, v: Vehicle): string[] {
  const flags = droppedClaims(text);
  for (const mentioned of priceMentions(text)) {
    if (Math.abs(mentioned - v.price) > 50) {
      flags.push(`Caption says ${money(mentioned)} but the price is ${money(v.price)}`);
    }
  }
  if (v.imageUrls.length === 0) flags.push("No photos attached");
  if (v.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(v.vin)) flags.push("VIN should be 17 characters");
  return [...new Set(flags)];
}

export function buildCaption(v: Vehicle, style: StyleName, store: StoreLine = { name: "", city: "" }): { text: string; dropped: string[] } {
  const { kept, dropped } = cleanBlurb(v);
  const name = titleOf(v);
  const price = money(v.price);
  const mi = miles(v.mileage);
  const color = v.exterior || "see photos";
  const who = store.name.trim();
  const where = store.city.trim();
  const stock = v.stock ? `Stock ${v.stock}` : "";
  let text = "";
  if (style === "short") {
    const tail = [where, stock].filter(Boolean).join(" · ");
    text = [name, `${price} · ${mi} · ${color}`, tail].filter(Boolean).join("\n");
  } else if (style === "casual") {
    const line = kept || `${color} ${v.body.toLowerCase()}, ${v.transmission.toLowerCase()}.`;
    const place = where ? ` in ${where.split(",")[0]}` : "";
    const tag = where ? ` #${where.split(",")[0].replace(/[^A-Za-z]/g, "")}` : "";
    text = [
      `${name}${place}.`,
      "",
      `${price}. ${mi}. ${color}. ${v.transmission}.`,
      "",
      line,
      "",
      `Message me${stock ? ` ${stock.toLowerCase()}` : ""} and I’ll send a walkaround.`,
      `#${v.make}${tag}`,
    ].join("\n");
  } else {
    const stocked = who ? `, in stock at ${who}` : ", in stock";
    const sign = who ? `${who}${where ? ` in ${where}` : ""}. ` : "";
    text = [
      name,
      "",
      `${price} · ${mi} · ${color}`,
      `${v.transmission} · ${v.fuel} · ${v.body}${stock ? ` · ${stock}` : ""}`,
      "",
      kept || `${color} ${v.make} ${v.model}${stocked}.`,
      "",
      `${sign}Message for a walkaround and today’s out-the-door number.`,
      v.vin ? `VIN ${v.vin}.` : "",
    ]
      .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
      .join("\n")
      .trim();
  }
  return { text, dropped };
}

export function suggestPrice(v: Vehicle, now: number): number | null {
  if (v.status !== "stock") return null;
  if (v.market > 0 && v.price > v.market + 200) {
    const next = Math.round((v.market - 150) / 50) * 50;
    return next < v.price ? next : null;
  }
  const hours = ageHours(v.postedAt, now);
  if (v.fbLive && hours !== null && hours >= 72 && v.leads < 2) {
    const next = Math.round((v.price - 400) / 50) * 50;
    return next > 1000 ? next : null;
  }
  return null;
}

export function marketLine(v: Vehicle): string | null {
  if (!v.market) return null;
  const gap = v.price - v.market;
  if (Math.abs(gap) < 100) return "In line with similar asks";
  if (gap > 0) return `${money(gap)} over similar asks`;
  return `${money(-gap)} under similar asks`;
}

export type Group = { id: string; name: string; members: string; bodies: string[] };

export const GROUPS: Group[] = [
  { id: "cobb", name: "Cobb County cars for sale", members: "48k", bodies: ["Sedan", "SUV", "Truck"] },
  { id: "north", name: "North Atlanta used cars", members: "112k", bodies: ["Sedan", "SUV"] },
  { id: "suv", name: "Georgia SUVs and crossovers", members: "36k", bodies: ["SUV"] },
  { id: "truck", name: "Southeast trucks", members: "61k", bodies: ["Truck"] },
];

export function groupsFor(v: Vehicle): string[] {
  return GROUPS.filter((g) => g.bodies.includes(v.body)).map((g) => g.id).slice(0, 2);
}

export function shareBlurb(v: Vehicle, store: StoreLine = { name: "", city: "" }): string {
  const color = v.exterior ? `${v.exterior}. ` : "";
  const where = store.city.trim();
  return `${titleOf(v)} · ${money(v.price)} · ${miles(v.mileage)}. ${color}${where ? `${where}. ` : ""}Message stock ${v.stock || "number"} for a walkaround.`;
}

export function weekCounts(logs: LogItem[], now: number): { label: string; count: number }[] {
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = start.getTime() + DAY_MS;
    const count = logs.filter(
      (l) => l.kind === "posted" && new Date(l.at).getTime() >= start.getTime() && new Date(l.at).getTime() < end,
    ).length;
    days.push({
      label: start.toLocaleDateString("en-US", { weekday: "narrow" }),
      count,
    });
  }
  return days;
}

export function headline(vehicles: Vehicle[], now: number): { title: string; lede: string } {
  const plan = buildPlan(vehicles, now);
  const first = plan[0];
  if (!first) {
    return {
      title: "Nothing needs a post.",
      lede: "The live cars are fresh and priced close to the market.",
    };
  }
  const v = vehicles.find((car) => car.id === first.vehicleId);
  if (!v) return { title: "The desk is clear.", lede: "" };
  if (first.kind === "pull") {
    return {
      title: `Pull the sold ${v.model} before you post anything.`,
      lede: "It’s still public. People can message a car you can’t sell.",
    };
  }
  if (first.kind === "refresh") {
    return {
      title: `Refresh the ${v.year} ${v.model} before you add another.`,
      lede: first.reason,
    };
  }
  return {
    title: `Post the ${v.year} ${v.make} ${v.model} next.`,
    lede: first.reason,
  };
}

function titleCase(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
}

function num(value: string | undefined): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function vehicleFromRow(row: Record<string, string>, index: number): Vehicle | null {
  const year = num(row.year);
  const make = titleCase(row.make ?? "");
  const model = (row.model ?? "").trim();
  if (!year || !make || !model) return null;
  const price = num(row.price);
  const vin = (row.vin ?? "").trim().toUpperCase();
  const stock = (row.stock ?? "").trim();
  const id = `imp-${vin || stock || `${year}-${make}-${model}-${index}`}`;
  const urls = (row.image_urls ?? row.images ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
  const status: VehicleStatus = /sold/i.test(row.status ?? "") ? "sold" : "stock";
  return {
    id,
    year,
    make,
    model,
    trim: (row.trim ?? "").trim(),
    price,
    mileage: num(row.mileage),
    vin,
    stock,
    exterior: (row.exterior_color ?? row.exterior ?? "").trim(),
    interior: (row.interior_color ?? row.interior ?? "").trim(),
    transmission: (row.transmission ?? "Automatic").trim() || "Automatic",
    fuel: (row.fuel ?? "Gasoline").trim() || "Gasoline",
    body: (row.body ?? "").trim() || inferBody(model),
    description: (row.description ?? "").replace(/^"|"$/g, "").trim(),
    imageUrls: urls,
    notes: (row.notes ?? "").trim(),
    status,
    daysOnLot: num(row.days_on_lot) || 1,
    market: num(row.market) || price,
    postedAt: null,
    fbLive: false,
    leads: 0,
  };
}

export function vehiclesFromCsv(text: string): Vehicle[] {
  return parseCsv(text)
    .map((row, i) => vehicleFromRow(row, i))
    .filter((v): v is Vehicle => v !== null);
}

export function extractFromText(text: string): Vehicle[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const found: Vehicle[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/\b(20[0-2]\d)\s+([A-Za-z]+)\s+([A-Za-z0-9][A-Za-z0-9-]{0,24})/);
    if (!match) continue;
    const year = Number(match[1]);
    const make = titleCase(match[2]);
    const model = match[3].replace(/[-–]$/, "").trim();
    let price = 0;
    let mileage = 0;
    let vin = "";
    for (let j = 1; j <= 16 && i + j < lines.length; j++) {
      const nxt = lines[i + j];
      if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(nxt)) vin = nxt.toUpperCase();
      const priced = nxt.match(/\$\s?([\d,]{4,})/);
      if (priced) price = Number(priced[1].replace(/,/g, ""));
      const milesOnly = nxt.match(/^([\d,]{2,7})$/);
      if (milesOnly && lines[i + j + 1] && /mile/i.test(lines[i + j + 1])) {
        mileage = Number(milesOnly[1].replace(/,/g, ""));
      }
      const inline = nxt.match(/([\d,]{2,7})\s*miles?/i);
      if (inline) mileage = Number(inline[1].replace(/,/g, ""));
    }
    if (price < 1000 && mileage < 1 && !vin) continue;
    const key = vin || `${year}-${make}-${model}-${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = vehicleFromRow(
      {
        year: String(year),
        make,
        model,
        price: String(price),
        mileage: String(mileage),
        vin,
      },
      found.length,
    );
    if (row) found.push(row);
  }
  return found;
}

export function listingFields(v: Vehicle, caption: string, store: StoreLine = { name: "", city: "" }): { label: string; value: string }[] {
  return [
    { label: "Vehicle type", value: "Car/truck" },
    { label: "Year", value: String(v.year) },
    { label: "Make", value: v.make },
    { label: "Model", value: v.model },
    { label: "Mileage", value: v.mileage ? String(v.mileage) : "" },
    { label: "Price", value: String(v.price) },
    { label: "Body style", value: v.body },
    { label: "Fuel", value: v.fuel },
    { label: "Transmission", value: v.transmission },
    { label: "Exterior color", value: v.exterior || "—" },
    { label: "Description", value: caption },
    { label: "Location", value: store.city.trim() || "—" },
  ];
}
