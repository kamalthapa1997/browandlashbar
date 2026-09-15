export const BOOKING_ATTEMPT_STORAGE_KEY = "square-booking-attempt";
export const BOOKING_DRAFT_STORAGE_VERSION = 2;

// This matches the server-side BookingAttempt TTL. It gives a customer enough
// time to recover an accidental close without retaining contact details
// indefinitely on a shared device.
export const BOOKING_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const customerFields = ["firstName", "lastName", "phone", "email"];

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getLegacyStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeCustomer(customer) {
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    return null;
  }

  const normalized = {};
  for (const field of customerFields) {
    if (typeof customer[field] !== "string") return null;
    normalized[field] = customer[field];
  }

  return normalized;
}

function normalizeVariationIds(sourceVariationIds) {
  if (
    !Array.isArray(sourceVariationIds) ||
    !sourceVariationIds.length ||
    sourceVariationIds.some(
      (variationId) => typeof variationId !== "string" || !variationId,
    )
  ) {
    return null;
  }

  const variationIds = [...new Set(sourceVariationIds)].sort();
  return variationIds.length === sourceVariationIds.length ? variationIds : null;
}

function normalizeSelectedVariations(selectedVariations, variationIds) {
  if (!Array.isArray(selectedVariations) || !selectedVariations.length) {
    return null;
  }

  const normalizedVariations = selectedVariations.map((variation) => {
    if (!variation || typeof variation.id !== "string" || !variation.id) {
      return null;
    }

    const priceMoney = variation.priceMoney;
    const hasValidPrice =
      priceMoney &&
      Number.isFinite(priceMoney.amount) &&
      typeof priceMoney.currency === "string" &&
      priceMoney.currency;

    return {
      id: variation.id,
      ...(typeof variation.version === "number" ? { version: variation.version } : {}),
      ...(typeof variation.name === "string" ? { name: variation.name } : {}),
      ...(typeof variation.serviceName === "string" ? { serviceName: variation.serviceName } : {}),
      ...(Number.isFinite(variation.durationMs) ? { durationMs: variation.durationMs } : {}),
      ...(hasValidPrice
        ? { priceMoney: { amount: priceMoney.amount, currency: priceMoney.currency } }
        : {}),
    };
  });

  if (
    normalizedVariations.some((variation) => !variation) ||
    normalizedVariations.length !== variationIds.length ||
    [...new Set(normalizedVariations.map((variation) => variation.id))]
      .sort()
      .join(",") !== variationIds.join(",")
  ) {
    return null;
  }

  return normalizedVariations;
}

function normalizeStartAt(startAt) {
  if (typeof startAt !== "string" || Number.isNaN(new Date(startAt).getTime())) {
    return "";
  }
  return startAt;
}

function normalizeSelectedSlot(slot, variationIds) {
  if (!slot || typeof slot !== "object") return null;

  const startAt = normalizeStartAt(slot.startAt);
  const availabilityDate = slot.availabilityDate;
  const slotVariationIds = normalizeVariationIds(slot.variationIds);

  if (
    !startAt ||
    !isValidDate(availabilityDate) ||
    !slotVariationIds ||
    slotVariationIds.join(",") !== variationIds.join(",")
  ) {
    return null;
  }

  return { startAt, availabilityDate, variationIds: slotVariationIds };
}

function normalizeUpdatedAt(updatedAt) {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return 0;
  return updatedAt;
}

function normalizeVersionTwoDraft(draft) {
  const variationIds = normalizeVariationIds(draft.variationIds);
  const customer = draft.customer
    ? normalizeCustomer(draft.customer)
    : { firstName: "", lastName: "", phone: "", email: "" };
  const updatedAt = normalizeUpdatedAt(draft.updatedAt);
  const now = Date.now();

  if (
    !variationIds ||
    !customer ||
    !updatedAt ||
    updatedAt > now + 5 * 60 * 1000 ||
    now - updatedAt > BOOKING_DRAFT_MAX_AGE_MS
  ) {
    return null;
  }

  const selectedVariations = draft.selectedVariations
    ? normalizeSelectedVariations(draft.selectedVariations, variationIds)
    : null;
  if (draft.selectedVariations && !selectedVariations) return null;

  const selectedSlot = draft.selectedSlot
    ? normalizeSelectedSlot(draft.selectedSlot, variationIds)
    : null;
  if (draft.selectedSlot && !selectedSlot) return null;

  const bookingAttemptId =
    typeof draft.bookingAttemptId === "string" && draft.bookingAttemptId
      ? draft.bookingAttemptId
      : "";
  const startAt = draft.startAt ? normalizeStartAt(draft.startAt) : "";

  if ((bookingAttemptId && !startAt) || (!bookingAttemptId && startAt)) return null;
  if (startAt && selectedSlot && startAt !== selectedSlot.startAt) return null;

  return {
    version: BOOKING_DRAFT_STORAGE_VERSION,
    updatedAt,
    variationIds,
    ...(selectedVariations ? { selectedVariations } : {}),
    ...(isValidDate(draft.date) ? { date: draft.date } : {}),
    ...(selectedSlot ? { selectedSlot } : {}),
    customer,
    reviewingBooking: Boolean(draft.reviewingBooking && selectedSlot),
    ...(bookingAttemptId ? { bookingAttemptId, startAt } : {}),
  };
}

