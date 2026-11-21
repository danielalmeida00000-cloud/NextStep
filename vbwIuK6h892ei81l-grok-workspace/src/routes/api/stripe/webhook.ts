import { createHmac, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { activateFromSession, markStripeCanceled, syncSubscription, webhookSecret } from "@/lib/business/stripe.server";

function signed(raw: string, header: string, secret: string) {
  const parts = new Map(header.split(",").map((part) => part.split("=") as [string, string]));
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = webhookSecret();
        if (!secret) return new Response("Webhook secret missing", { status: 500 });
        const raw = await request.text();
        const header = request.headers.get("stripe-signature") ?? "";
        if (!signed(raw, header, secret)) return new Response("Bad signature", { status: 400 });
        const event = JSON.parse(raw) as {
          type?: string;
          data?: { object?: Record<string, unknown> };
        };
        const object = event.data?.object ?? {};
        const meta = (object.metadata ?? {}) as { userId?: string };
        const userId = String(meta.userId ?? object.client_reference_id ?? "");
        if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
          if (userId) {
            const result = await activateFromSession(object as Parameters<typeof activateFromSession>[0], userId);
            if (!result.ok) return new Response(result.error, { status: 500 });
          }
        }
        if (event.type === "customer.subscription.updated") {
          await syncSubscription(String(object.id ?? ""), String(object.status ?? ""));
        }
        if (event.type === "customer.subscription.deleted") {
          await markStripeCanceled(String(object.id ?? ""));
        }
        if (event.type === "invoice.paid") {
          await syncSubscription(String(object.subscription ?? ""), "active");
        }
        return new Response("ok");
      },
    },
  },
});
