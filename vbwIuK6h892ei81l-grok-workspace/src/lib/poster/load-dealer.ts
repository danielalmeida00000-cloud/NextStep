import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dealerFromHtml, dedupeVehicles, inventoryLinks, parseDealerLot, type PullResult } from "./scrape";
import type { Vehicle } from "./model";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function loadDealer(input: string): Promise<PullResult> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a dealer link.");
  if (trimmed === "demo" || /\/demo-dealer\.html(?:$|[?#])/i.test(trimmed)) {
    const html = readFileSync(join(process.cwd(), "public/demo-dealer.html"), "utf8");
    const lot = parseDealerLot(html, "demo://lot");
    return {
      vehicles: lot.vehicles,
      truncated: lot.truncated,
      note: lot.vehicles.length
        ? `Found ${lot.vehicles.length} on the sample dealer page.`
        : "The sample page had no vehicles.",
      dealer: { name: "", city: "" },
    };
  }

  const first = await fetchPage(trimmed);
  const dealer = dealerFromHtml(first.html);
  const lot = parseDealerLot(first.html, first.finalUrl);
  if (lot.vehicles.length > 0) {
    return {
      vehicles: lot.vehicles,
      truncated: lot.truncated,
      note: foundNote(lot.vehicles, hostOf(first.finalUrl)),
      dealer,
    };
  }

  const links = inventoryLinks(first.html, first.finalUrl);
  if (links.length === 0) {
    return {
      vehicles: [],
      note: "No vehicles on that page. If the lot only appears after the site’s own scripts run, open it in Chrome and use the extension’s Pull this page.",
      truncated: false,
      dealer,
    };
  }

  const pages = await mapLimit(links, 3, (url) => fetchPage(url).catch(() => null));
  const more: Vehicle[] = [];
  let opened = 0;
  for (const page of pages) {
    if (!page) continue;
    opened += 1;
    more.push(...parseDealerLot(page.html, page.finalUrl).vehicles);
  }
  const vehicles = dedupeVehicles(more).slice(0, 40);
  if (vehicles.length === 0) {
    return {
      vehicles: [],
      note: `Opened ${opened} vehicle link${opened === 1 ? "" : "s"} and still found no cars. Use the extension on the page itself.`,
      truncated: true,
      dealer,
    };
  }
  return {
    vehicles,
    truncated: true,
    note: `The inventory page had no cars in the HTML. Opened ${opened} vehicle page${opened === 1 ? "" : "s"} and found ${vehicles.length}. ${mileNote(vehicles)}`,
    dealer,
  };
}

function foundNote(vehicles: Vehicle[], host: string): string {
  return `Found ${vehicles.length} on ${host}. ${mileNote(vehicles)}`;
}

function mileNote(vehicles: Vehicle[]): string {
  const missing = vehicles.filter((car) => !car.mileage).length;
  if (!missing) return "Mileage came through on every car.";
  if (missing === vehicles.length) return "The site didn’t list mileage on these cars.";
  return `Mileage is missing on ${missing}. The site didn’t print it.`;
}

async function fetchPage(raw: string): Promise<{ html: string; finalUrl: string }> {
  let current = assertPublic(raw).href;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12000),
    }).catch(() => {
      throw new Error("Couldn’t reach that site. Open it in Chrome and use the extension’s Pull this page.");
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("That link redirected without a destination.");
      current = assertPublic(new URL(location, current).href).href;
      continue;
    }
    if (response.status === 403 || response.status === 401 || response.status === 429 || response.status === 503) {
      throw new Error("That site blocked the pull. Open the page in Chrome and use the extension’s Pull this page.");
    }
    if (response.status === 404) throw new Error("That page wasn’t found.");
    if (!response.ok) throw new Error(`That site returned ${response.status}.`);
    const type = (response.headers.get("content-type") || "").toLowerCase();
    const text = (await response.text()).slice(0, 2_000_000);
    const html = wrapIfJson(text, type);
    return { html, finalUrl: current };
  }
  throw new Error("That link redirected too many times.");
}

function wrapIfJson(text: string, contentType: string): string {
  const trimmed = text.trim();
  const json = contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (json && !trimmed.startsWith("<")) {
    return `<script type="application/ld+json">${trimmed}</script>`;
  }
  return text;
}

function assertPublic(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn’t look like a link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an http or https link.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.startsWith("fe80:") ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    throw new Error("That address isn’t a public dealer site.");
  }
  const ip = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const a = Number(ip[1]);
    const b = Number(ip[2]);
    const privateRange =
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31);
    if (privateRange) throw new Error("That address isn’t a public dealer site.");
  }
  return url;
}

function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "that site";
  }
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}
