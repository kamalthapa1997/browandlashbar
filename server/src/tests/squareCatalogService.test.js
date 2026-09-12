const assert = require("node:assert/strict");
const test = require("node:test");

const {
  listBookingCatalogServices,
  retrieveServiceVariation,
} = require("../services/squareService");

function appointmentItem({ id, name, categories = [], variations }) {
  return {
    id,
    type: "ITEM",
    item_data: {
      name,
      product_type: "APPOINTMENTS_SERVICE",
      categories,
      variations,
    },
  };
}

function variation({ id, name, bookable, version = 1 }) {
  return {
    id,
    type: "ITEM_VARIATION",
    version,
    item_variation_data: {
      name,
      available_for_booking: bookable,
      service_duration: 30 * 60 * 1000,
      price_money: { amount: 2500, currency: "USD" },
    },
  };
}

test("projects every page of Square appointment services into deterministic category groups", async () => {
  const calls = [];
  const firstPageItem = appointmentItem({
    id: "item-brow",
    name: "Brow Shape",
    categories: [
      { id: "category-brows", ordinal: 2 },
      { id: "category-featured", ordinal: 1 },
    ],
    variations: [
      variation({ id: "variation-standard", name: "Standard", bookable: true }),
      variation({ id: "variation-hidden", name: "Hidden", bookable: false }),
    ],
  });
  const secondPageItem = appointmentItem({
    id: "item-lash",
    name: "Lash Lift",
    categories: [{ id: "category-lashes", ordinal: 0 }],
    variations: [
      variation({ id: "variation-classic", name: "Classic", bookable: true }),
      variation({ id: "variation-deluxe", name: "Deluxe", bookable: true, version: 2 }),
    ],
  });
  const noBookableVariation = appointmentItem({
    id: "item-hidden",
    name: "Hidden service",
    categories: [{ id: "category-brows", ordinal: 0 }],
    variations: [variation({ id: "variation-not-bookable", name: "Nope", bookable: false })],
  });
  const squareFetch = async (path, options) => {
    calls.push({ path, options });
    if (path === "/catalog/search-catalog-items" && !options.body.cursor) {
      return { items: [firstPageItem], cursor: "next-page" };
    }
    if (path === "/catalog/search-catalog-items") {
      assert.equal(options.body.cursor, "next-page");
      return { items: [secondPageItem, noBookableVariation] };
    }
    if (path === "/catalog/batch-retrieve") {
      assert.deepEqual(options.body.object_ids.sort(), [
        "category-brows",
        "category-featured",
        "category-lashes",
      ]);
      return {
        objects: [
          { id: "category-brows", type: "CATEGORY", category_data: { name: "Brows" } },
          { id: "category-featured", type: "CATEGORY", category_data: { name: "Featured" } },
          { id: "category-lashes", type: "CATEGORY", category_data: { name: "Lashes" } },
        ],
      };
    }
    assert.fail(`Unexpected Square request: ${path}`);
  };

  const catalog = await listBookingCatalogServices({ squareFetch });

  assert.equal(calls.filter((call) => call.path === "/catalog/search-catalog-items").length, 2);
  assert.equal(
    calls.find((call) => call.path === "/catalog/search-catalog-items").options.body.archived_state,
    "ARCHIVED_STATE_NOT_ARCHIVED",
  );
  assert.deepEqual(
    catalog.categories.map((category) => category.name),
    ["Featured", "Lashes"],
  );
  assert.deepEqual(catalog.categories[0], {
    id: "category-featured",
    name: "Featured",
    services: [{
      id: "item-brow",
      name: "Brow Shape",
      variations: [{
        id: "variation-standard",
        version: 1,
        name: "Standard",
        durationMs: 30 * 60 * 1000,
        priceMoney: { amount: 2500, currency: "USD" },
      }],
    }],
  });
  assert.deepEqual(
    catalog.categories[1].services[0].variations.map((item) => item.id),
    ["variation-classic", "variation-deluxe"],
  );
  assert.equal(JSON.stringify(catalog).includes("variation-hidden"), false);
  assert.equal(JSON.stringify(catalog).includes("item-hidden"), false);
});