// Version 1 was an unversioned session-storage record. Keep it readable so a
// customer with a draft open during deployment is not sent back to square one.
function migrateLegacyDraft(attempt) {
  const sourceVariationIds = Array.isArray(attempt?.variationIds)
    ? attempt.variationIds
    : typeof attempt?.variationId === "string"
      ? [attempt.variationId]
      : null;
  const variationIds = normalizeVariationIds(sourceVariationIds);
  if (!variationIds) return null;

  const selectedVariations = attempt.selectedVariations
    ? normalizeSelectedVariations(attempt.selectedVariations, variationIds)
    : null;
  if (attempt.selectedVariations && !selectedVariations) return null;

  const bookingAttemptId =
    typeof attempt.bookingAttemptId === "string" && attempt.bookingAttemptId
      ? attempt.bookingAttemptId
      : "";
  const startAt = bookingAttemptId ? normalizeStartAt(attempt.startAt) : "";
  const customer = bookingAttemptId ? normalizeCustomer(attempt.customer) : null;
  if ((bookingAttemptId && (!startAt || !customer)) || (!bookingAttemptId && !selectedVariations)) {
    return null;
  }

  return {
    version: BOOKING_DRAFT_STORAGE_VERSION,
    updatedAt: Date.now(),
    variationIds,
    ...(selectedVariations ? { selectedVariations } : {}),
    ...(bookingAttemptId
      ? {
          bookingAttemptId,
          startAt,
          customer,
        }
      : {
          customer: { firstName: "", lastName: "", phone: "", email: "" },
        }),
    reviewingBooking: false,
  };
}

function clearStorages() {
  try { getStorage()?.removeItem(BOOKING_ATTEMPT_STORAGE_KEY); } catch {}
  try { getLegacyStorage()?.removeItem(BOOKING_ATTEMPT_STORAGE_KEY); } catch {}
}

export function loadBookingAttempt() {
  let rawValue = null;
  let fromLegacyStorage = false;

  try {
    rawValue = getStorage()?.getItem(BOOKING_ATTEMPT_STORAGE_KEY) || null;
    if (!rawValue) {
      rawValue = getLegacyStorage()?.getItem(BOOKING_ATTEMPT_STORAGE_KEY) || null;
      fromLegacyStorage = Boolean(rawValue);
    }
  } catch {
    return null;
  }

  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    const draft = parsed?.version === BOOKING_DRAFT_STORAGE_VERSION
      ? normalizeVersionTwoDraft(parsed)
      : migrateLegacyDraft(parsed);

    if (!draft) {
      clearStorages();
      return null;
    }

    // Migrate legacy session records and normalize any valid stored record.
    if (fromLegacyStorage || parsed.version !== BOOKING_DRAFT_STORAGE_VERSION) {
      saveBookingAttempt(draft);
    }

    return draft;
  } catch {
    clearStorages();
    return null;
  }
}

export function saveBookingAttempt(draft) {
  const normalizedDraft = normalizeVersionTwoDraft({
    ...draft,
    version: BOOKING_DRAFT_STORAGE_VERSION,
    updatedAt: Date.now(),
  });

  if (!normalizedDraft) {
    throw new Error("Cannot store an invalid booking draft.");
  }

  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(BOOKING_ATTEMPT_STORAGE_KEY, JSON.stringify(normalizedDraft));
    getLegacyStorage()?.removeItem(BOOKING_ATTEMPT_STORAGE_KEY);
  } catch {
    // Storage can be disabled or full. Booking remains usable in memory.
  }
}

export function clearBookingAttempt() {
  clearStorages();
}
