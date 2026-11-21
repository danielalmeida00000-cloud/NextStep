import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { readAccess } from "@/lib/business/access.functions";

const SCENES: Record<string, string> = {
  lot: "a real dealership row in daylight, asphalt, other cars soft and far back",
  street: "a quiet residential street with houses and trees, overcast daylight",
  afternoon: "an open paved lot in late-afternoon sun, long soft shadows",
};

export const rewordPost = createServerFn({ method: "POST" })
  .validator((input: { text: string; advanced: boolean }) => {
    const text = String(input?.text ?? "").trim().slice(0, 2000);
    if (text.length < 8) throw new Error("Write a post first.");
    return { text, advanced: Boolean(input?.advanced) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const access = await readAccess(context.userId);
    if (!access.allowed) return { ok: false as const, error: "Your plan isn’t on." };
    const advanced = data.advanced && access.plan !== "basic";
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Rewording isn’t available right now." };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 400,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `Rewrite this Facebook Marketplace car post so it sounds like a salesperson typed it.
Keep every fact. Do not add features, prices, miles, or promises that are not already here.
No slogans, no "don't miss", no "dream", no "perfect", no emoji, no hashtag list.
${advanced ? "Use 5 to 8 short lines. Open with the car." : "Keep it to 4 short lines."}
Return only the post.\n\n${data.text}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: "Couldn’t reword that. Try again." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false as const, error: "The rewrite came back empty." };
    return { ok: true as const, text };
  });

export const newBackground = createServerFn({ method: "POST" })
  .validator((input: { imageUrl: string; scene: string }) => {
    const imageUrl = String(input?.imageUrl ?? "").trim();
    const scene = String(input?.scene ?? "");
    if (!SCENES[scene]) throw new Error("Pick a background.");
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new Error("That photo needs a web address.");
    }
    if (parsed.protocol !== "https:") throw new Error("That photo needs a secure link.");
    const host = parsed.hostname;
    if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) {
      throw new Error("That photo isn’t on a public site.");
    }
    return { imageUrl: parsed.toString(), scene };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const access = await readAccess(context.userId);
    if (!access.allowed || access.plan !== "plus") {
      return { ok: false as const, error: "Backgrounds are on Premium Plus." };
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Backgrounds aren’t available right now." };
    const source = await fetch(data.imageUrl, { redirect: "follow", signal: AbortSignal.timeout(20000) });
    if (!source.ok) return { ok: false as const, error: "Couldn’t read that photo." };
    const bytes = new Uint8Array(await source.arrayBuffer());
    if (bytes.byteLength < 1000 || bytes.byteLength > 3_500_000) {
      return { ok: false as const, error: "That photo is the wrong size to restyle." };
    }
    const type = source.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!type.startsWith("image/")) return { ok: false as const, error: "That file isn’t a photo." };
    const dataUri = `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
    const res = await fetch("https://api.x.ai/v1/images/edits", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt: `Replace only the background with ${SCENES[data.scene]}. Keep this exact vehicle: same color, wheels, badges, damage, and angle. Photorealistic. No people, no text, no watermark, no extra car in front.`,
        image: { url: dataUri, type: "image_url" },
      }),
    });
    if (!res.ok) return { ok: false as const, error: "Couldn’t make that background. Try another photo." };
    const body = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
    const first = body.data?.[0];
    const url = first?.url || (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : "");
    if (!url) return { ok: false as const, error: "The new photo came back empty." };
    return { ok: true as const, url };
  });
