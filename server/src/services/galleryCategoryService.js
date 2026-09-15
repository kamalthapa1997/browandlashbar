const Gallery = require("../models/Gallery");
const GalleryCategory = require("../models/GalleryCategory");
const createHttpError = require("../utils/httpError");

function categoryLabel(value) {
  return value
    .trim()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCategoryLabel(label) {
  if (typeof label !== "string") return "";
  return label.trim().replace(/\s+/g, " ");
}

function categoryValue(label) {
  return normalizeCategoryLabel(label)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatCategory(category) {
  return {
    id: String(category._id),
    value: category.value,
    label: category.label,
  };
}

function exactValueExpression(value) {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
}

function resolveModels(models = {}) {
  return {
    GalleryModel: models.GalleryModel || Gallery,
    GalleryCategoryModel: models.GalleryCategoryModel || GalleryCategory,
  };
}

async function syncLegacyGalleryCategories(models) {
  const { GalleryModel, GalleryCategoryModel } = resolveModels(models);
  const values = await GalleryModel.distinct("category", {
    category: { $type: "string", $ne: "" },
  });
  const legacyValues = [
    ...new Map(
      values
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value]),
    ).values(),
  ];

  for (const value of legacyValues) {
    const existing = await GalleryCategoryModel.findOne({
      value: exactValueExpression(value),
    });
    if (!existing) {
      await GalleryCategoryModel.create({ value, label: categoryLabel(value) });
    }
  }
}

async function listGalleryCategories(models) {
  const { GalleryCategoryModel } = resolveModels(models);
  const categories = await GalleryCategoryModel.find({}).sort({ label: 1, createdAt: 1 });
  return categories.map(formatCategory);
}

async function findGalleryCategory(value, models) {
  if (typeof value !== "string" || !value.trim()) return null;
  const { GalleryCategoryModel } = resolveModels(models);
  await syncLegacyGalleryCategories(models);
  return GalleryCategoryModel.findOne({ value: exactValueExpression(value.trim()) });
}

async function createGalleryCategory(label, models) {
  const normalizedLabel = normalizeCategoryLabel(label);
  if (!normalizedLabel) throw createHttpError(400, "Category name is required");
  if (normalizedLabel.length > 80) {
    throw createHttpError(400, "Category name must be 80 characters or fewer");
  }

  const value = categoryValue(normalizedLabel);
  if (!value) throw createHttpError(400, "Category name must include letters or numbers");

  const { GalleryCategoryModel } = resolveModels(models);
  await syncLegacyGalleryCategories(models);
  const existing = await GalleryCategoryModel.findOne({
    $or: [
      { value: exactValueExpression(value) },
      { label: exactValueExpression(normalizedLabel) },
    ],
  });
  if (existing) throw createHttpError(409, "A gallery category with that name already exists");

  try {
    return formatCategory(
      await GalleryCategoryModel.create({ label: normalizedLabel, value }),
    );
  } catch (error) {
    if (error.code === 11000) {
      throw createHttpError(409, "A gallery category with that name already exists");
    }
    throw error;
  }
}

async function deleteGalleryCategory(categoryId, models) {
  const { GalleryModel, GalleryCategoryModel } = resolveModels(models);
  const category = await GalleryCategoryModel.findById(categoryId);
  if (!category) throw createHttpError(404, "Gallery category not found");

  const inUse = await GalleryModel.exists({ category: category.value });
  if (inUse) {
    throw createHttpError(
      409,
      "This category cannot be deleted because gallery images are using it.",
    );
  }

  await category.deleteOne();
}

module.exports = {
  categoryValue,
  createGalleryCategory,
  deleteGalleryCategory,
  findGalleryCategory,
  listGalleryCategories,
  normalizeCategoryLabel,
  syncLegacyGalleryCategories,
  __testables: { categoryLabel, exactValueExpression, formatCategory },
};
