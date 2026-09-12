const { listBookingCatalogServices } = require("./squareService");

const DEFAULT_FRESH_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 60 * 60 * 1000;

function normalizedName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toPublicPrice(priceMoney) {
  if (!Number.isFinite(priceMoney?.amount)) return null;

  return priceMoney.amount / 100;
}

function toPublicService(service, variation) {
  const variationName = normalizedName(variation.name);
  const hasMultipleVariations = service.variations.length > 1;

  return {
    id: variation.id,
    itemId: service.id,
    variationId: variation.id,
    name:
      hasMultipleVariations && variationName
        ? `${service.name} — ${variationName}`
        : service.name,
    price: toPublicPrice(variation.priceMoney),
    currency: normalizedName(variation.priceMoney?.currency) || "USD",
  };
}

function normalizePublicMenu(catalog) {
  const seenVariationIds = new Set();
  const categories = [];

  for (const category of catalog?.categories || []) {
    const services = [];

    for (const service of category.services || []) {
      if (!normalizedName(service?.name) || !service?.id) continue;

      for (const variation of service.variations || []) {
        if (!variation?.id || seenVariationIds.has(variation.id)) continue;
        seenVariationIds.add(variation.id);
        services.push(toPublicService(service, variation));
      }
    }

    if (!services.length) continue;

    const isUncategorized = category.id === "uncategorized";
    categories.push({
      id: isUncategorized ? "other" : category.id,
      name: isUncategorized ? "Other" : normalizedName(category.name) || "Other",
      services,
    });
  }

  return { categories };
}

function createSquareMenuService({
  listBookingCatalogServicesFn = listBookingCatalogServices,
  now = () => Date.now(),
  freshTtlMs = DEFAULT_FRESH_TTL_MS,
  staleTtlMs = DEFAULT_STALE_TTL_MS,
} = {}) {
  let cached;
  let refreshInFlight;

  async function getMenu() {
    const currentTime = now();
    if (cached && currentTime < cached.freshUntil) return cached.value;
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = Promise.resolve()
      .then(listBookingCatalogServicesFn)
      .then((catalog) => {
        const value = normalizePublicMenu(catalog);
        const fetchedAt = now();
        cached = {
          value,
          freshUntil: fetchedAt + freshTtlMs,
          staleUntil: fetchedAt + staleTtlMs,
        };
        return value;
      })
      .catch((error) => {
        if (cached && now() < cached.staleUntil) return cached.value;
        throw error;
      })
      .finally(() => {
        refreshInFlight = undefined;
      });

    return refreshInFlight;
  }

  return { getMenu };
}

const publicMenuService = createSquareMenuService();

module.exports = {
  createSquareMenuService,
  getPublicMenu: publicMenuService.getMenu,
  normalizePublicMenu,
};
