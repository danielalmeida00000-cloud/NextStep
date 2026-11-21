import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Fixture values only. They keep stripe.server from reading startup.sh.
process.env.STRIPE_SECRET_KEY = "sk_test_fixture_not_a_real_key";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fixture_not_a_real_secret";
delete process.env.DATABASE_URL;

const memory = new Map();
const localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(String(key), String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  },
  key(index) {
    return [...memory.keys()][index] ?? null;
  },
  get length() {
    return memory.size;
  },
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorage,
  configurable: true,
});
if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
    configurable: true,
  });
}

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const doubles = {
  db: pathToFileURL(join(appRoot, "scripts/test-doubles/db.mjs")).href,
  start: pathToFileURL(join(appRoot, "scripts/test-doubles/react-start.mjs")).href,
  server: pathToFileURL(join(appRoot, "scripts/test-doubles/react-start-server.mjs")).href,
  route: pathToFileURL(join(appRoot, "scripts/test-doubles/file-route.mjs")).href,
};

function aliasUrl(specifier) {
  const base = join(appRoot, "src", specifier.slice(2));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    `${base}.js`,
    join(base, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

function extensionUrl(specifier, parent) {
  if (!parent || !specifier.startsWith(".")) return null;
  if (/\.[cm]?[jt]sx?$/.test(specifier) || /\.json$/.test(specifier)) return null;
  const base = join(dirname(fileURLToPath(parent)), specifier);
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, join(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? "";
    if (parent.includes("/node_modules/")) return nextResolve(specifier, context);
    if (specifier === "@/lib/db") {
      return { url: doubles.db, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const url = aliasUrl(specifier);
      if (url) return { url, shortCircuit: true };
    }
    if (parent.includes("/src/lib/business/")) {
      if (specifier === "@tanstack/react-start") {
        return { url: doubles.start, shortCircuit: true };
      }
      if (specifier === "@tanstack/react-start/server") {
        return { url: doubles.server, shortCircuit: true };
      }
    }
    if (specifier === "@tanstack/react-router" && parent.includes("/routes/api/stripe/webhook.ts")) {
      return { url: doubles.route, shortCircuit: true };
    }
    const extended = extensionUrl(specifier, parent);
    if (extended) return { url: extended, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
