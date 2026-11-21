import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDealerLot } from "./scrape.ts";
import { usePoster } from "./store.ts";
import type { Vehicle } from "./model.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fullHtml = readFileSync(join(here, "fixtures/lot-full.html"), "utf8");
const nextHtml = readFileSync(join(here, "fixtures/lot-next.html"), "utf8");
const partialHtml = readFileSync(join(here, "fixtures/lot-partial.html"), "utf8");

const NORTH = "https://northside.example/inventory";
const SOUTH = "https://southside.example/inventory";

const HONDA = "1HGCY2F53MA123456";
const RAV4 = "2T3BFREV5NW654321";
const FORD = "1FTEW1E58LFA12345";
const ROGUE = "5N1AT2MT8LC123456";

const expected = [
  { vin: HONDA, year: 2021, make: "Honda", model: "CR-V", price: 24989, mileage: 38412 },
  { vin: RAV4, year: 2022, make: "Toyota", model: "RAV4", price: 28995, mileage: 22150 },
  { vin: FORD, year: 2020, make: "Ford", model: "F-150", price: 32500, mileage: 45600 },
  { vin: ROGUE, year: 2019, make: "Nissan", model: "Rogue", price: 19450, mileage: 51200 },
];

function lot(html: string, url = NORTH) {
  return parseDealerLot(html, url);
}

function byVin(vehicles: Vehicle[], vin: string) {
  const car = vehicles.find((item) => item.vin === vin);
  assert.ok(car, vin);
  return car;
}

function assertParsed(vehicles: Vehicle[], vins: string[]) {
  assert.deepEqual(
    vehicles.map((car) => car.vin).sort(),
    [...vins].sort(),
  );
  for (const vin of vins) {
    const want = expected.find((item) => item.vin === vin);
    assert.ok(want);
    const car = byVin(vehicles, vin);
    assert.equal(car.year, want.year);
    assert.equal(car.make, want.make);
    assert.equal(car.model, want.model);
    assert.equal(car.price, want.price);
    assert.equal(car.mileage, want.mileage);
    assert.equal(car.vin, want.vin);
  }
}

function pull(html: string, url: string, truncated = false) {
  const parsed = lot(html, url);
  const flag = truncated || parsed.truncated;
  const summary = usePoster.getState().applyDealerPull(parsed.vehicles, url, flag);
  return { parsed, summary, vehicles: usePoster.getState().vehicles };
}

describe("dealer pull", { concurrency: false }, () => {
  beforeEach(() => {
    usePoster.setState({
      vehicles: [],
      logs: [],
      dealerUrl: "",
      selectedId: "",
      drafts: {},
    });
  });

  it("parses year, make, model, price, miles, and VIN from a full inventory page", () => {
    const parsed = lot(fullHtml);
    assert.equal(parsed.truncated, false);
    assertParsed(parsed.vehicles, [HONDA, RAV4, FORD]);
  });

  it("parses the next page when one VIN is gone and one VIN is new", () => {
    const parsed = lot(nextHtml);
    assert.equal(parsed.truncated, false);
    assertParsed(parsed.vehicles, [HONDA, FORD, ROGUE]);
    assert.equal(
      parsed.vehicles.some((car) => car.vin === RAV4),
      false,
    );
  });

  it("parses a short partial page without treating it as the whole lot", () => {
    const parsed = lot(partialHtml);
    assert.equal(parsed.truncated, false);
    assertParsed(parsed.vehicles, [HONDA]);
    assert.ok(parsed.vehicles.length < lot(fullHtml).vehicles.length);
  });

  it("only fills the lot on the first pull", () => {
    const { summary, vehicles } = pull(fullHtml, NORTH);
    assert.equal(summary.added, 3);
    assert.deepEqual(summary.arrived, []);
    assert.deepEqual(summary.sold, []);
    assert.equal(vehicles.length, 3);
    for (const car of vehicles) {
      assert.equal(car.status, "stock");
      assert.equal(car.soldByDealer, undefined);
      assert.equal(car.arrivedAt ?? null, null);
      assert.equal(car.fromDealer, true);
    }
  });

  it("marks a missing stock car sold and flags the new car on a second full pull", () => {
    pull(fullHtml, NORTH);
    const { summary, vehicles } = pull(nextHtml, NORTH);
    const gone = byVin(vehicles, RAV4);
    const arrived = byVin(vehicles, ROGUE);
    const kept = byVin(vehicles, HONDA);
    assert.equal(gone.status, "sold");
    assert.equal(gone.soldByDealer, true);
    assert.equal(typeof arrived.arrivedAt, "string");
    assert.ok(arrived.arrivedAt);
    assert.equal(arrived.status, "stock");
    assert.equal(kept.status, "stock");
    assert.equal(kept.soldByDealer ?? false, false);
    assert.ok(summary.sold.some((title) => title.includes("RAV4")));
    assert.ok(summary.arrived.some((title) => title.includes("Rogue")));
  });

  it("does not mark the rest of the lot sold from a partial page", () => {
    pull(fullHtml, NORTH);
    const partial = lot(partialHtml);
    assert.equal(partial.truncated, false);
    assert.ok(partial.vehicles.length < usePoster.getState().vehicles.length);
    const { vehicles } = pull(partialHtml, NORTH, partial.truncated);
    for (const vin of [HONDA, RAV4, FORD]) {
      const car = byVin(vehicles, vin);
      assert.equal(car.status, "stock");
      assert.equal(car.soldByDealer ?? false, false);
    }
  });

  it("does not mark the rest of the lot sold when the pull is truncated", () => {
    pull(fullHtml, NORTH);
    const { vehicles } = pull(nextHtml, NORTH, true);
    const gone = byVin(vehicles, RAV4);
    assert.equal(gone.status, "stock");
    assert.equal(gone.soldByDealer ?? false, false);
    for (const car of vehicles) {
      if (car.vin === ROGUE) continue;
      assert.equal(car.status, "stock");
      assert.equal(car.soldByDealer ?? false, false);
    }
  });

  it("does not mark the first dealer’s cars sold when the host changes", () => {
    pull(fullHtml, NORTH);
    const { vehicles } = pull(nextHtml, SOUTH);
    for (const vin of [HONDA, RAV4, FORD]) {
      const car = byVin(vehicles, vin);
      assert.equal(car.status, "stock");
      assert.equal(car.soldByDealer ?? false, false);
    }
    const arrived = byVin(vehicles, ROGUE);
    assert.equal(arrived.arrivedAt ?? null, null);
    assert.equal(arrived.status, "stock");
  });
});
