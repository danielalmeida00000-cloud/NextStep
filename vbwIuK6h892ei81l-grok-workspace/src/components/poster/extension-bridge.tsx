import { useEffect, useState } from "react";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import type { Vehicle } from "@/lib/poster/model";
import { usePoster } from "@/lib/poster/store";

const PAGE = "car-poster-page";
const EXT = "car-poster-ext";

export function absoluteImage(url: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === "undefined") return url;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${window.location.origin}${prefix}${path}`;
}

export function sendToExtension(packet: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(ok);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data && data.source === EXT && data.type === "ACK") finish(true);
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: PAGE, type: "FILL", packet }, "*");
    window.setTimeout(() => finish(false), 700);
  });
}

function isVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== "object") return false;
  const car = value as Vehicle;
  return Boolean(car.id && car.year && car.make && car.model);
}

export function useExtensionReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const mark = (ok: boolean) => {
      if (alive) setReady(ok);
    };
    if (document.documentElement.dataset.carPosterExt === "1") mark(true);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source === EXT && (data.type === "PONG" || data.type === "ACK")) mark(true);
    };
    window.addEventListener("message", onMessage);
    const ping = () => window.postMessage({ source: PAGE, type: "PING" }, "*");
    ping();
    const timers = [300, 1000].map((ms) => window.setTimeout(ping, ms));
    const giveUp = window.setTimeout(() => {
      if (document.documentElement.dataset.carPosterExt !== "1") mark(false);
    }, 1500);
    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(giveUp);
    };
  }, []);
  return ready;
}

export function ExtensionBridge() {
  const [banner, setBanner] = useState("");
  useEffect(() => {
    document.documentElement.dataset.app = "car-poster-pro";
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { source?: string; type?: string; vehicles?: unknown } | null;
      if (!data || data.source !== EXT || data.type !== "IMPORT" || !Array.isArray(data.vehicles)) return;
      const incoming = data.vehicles.filter(isVehicle);
      if (!incoming.length) return;
      const state = usePoster.getState();
      const summary = state.applyDealerPull(incoming, state.dealerUrl || "extension://lot", incoming.length < 8);
      const parts = [];
      if (summary.arrived.length) parts.push(`New on the lot: ${summary.arrived.join(", ")}.`);
      if (summary.sold.length) parts.push(`Dealer marked sold: ${summary.sold.join(", ")}.`);
      if (!parts.length) parts.push(summary.added ? `Added ${summary.added} from the dealer page.` : "No new cars, and nothing newly sold.");
      setBanner(parts.join(" "));
      window.postMessage({ source: PAGE, type: "IMPORTED" }, "*");
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ source: PAGE, type: "HELLO" }, "*");
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  if (!banner) return null;
  return <p className="mx-auto max-w-5xl px-4 pt-3 text-sm text-amber">{banner}</p>;
}
