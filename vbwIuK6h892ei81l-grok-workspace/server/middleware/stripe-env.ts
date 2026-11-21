import startup from "../../startup.sh?raw";

function take(name: string) {
  if (process.env[name]?.trim()) return;
  const match = startup.match(new RegExp(`export ${name}='([^']+)'`));
  if (match?.[1]) process.env[name] = match[1];
}

take("STRIPE_SECRET_KEY");
take("STRIPE_WEBHOOK_SECRET");

export default function stripeEnv(_event: unknown, next: () => unknown) {
  return next();
}
