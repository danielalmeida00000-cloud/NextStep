import { createServerFn } from "@tanstack/react-start";
import type { PullResult } from "./scrape";

export const pullDealerUrl = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => {
    if (!data || typeof data.url !== "string") throw new Error("Paste a dealer link.");
    return { url: data.url };
  })
  .handler(async ({ data }): Promise<PullResult> => {
    const { loadDealer } = await import("./load-dealer");
    return loadDealer(data.url);
  });
