const assert = require("node:assert/strict");
const test = require("node:test");

const {
  categoryValue,
  createGalleryCategory,
  deleteGalleryCategory,
  listGalleryCategories,
  normalizeCategoryLabel,
  syncLegacyGalleryCategories,
} = require("../services/galleryCategoryService");

function matchesValue(query, record) {
  if (query.value instanceof RegExp) return query.value.test(record.value);
  if (query.$or) return query.$or.some((condition) => matchesValue(condition, record) || (condition.label instanceof RegExp && condition.label.test(record.label)));
  return false;
}

function createModels(galleryCategories = []) {
  const records = [];
  const GalleryModel = {
    distinct: async () => galleryCategories,
    exists: async ({ category }) => galleryCategories.includes(category) ? { _id: "gallery-1" } : null,
  };
  const GalleryCategoryModel = {
    findOne: async (query) => records.find((record) => matchesValue(query, record)) || null,
    find: () => ({
      sort: async () => [...records].sort((first, second) => first.label.localeCompare(second.label)),
    }),
    create: async (values) => {
      const record = {
        _id: String(records.length + 1),
        ...values,
        async deleteOne() {
          records.splice(records.indexOf(record), 1);
        },
      };
      records.push(record);
      return record;
    },
    findById: async (id) => records.find((record) => record._id === id) || null,
  };
  return { GalleryModel, GalleryCategoryModel };
}

test("gallery category labels normalize to a unique API value", () => {
  assert.equal(normalizeCategoryLabel("  Signature   Facials "), "Signature Facials");
  assert.equal(categoryValue("Signature Facials"), "signature-facials");
  assert.equal(categoryValue("Élite Brows"), "elite-brows");
});

test("gallery categories synchronize legacy values only during explicit write-side maintenance", async () => {
  const models = createModels(["Brows", "Lift/Lamination"]);
  assert.deepEqual(await listGalleryCategories(models), []);

  await syncLegacyGalleryCategories(models);
  const legacyCategories = await listGalleryCategories(models);
  assert.deepEqual(
    legacyCategories.map(({ value, label }) => ({ value, label })),
    [
      { value: "Brows", label: "Brows" },
      { value: "Lift/Lamination", label: "Lift Lamination" },
    ],
  );

  const created = await createGalleryCategory("Facials", models);
  assert.equal(created.value, "facials");
  assert.equal(created.label, "Facials");
  await assert.rejects(() => createGalleryCategory("facials", models), { statusCode: 409 });
});

test("gallery categories cannot be deleted while an image uses them", async () => {
  const models = createModels(["Brows"]);
  await syncLegacyGalleryCategories(models);
  const [{ id: browsId }] = await listGalleryCategories(models);
  await assert.rejects(() => deleteGalleryCategory(browsId, models), { statusCode: 409 });

  const unused = await createGalleryCategory("Facials", models);
  await deleteGalleryCategory(unused.id, models);
  const remaining = await listGalleryCategories(models);
  assert.deepEqual(remaining.map((category) => category.value), ["Brows"]);
});
