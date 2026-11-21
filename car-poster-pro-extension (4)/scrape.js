"use strict";
var CarPosterScrape = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/lib/poster/scrape.ts
  var scrape_exports = {};
  __export(scrape_exports, {
    dealerFromHtml: () => dealerFromHtml,
    dedupeVehicles: () => dedupeVehicles,
    inventoryLinks: () => inventoryLinks,
    parseDealerHtml: () => parseDealerHtml,
    resolveUrl: () => resolveUrl
  });

  // src/lib/poster/model.ts
  var HOUR_MS = 60 * 60 * 1e3;
  var DAY_MS = 24 * HOUR_MS;
  function inferBody(model) {
    if (/f-150|silverado|ram|sierra|tundra|tacoma|ranger/i.test(model)) return "Truck";
    if (/wrangler|cr-v|rav4|equinox|rogue|explorer|tahoe|pilot|highlander/i.test(model)) return "SUV";
    if (/camry|accord|civic|altima|sentra|malibu|corolla/i.test(model)) return "Sedan";
    return "SUV";
  }
  function titleCase(word) {
    if (!word) return "";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  function num(value) {
    if (!value) return 0;
    const n = Number(String(value).replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  function vehicleFromRow(row, index) {
    const year = num(row.year);
    const make = titleCase(row.make ?? "");
    const model = (row.model ?? "").trim();
    if (!year || !make || !model) return null;
    const price = num(row.price);
    const vin = (row.vin ?? "").trim().toUpperCase();
    const stock = (row.stock ?? "").trim();
    const id = `imp-${vin || stock || `${year}-${make}-${model}-${index}`}`;
    const urls = (row.image_urls ?? row.images ?? "").split(",").map((u) => u.trim()).filter((u) => u.startsWith("http"));
    const status = /sold/i.test(row.status ?? "") ? "sold" : "stock";
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
      leads: 0
    };
  }

  // src/lib/poster/scrape.ts
  var MULTI_MAKES = ["land rover", "alfa romeo", "mercedes-benz", "mercedes benz", "aston martin", "rolls-royce", "rolls royce"];
  var UPPER_MAKES = /* @__PURE__ */ new Set(["bmw", "gmc", "mini", "ram", "kia", "byd", "fiat"]);
  var KNOWN_MAKES = /* @__PURE__ */ new Set([
    "acura",
    "alfa",
    "audi",
    "bmw",
    "buick",
    "cadillac",
    "chevrolet",
    "chrysler",
    "dodge",
    "fiat",
    "ford",
    "genesis",
    "gmc",
    "honda",
    "hyundai",
    "infiniti",
    "jaguar",
    "jeep",
    "kia",
    "lexus",
    "lincoln",
    "mazda",
    "mercedes",
    "mercedes-benz",
    "mini",
    "mitsubishi",
    "nissan",
    "porsche",
    "ram",
    "subaru",
    "tesla",
    "toyota",
    "volkswagen",
    "volvo",
    "rivian",
    "lucid",
    "polestar",
    "land",
    "alfa"
  ]);
  function parseDealerHtml(html, pageUrl) {
    const fromLd = fromJsonLd(html, pageUrl);
    const fromJson = fromEmbeddedJson(html, pageUrl);
    const fromAttr = fromDataAttrs(html, pageUrl);
    const fromText = fromPlain(html, pageUrl);
    return dedupeVehicles([...fromJson, ...fromLd, ...fromAttr, ...fromText]).slice(0, 40);
  }
  function dedupeVehicles(list) {
    const out = [];
    for (const car of list) {
      const index = out.findIndex((have) => sameCar(have, car));
      if (index === -1) out.push(car);
      else out[index] = richer(out[index], car);
    }
    return out;
  }
  function sameCar(a, b) {
    if (a.vin && b.vin) return a.vin === b.vin;
    return a.year === b.year && a.make.toLowerCase() === b.make.toLowerCase() && a.model.toLowerCase() === b.model.toLowerCase() && Math.abs(a.price - b.price) < 2;
  }
  function richer(a, b) {
    const score = (car) => (car.vin ? 4 : 0) + car.imageUrls.length * 2 + (car.description ? 1 : 0) + (car.exterior ? 1 : 0) + (car.stock ? 1 : 0);
    const [best, other] = score(a) >= score(b) ? [a, b] : [b, a];
    return {
      ...best,
      vin: best.vin || other.vin,
      stock: best.stock || other.stock,
      trim: best.trim || other.trim,
      exterior: best.exterior || other.exterior,
      interior: best.interior || other.interior,
      description: best.description || other.description,
      mileage: Math.max(best.mileage, other.mileage),
      imageUrls: best.imageUrls.length ? best.imageUrls : other.imageUrls
    };
  }
  function inventoryLinks(html, pageUrl) {
    let base;
    try {
      base = new URL(pageUrl);
    } catch {
      return [];
    }
    const found = [];
    const re = /href\s*=\s*["']([^"'#]+)["']/gi;
    let match;
    while (match = re.exec(html)) {
      let abs;
      try {
        abs = new URL(match[1], base);
      } catch {
        continue;
      }
      if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
      if (abs.host !== base.host) continue;
      const path = `${abs.pathname}${abs.search}`.toLowerCase();
      if (/\.(jpg|jpeg|png|webp|gif|svg|css|js|pdf|ico)(\?|$)/.test(path)) continue;
      const href = abs.href.split("#")[0];
      if (href === base.href.split("#")[0]) continue;
      const vin = /[a-hj-npr-z0-9]{17}/i.test(abs.pathname);
      const looks = /\/(vehicle|vdp|inventory|used|new|pre-owned|cars|detail)\b/.test(path);
      if (!vin && !looks) continue;
      found.push(href);
    }
    const unique = [...new Set(found)];
    unique.sort((a, b) => linkScore(b) - linkScore(a));
    return unique.slice(0, 6);
  }
  function linkScore(href) {
    let score = 0;
    if (/[a-hj-npr-z0-9]{17}/i.test(href)) score += 5;
    if (/\/vdp\/|\/vehicle\/|\/detail\//i.test(href)) score += 3;
    try {
      score += Math.min(new URL(href).pathname.split("/").filter(Boolean).length, 4);
    } catch {
      score = 0;
    }
    if (/[?&](page|sort|filter)=/i.test(href)) score -= 3;
    return score;
  }
  function fromEmbeddedJson(html, pageUrl) {
    const out = [];
    for (const block of scriptJson(html)) {
      walkAll(block, (node) => {
        const built = vehicleFromInventory(node, pageUrl, out.length);
        if (built) out.push(built);
      });
    }
    return out;
  }
  function scriptJson(html) {
    const out = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while (match = re.exec(html)) {
      const attrs = match[1] ?? "";
      const body = decode(match[2] ?? "").trim();
      if (!body) continue;
      const declared = /type\s*=\s*["']application\/(?:json|ld\+json)["']/i.test(attrs);
      const looks = body.startsWith("{") || body.startsWith("[");
      if (!declared && !(looks && /mileage|odometer|miles/i.test(body))) continue;
      if (!looks) continue;
      try {
        out.push(JSON.parse(body));
      } catch {
        continue;
      }
    }
    return out;
  }
  function dealerFromHtml(html) {
    let name = metaContent(html, "og:site_name");
    let city = "";
    let state = "";
    for (const block of scriptJson(html)) {
      walkAll(block, (record) => {
        const locality = textOf(record.addressLocality ?? record.city);
        const region = textOf(record.addressRegion ?? record.state);
        if (!city && locality && /^[A-Za-z]{2}$/.test(region) && locality.toLowerCase() !== "null") {
          city = locality;
          state = region.toUpperCase();
        }
        const named = textOf(record.name);
        if (!name && named && locality && !record.model && !record.vin && !record.year && named.length < 70) {
          name = cleanDealerName(named);
        }
      });
    }
    if (!name) {
      const title = html.match(/<title>([^<|]{2,70})/i);
      if (title) name = cleanDealerName(decode(title[1]));
    }
    return { name: cleanDealerName(name), city: city ? state ? `${city}, ${state}` : city : "" };
  }
  function metaContent(html, property) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i"
    );
    const match = html.match(re);
    return cleanDealerName(decode((match?.[1] || match?.[2] || "").trim()));
  }
  function cleanDealerName(value) {
    return value.replace(/\s+/g, " ").replace(/\s*[-|–].*$/, "").replace(/^(home|inventory|used vehicles?|new vehicles?)$/i, "").trim();
  }
  function vehicleFromInventory(record, pageUrl, index) {
    const year = yearOf(record.year ?? record.vehicleYear ?? record.modelYear);
    const make = titleMake(textOf(record.make ?? record.makeName));
    const model = cleanModel(textOf(record.model ?? record.modelName));
    if (!year || !make || !model) return null;
    if (make.length > 24 || model.length > 32) return null;
    const mileage = mileageOf(record.mileage ?? record.odometer ?? record.miles ?? record.milesDriven);
    const price = inventoryPrice(record);
    const photo = textOf(record.featuredphoto ?? record.featuredPhoto ?? record.imageUrl ?? record.image);
    const images = photo ? imagesOf(photo, pageUrl) : imagesOf(record.photos ?? record.images, pageUrl);
    return buildVehicle(
      {
        year: String(year),
        make,
        model,
        trim: textOf(record.trim ?? record.series),
        price: String(price),
        mileage: String(mileage),
        vin: cleanVin(record.vin ?? record.VIN ?? record.vehicleIdentificationNumber),
        stock: textOf(record.stocknumber ?? record.stockNumber ?? record.stock).slice(0, 24),
        exterior: textOf(record.exteriorcolor ?? record.exteriorColor ?? record.exterior ?? record.color),
        interior: textOf(record.interiorcolor ?? record.interiorColor ?? record.interior),
        transmission: textOf(record.transmission ?? record.vehicleTransmission) || "Automatic",
        fuel: textOf(record.fuel ?? record.fuelType) || "Gasoline",
        body: bodyOf(record.body ?? record.bodyStyle ?? record.bodyType, model),
        description: typeof record.description === "string" ? record.description : ""
      },
      images,
      pageUrl,
      index
    );
  }
  function inventoryPrice(record) {
    const special = num2(record.specialprice ?? record.specialPrice);
    if (special >= 500) return special;
    for (const key of ["price", "internetPrice", "sellingPrice", "salePrice", "ourPrice", "msrp"]) {
      const price = num2(record[key]);
      if (price >= 500 && price <= 5e5) return price;
    }
    return 0;
  }
  function fromJsonLd(html, pageUrl) {
    const blocks = jsonLdBlocks(html);
    const out = [];
    let index = 0;
    for (const block of blocks) {
      walk(block, (node) => {
        if (!isVehicleNode(node)) return;
        const built = vehicleFromNode(node, pageUrl, index);
        if (built) {
          out.push(built);
          index += 1;
        }
      });
    }
    return out;
  }
  function jsonLdBlocks(html) {
    const out = [];
    const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while (match = re.exec(html)) {
      const raw = decode(match[1]).trim();
      if (!raw) continue;
      try {
        out.push(JSON.parse(raw));
      } catch {
        continue;
      }
    }
    return out;
  }
  function walkAll(node, visit, seen = /* @__PURE__ */ new Set()) {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walkAll(item, visit, seen);
      return;
    }
    const record = node;
    visit(record);
    for (const value of Object.values(record)) walkAll(value, visit, seen);
  }
  function walk(node, visit) {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
      return;
    }
    if (typeof node !== "object") return;
    const record = node;
    visit(record);
    for (const key of ["@graph", "itemListElement", "mainEntity", "item", "hasOfferCatalog"]) {
      if (key in record) walk(record[key], visit);
    }
  }
  function typeNames(record) {
    const raw = record["@type"];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.map((item) => String(item).toLowerCase().split("/").pop() || "");
  }
  function isVehicleNode(record) {
    const types = typeNames(record);
    if (types.some((type) => type === "offer" || type === "brand" || type === "aggregaterating" || type === "organization")) {
      return false;
    }
    const vin = cleanVin(record.vehicleIdentificationNumber ?? record.vin);
    const year = yearOf(record.vehicleModelDate ?? record.modelDate ?? record.productionDate ?? record.releaseDate);
    const vehicleType = types.some((type) => type === "vehicle" || type === "car" || type === "automobile");
    const product = types.includes("product");
    if (vehicleType) return Boolean(vin || year || record.name || record.model);
    if (product) return Boolean(vin || year);
    return Boolean(vin && (record.name || record.model));
  }
  function vehicleFromNode(record, pageUrl, index) {
    const brand = textOf(record.brand) || textOf(record.manufacturer);
    const named = splitName(typeof record.name === "string" ? record.name : "");
    const year = yearOf(record.vehicleModelDate ?? record.modelDate ?? record.productionDate) || named?.year || 0;
    const make = titleMake(brand || named?.make || "");
    const modelRaw = typeof record.model === "string" && record.model.trim() ? record.model : named?.model || "";
    const model = cleanModel(modelRaw);
    const trim = (typeof record.vehicleConfiguration === "string" ? record.vehicleConfiguration : "") || named?.trim || "";
    const price = priceOf(record.offers);
    const mileage = mileageOf(record.mileageFromOdometer ?? record.mileage);
    const images = imagesOf(record.image, pageUrl);
    return buildVehicle(
      {
        year: String(year),
        make,
        model,
        trim,
        price: String(price),
        mileage: String(mileage),
        vin: cleanVin(record.vehicleIdentificationNumber ?? record.vin),
        stock: String(record.sku ?? record.productID ?? record.mpn ?? "").slice(0, 24),
        exterior: textOf(record.color),
        interior: textOf(record.vehicleInteriorColor),
        transmission: textOf(record.vehicleTransmission) || "Automatic",
        fuel: textOf(record.fuelType) || "Gasoline",
        body: bodyOf(record.bodyType ?? record.vehicleSpecialUsage, model),
        description: typeof record.description === "string" ? record.description : ""
      },
      images,
      pageUrl,
      index
    );
  }
  function fromDataAttrs(html, pageUrl) {
    const out = [];
    const re = /<([a-z0-9:-]+)\b([^>]*\bdata-vin\s*=\s*["'][A-HJ-NPR-Z0-9]{17}["'][^>]*)>/gi;
    let match;
    let index = 0;
    while (match = re.exec(html)) {
      const attrs = match[2] ?? "";
      const slice = html.slice(match.index, match.index + 6e3);
      const named = splitName(attr(attrs, "data-title") || textTitle(slice) || "");
      const year = num2(attr(attrs, "data-year")) || named?.year || 0;
      const make = titleMake(attr(attrs, "data-make") || named?.make || "");
      const model = cleanModel(attr(attrs, "data-model") || named?.model || "");
      const price = num2(attr(attrs, "data-price") || attr(attrs, "data-internet-price") || attr(attrs, "data-sale-price")) || priceIn(slice);
      const mileage = num2(attr(attrs, "data-mileage") || attr(attrs, "data-miles") || attr(attrs, "data-odometer")) || milesIn(slice);
      const built = buildVehicle(
        {
          year: String(year),
          make,
          model,
          trim: attr(attrs, "data-trim") || named?.trim || "",
          price: String(price),
          mileage: String(mileage),
          vin: cleanVin(attr(attrs, "data-vin")),
          stock: attr(attrs, "data-stock") || attr(attrs, "data-stocknum") || attr(attrs, "data-stock-number"),
          exterior: attr(attrs, "data-exterior") || attr(attrs, "data-ext-color") || "",
          interior: attr(attrs, "data-interior") || "",
          transmission: attr(attrs, "data-transmission") || "Automatic",
          fuel: attr(attrs, "data-fuel") || "Gasoline",
          body: bodyOf(attr(attrs, "data-body"), model),
          description: ""
        },
        firstImages(slice, pageUrl),
        pageUrl,
        index
      );
      if (built) {
        out.push(built);
        index += 1;
      }
    }
    return out;
  }
  function fromPlain(html, pageUrl) {
    const lines = htmlToLines(html);
    const out = [];
    let index = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/\b(19[9]\d|20[0-2]\d)\s+([A-Za-z][A-Za-z-]{1,20})\s+([A-Za-z0-9][A-Za-z0-9-]{0,18})/);
      if (!match) continue;
      const make = titleMake(match[2]);
      if (!KNOWN_MAKES.has(make.toLowerCase()) && !KNOWN_MAKES.has(match[2].toLowerCase())) continue;
      let price = priceIn(line);
      let mileage = milesNear(lines, i);
      let vin = cleanVin(line);
      const window = lines.slice(i, i + 12);
      for (const next of window) {
        if (!price) price = priceIn(next);
        if (!vin) vin = cleanVin(next);
      }
      const built = buildVehicle(
        {
          year: match[1],
          make,
          model: cleanModel(match[3]),
          trim: "",
          price: String(price),
          mileage: String(mileage),
          vin,
          description: ""
        },
        [],
        pageUrl,
        index
      );
      if (built) {
        out.push(built);
        index += 1;
      }
    }
    return out;
  }
  function buildVehicle(row, images, pageUrl, index) {
    const base = vehicleFromRow(row, index);
    if (!base) return null;
    if (base.price < 500 && base.mileage < 1 && !base.vin) return null;
    if (base.price > 5e5) return null;
    const mileage = base.mileage > 5e5 ? 0 : base.mileage;
    const description = base.description.replace(/\s+/g, " ").trim().slice(0, 500);
    const imageUrls = images.filter((url) => /^https?:\/\//i.test(url) || url.startsWith("/")).slice(0, 8);
    return {
      ...base,
      mileage,
      description,
      imageUrls,
      notes: sourceNote(pageUrl)
    };
  }
  function sourceNote(pageUrl) {
    if (pageUrl.startsWith("demo:")) return "Pulled from the sample dealer page.";
    try {
      return `Pulled from ${new URL(pageUrl).hostname.replace(/^www\./, "")}.`;
    } catch {
      return "Pulled from a dealer page.";
    }
  }
  function htmlToLines(html) {
    const stripped = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<script[\s\S]*?<\/script>/gi, "\n").replace(/<style[\s\S]*?<\/style>/gi, "\n").replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n");
    const text = decode(stripped).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h1|h2|h3|h4|tr|td|section|article)>/gi, "\n").replace(/<[^>]+>/g, " ");
    return text.split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  }
  function textTitle(chunk) {
    const lines = htmlToLines(chunk);
    return lines.find((line) => /\b(19[9]\d|20[0-2]\d)\s+[A-Za-z]/.test(line)) || "";
  }
  function firstImages(chunk, pageUrl) {
    const urls = [];
    const re = /\b(?:src|data-src|data-image|data-lazy|data-srcset)\s*=\s*["']([^"']+)["']/gi;
    let match;
    while (match = re.exec(chunk)) {
      const raw = match[1].split(",")[0]?.trim().split(/\s+/)[0] ?? "";
      const url = resolveUrl(raw, pageUrl);
      if (!url) continue;
      if (/logo|icon|sprite|pixel|blank|placeholder|spinner/i.test(url)) continue;
      if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) continue;
      urls.push(url);
      if (urls.length >= 4) break;
    }
    return urls;
  }
  function resolveUrl(raw, base) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("javascript:")) return "";
    if (base.startsWith("demo:")) {
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (trimmed.startsWith("/")) return trimmed;
      return `/${trimmed.replace(/^\.\//, "")}`;
    }
    try {
      return new URL(trimmed, base).href;
    } catch {
      return "";
    }
  }
  function imagesOf(image, pageUrl) {
    const raw = Array.isArray(image) ? image : image ? [image] : [];
    const urls = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const url = resolveUrl(item, pageUrl);
        if (url) urls.push(url);
      } else if (item && typeof item === "object") {
        const record = item;
        const candidate = record.url ?? record.contentUrl;
        if (typeof candidate === "string") {
          const url = resolveUrl(candidate, pageUrl);
          if (url) urls.push(url);
        }
      }
    }
    return urls.filter((url) => /^https?:\/\//i.test(url) || url.startsWith("/")).slice(0, 8);
  }
  function priceOf(offers) {
    const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const record = item;
      const price = num2(record.price ?? record.lowPrice);
      if (price >= 500) return price;
    }
    return 0;
  }
  function mileageOf(value) {
    if (typeof value === "number" || typeof value === "string") return num2(value);
    if (value && typeof value === "object") {
      const record = value;
      return num2(record.value ?? record.Value);
    }
    return 0;
  }
  function textOf(value) {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const record = value;
      if (typeof record.name === "string") return record.name.trim();
    }
    return "";
  }
  function splitName(name) {
    const clean = name.replace(/^(certified|pre-owned|preowned|used|new)\s+/i, "").trim();
    const match = clean.match(/^(19[9]\d|20[0-2]\d)\s+(.+)$/);
    if (!match) return null;
    const year = Number(match[1]);
    const rest = match[2].trim();
    const lower = rest.toLowerCase();
    let make = "";
    let after = "";
    for (const multi of MULTI_MAKES) {
      if (lower.startsWith(`${multi} `)) {
        make = titleMake(multi);
        after = rest.slice(multi.length).trim();
        break;
      }
    }
    if (!make) {
      const parts = rest.split(/\s+/);
      make = titleMake(parts[0] ?? "");
      after = parts.slice(1).join(" ");
    }
    const modelParts = after.split(/\s+/).filter(Boolean);
    const model = modelParts[0] ?? "";
    if (!make || !model) return null;
    return { year, make, model, trim: modelParts.slice(1).join(" ") };
  }
  function titleMake(raw) {
    const value = raw.trim().replace(/\s+/g, " ");
    const lower = value.toLowerCase();
    if (lower === "mercedes-benz" || lower === "mercedes benz") return "Mercedes-Benz";
    if (lower === "land rover") return "Land Rover";
    if (lower === "alfa romeo") return "Alfa Romeo";
    if (lower === "chevy" || lower === "chevrolet") return "Chevrolet";
    if (lower === "vw" || lower === "volkswagen") return "Volkswagen";
    if (UPPER_MAKES.has(lower)) return lower.toUpperCase();
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
  function cleanModel(raw) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value) return "";
    if (/[A-Z]/.test(value)) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  function bodyOf(value, model) {
    const text = textOf(value);
    if (/truck|pickup/i.test(text)) return "Truck";
    if (/sedan/i.test(text)) return "Sedan";
    if (/suv|crossover|wagon/i.test(text)) return "SUV";
    if (/van/i.test(text)) return "Van";
    if (text && text.length < 20 && !/^car$/i.test(text)) return text;
    return model ? "" : "";
  }
  function yearOf(value) {
    const match = String(value ?? "").match(/(19[9]\d|20[0-2]\d)/);
    return match ? Number(match[1]) : 0;
  }
  function num2(value) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
    if (typeof value !== "string") return 0;
    const n = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  function priceIn(text) {
    const match = text.match(/\$\s?([\d,]{4,7})(?:\.\d{2})?/);
    if (!match) return 0;
    return num2(match[1]);
  }
  function milesNear(lines, index) {
    return milesIn(lines.slice(index, index + 8).join(" "));
  }
  function milesIn(text) {
    const withoutPrices = text.replace(/\$\s?[\d,]+(?:\.\d{2})?/g, " ");
    const collapsed = withoutPrices.replace(/(\d)\s+(?=\d)/g, "$1");
    const match = collapsed.match(/([\d,]{1,7})\s*(?:mi\b|miles?\b)/i);
    if (!match) return 0;
    const n = num2(match[1]);
    if (n < 1 || n > 5e5) return 0;
    return n;
  }
  function cleanVin(value) {
    const raw = String(value ?? "").toUpperCase();
    const labeled = raw.match(/\bVIN[:\s#-]*([A-HJ-NPR-Z0-9]{17})\b/);
    if (labeled) return labeled[1];
    const match = raw.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    return match ? match[1] : "";
  }
  function attr(source, name) {
    const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
    const match = source.match(re);
    return match ? decode(match[1]).trim() : "";
  }
  function decode(text) {
    const nbsp = "&nbsp;";
    const amp = "&amp;";
    const quot = "&quot;";
    const apos = "&apos;";
    const lt = "&lt;";
    const gt = "&gt;";
    return text.replaceAll(nbsp, " ").replaceAll(amp, "&").replaceAll(quot, '"').replaceAll(apos, "'").replaceAll("&#39;", "'").replaceAll(lt, "<").replaceAll(gt, ">").replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 65536 ? String.fromCharCode(code) : "";
    });
  }
  return __toCommonJS(scrape_exports);
})();
