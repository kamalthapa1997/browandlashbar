const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSquareMenuService,
  normalizePublicMenu,
} = require("../services/squareMenuService");

test("normalizes bookable Square variations into unique public menu rows", () => {
  const menu = normalizePublicMenu({
    categories: [
      {
        id: "brows",
        name: "Brows",
        services: [{
          id: "brow-shape",
          name: "Brow Shape",
          variations: [
            { id: "standard", name: "Standard", priceMoney: { amount: 2500, currency: "USD" } },
            { id: "deluxe", name: "Deluxe", priceMoney: { amount: 3500, currency: "USD" } },
          ],
        }],
      },
      {
        id: "uncategorized",
        name: "Uncategorized",
        services: [{
          id: "lash-lift",
          name: "Lash Lift",
          variations: [{ id: "lash-standard", name: "Standard", priceMoney: { amount: 7500, currency: "USD" } }],
        }],
      },
    ],
  });

  assert.deepEqual(menu, {
    categories: [
      {
        id: "brows",
        name: "Brows",
        services: [
          { id: "standard", itemId: "brow-shape", variationId: "standard", name: "Brow Shape — Standard", price: 25, currency: "USD" },
          { id: "deluxe", itemId: "brow-shape", variationId: "deluxe", name: "Brow Shape — Deluxe", price: 35, currency: "USD" },
        ],
      },
      {
        id: "other",
        name: "Other",
        services: [
          { id: "lash-standard", itemId: "lash-lift", variationId: "lash-standard", name: "Lash Lift", price: 75, currency: "USD" },
        ],
      },
    ],
  });
});

test("caches fresh menus and serves a bounded stale menu when Square fails", async () => {
  let time = 0;
  let calls = 0;
  let shouldFail = false;
  const service = createSquareMenuService({
    now: () => time,
    freshTtlMs: 100,
    staleTtlMs: 500,
    listBookingCatalogServicesFn: async () => {
      calls += 1;
      if (shouldFail) throw new Error("Square unavailable");
      return { categories: [] };
    },
  });

  assert.deepEqual(await service.getMenu(), { categories: [] });
  assert.deepEqual(await service.getMenu(), { categories: [] });
  assert.equal(calls, 1);

  time = 101;
  shouldFail = true;
  assert.deepEqual(await service.getMenu(), { categories: [] });
  assert.equal(calls, 2);

  time = 501;
  await assert.rejects(service.getMenu(), /Square unavailable/);
});
