import {
  BOOKING_ATTEMPT_STORAGE_KEY,
  clearBookingAttempt,
  loadBookingAttempt,
  saveBookingAttempt,
} from "../bookingAttemptStorage";

const attempt = {
  bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e",
  variationIds: ["square-variation-1"],
  startAt: "2026-09-14T13:00:00Z",
  customer: {
    firstName: "LANA",
    lastName: "sinaha",
    phone: "2891892191",
    email: "luma@example.com",
  },
};

beforeEach(() => window.sessionStorage.clear());

test("retains a booking attempt for recovery after a browser refresh", () => {
  saveBookingAttempt(attempt);

  expect(loadBookingAttempt()).toEqual(attempt);
});

test("retains a selected Square cart before a booking attempt exists", () => {
  const cart = {
    variationIds: ["square-variation-1"],
    selectedVariations: [
      {
        id: "square-variation-1",
        version: 2,
        name: "Deluxe",
        serviceName: "Brow Tint",
        durationMs: 45 * 60 * 1000,
        priceMoney: { amount: 3500, currency: "USD" },
      },
    ],
  };

  saveBookingAttempt(cart);

  expect(loadBookingAttempt()).toEqual(cart);
});

test("stores variation IDs in canonical order", () => {
  saveBookingAttempt({
    ...attempt,
    variationIds: ["square-variation-2", "square-variation-1"],
  });

  expect(loadBookingAttempt().variationIds).toEqual([
    "square-variation-1",
    "square-variation-2",
  ]);
});

test("clears an active booking attempt after confirmation", () => {
  saveBookingAttempt(attempt);
  clearBookingAttempt();

  expect(window.sessionStorage.getItem(BOOKING_ATTEMPT_STORAGE_KEY)).toBeNull();
  expect(loadBookingAttempt()).toBeNull();
});

test("migrates a valid legacy single-variation attempt", () => {
  const legacyAttempt = {
    ...attempt,
    variationIds: undefined,
    variationId: "square-variation-1",
  };

  window.sessionStorage.setItem(
    BOOKING_ATTEMPT_STORAGE_KEY,
    JSON.stringify(legacyAttempt),
  );

  expect(loadBookingAttempt()).toEqual(attempt);
  expect(
    JSON.parse(window.sessionStorage.getItem(BOOKING_ATTEMPT_STORAGE_KEY)),
  ).toEqual(attempt);
});

test("clears a legacy Mongo service attempt instead of sending it to Square", () => {
  window.sessionStorage.setItem(
    BOOKING_ATTEMPT_STORAGE_KEY,
    JSON.stringify({
      ...attempt,
      variationIds: undefined,
      serviceId: "507f1f77bcf86cd799439011",
    }),
  );

  expect(loadBookingAttempt()).toBeNull();
  expect(window.sessionStorage.getItem(BOOKING_ATTEMPT_STORAGE_KEY)).toBeNull();
});
