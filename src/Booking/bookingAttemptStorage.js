export const BOOKING_ATTEMPT_STORAGE_KEY = "square-booking-attempt";

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
      ...(typeof variation.version === "number"
        ? { version: variation.version }
        : {}),
      ...(typeof variation.name === "string" ? { name: variation.name } : {}),
      ...(typeof variation.serviceName === "string"
        ? { serviceName: variation.serviceName }
        : {}),
      ...(Number.isFinite(variation.durationMs)
        ? { durationMs: variation.durationMs }
        : {}),
      ...(hasValidPrice
        ? {
            priceMoney: {
              amount: priceMoney.amount,
              currency: priceMoney.currency,
            },
          }
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

function normalizeBookingAttempt(attempt) {
  if (!attempt) {
    return null;
  }

  const sourceVariationIds = Array.isArray(attempt.variationIds)
    ? attempt.variationIds
    : typeof attempt.variationId === "string"
      ? [attempt.variationId]
      : null;

  if (
    !sourceVariationIds ||
    sourceVariationIds.length === 0 ||
    sourceVariationIds.some(
      (variationId) => typeof variationId !== "string" || !variationId,
    )
  ) {
    return null;
  }

  const variationIds = [...new Set(sourceVariationIds)].sort();

  if (variationIds.length !== sourceVariationIds.length) {
    return null;
  }

  const selectedVariations = attempt.selectedVariations
    ? normalizeSelectedVariations(attempt.selectedVariations, variationIds)
    : null;

  if (attempt.selectedVariations && !selectedVariations) {
    return null;
  }

  const hasBookingAttempt =
    typeof attempt.bookingAttemptId === "string" &&
    typeof attempt.startAt === "string" &&
    attempt.customer &&
    typeof attempt.customer === "object";

  if (!hasBookingAttempt && !selectedVariations) {
    return null;
  }

  return {
    ...(hasBookingAttempt
      ? {
          bookingAttemptId: attempt.bookingAttemptId,
          startAt: attempt.startAt,
          customer: attempt.customer,
        }
      : {}),
    variationIds,
    ...(selectedVariations ? { selectedVariations } : {}),
  };
}

export function loadBookingAttempt() {
  try {
    const value = window.sessionStorage.getItem(BOOKING_ATTEMPT_STORAGE_KEY);
    if (!value) return null;
    const attempt = normalizeBookingAttempt(JSON.parse(value));
    if (!attempt) {
      window.sessionStorage.removeItem(BOOKING_ATTEMPT_STORAGE_KEY);
      return null;
    }

    window.sessionStorage.setItem(
      BOOKING_ATTEMPT_STORAGE_KEY,
      JSON.stringify(attempt),
    );

    return attempt;
  } catch {
    window.sessionStorage.removeItem(BOOKING_ATTEMPT_STORAGE_KEY);
    return null;
  }
}

export function saveBookingAttempt(attempt) {
  const normalizedAttempt = normalizeBookingAttempt(attempt);

  if (!normalizedAttempt) {
    throw new Error("Cannot store an invalid booking attempt.");
  }

  window.sessionStorage.setItem(
    BOOKING_ATTEMPT_STORAGE_KEY,
    JSON.stringify(normalizedAttempt),
  );
}

export function clearBookingAttempt() {
  window.sessionStorage.removeItem(BOOKING_ATTEMPT_STORAGE_KEY);
}