test("excludes archived and deleted appointment catalog objects", async () => {
  const catalog = await listBookingCatalogServices({
    squareFetch: async (path) => {
      assert.equal(path, "/catalog/search-catalog-items");
      return {
        items: [
          {
            ...appointmentItem({
              id: "deleted-item",
              name: "Deleted service",
              variations: [variation({ id: "deleted-item-variation", name: "Standard", bookable: true })],
            }),
            is_deleted: true,
          },
          {
            ...appointmentItem({
              id: "archived-item",
              name: "Archived service",
              variations: [variation({ id: "archived-item-variation", name: "Standard", bookable: true })],
            }),
            item_data: {
              ...appointmentItem({
                id: "archived-item",
                name: "Archived service",
                variations: [variation({ id: "archived-item-variation", name: "Standard", bookable: true })],
              }).item_data,
              is_archived: true,
            },
          },
          appointmentItem({
            id: "deleted-variation-item",
            name: "Deleted variation service",
            variations: [{
              ...variation({ id: "deleted-variation", name: "Standard", bookable: true }),
              is_deleted: true,
            }],
          }),
        ],
      };
    },
  });

  assert.deepEqual(catalog, { categories: [] });
});

test("uses a generic uncategorized group only when Square supplies no category", async () => {
  const catalog = await listBookingCatalogServices({
    squareFetch: async (path) => {
      if (path === "/catalog/search-catalog-items") {
        return {
          items: [appointmentItem({
            id: "item-uncategorized",
            name: "Standalone service",
            variations: [variation({ id: "variation-standalone", name: "Standard", bookable: true })],
          })],
        };
      }
      assert.fail(`No category lookup is needed for ${path}`);
    },
  });

  assert.deepEqual(catalog.categories.map(({ id, name }) => ({ id, name })), [
    { id: "uncategorized", name: "Uncategorized" },
  ]);
});

test("rejects a Square variation that is not bookable", async () => {
  await assert.rejects(
    retrieveServiceVariation("variation-not-bookable", {
      squareFetch: async () => ({
        object: variation({ id: "variation-not-bookable", name: "Hidden", bookable: false }),
      }),
    }),
    { statusCode: 422, errorCode: "SERVICE_NOT_BOOKABLE" },
  );
});

test("rejects deleted variations and non-appointment parent services", async () => {
  await assert.rejects(
    retrieveServiceVariation("deleted-variation", {
      squareFetch: async () => ({
        object: {
          ...variation({ id: "deleted-variation", name: "Deleted", bookable: true }),
          is_deleted: true,
        },
      }),
    }),
    { statusCode: 422, errorCode: "SERVICE_NOT_BOOKABLE" },
  );

  await assert.rejects(
    retrieveServiceVariation("non-appointment-variation", {
      squareFetch: async () => ({
        object: {
          ...variation({ id: "non-appointment-variation", name: "Standard", bookable: true }),
          item_variation_data: {
            ...variation({ id: "non-appointment-variation", name: "Standard", bookable: true })
              .item_variation_data,
            item_id: "retail-item",
          },
        },
        related_objects: [{
          id: "retail-item",
          type: "ITEM",
          item_data: { name: "Retail item", product_type: "REGULAR" },
        }],
      }),
    }),
    { statusCode: 422, errorCode: "SERVICE_NOT_BOOKABLE" },
  );
});

test("uses the parent Square item name for booking confirmation metadata", async () => {
  const result = await retrieveServiceVariation("variation-brow-shape", {
    squareFetch: async () => ({
      object: {
        ...variation({ id: "variation-brow-shape", name: "Standard", bookable: true }),
        item_variation_data: {
          ...variation({ id: "variation-brow-shape", name: "Standard", bookable: true })
            .item_variation_data,
          item_id: "item-brow-shape",
        },
      },
      related_objects: [{
        id: "item-brow-shape",
        type: "ITEM",
        item_data: { name: "Brow Shape", product_type: "APPOINTMENTS_SERVICE" },
      }],
    }),
  });

  assert.equal(result.variation.id, "variation-brow-shape");
  assert.equal(result.serviceName, "Brow Shape");
});
