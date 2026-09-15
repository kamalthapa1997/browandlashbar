const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MAX_BOOKING_DAYS,
  addCalendarDays,
  getBookingWindow,
} = require("../utils/bookingWindow");
const {
  validateAvailabilityPayload,
  validateBookingPayload,
} = require("../utils/validators");
const { createBooking } = require("../controllers/squareController");

const fixedNow = new Date("2026-03-07T12:00:00.000Z");
const bookingAttemptId = "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e";
const customer = {
  firstName: "Luma",
  lastName: "Sinjali",
  phone: "(301) 555-1234",
  email: "luma@example.com",
};

function bookingPayload(date) {
  return {
    bookingAttemptId,
    variationIds: ["square-variation-1"],
    // This is after fixedNow even for today and intentionally crosses DST.
    startAt: `${date}T15:00:00.000Z`,
    customer,
  };
}

function assertOutOfRange(action) {
  assert.throws(action, (error) =>
    error.statusCode === 400 &&
    error.errorCode === "BOOKING_DATE_OUT_OF_RANGE" &&
    /up to 30 days in advance/.test(error.message),
  );
}

function postBooking(body) {
  return new Promise((resolve, reject) => {
    createBooking(
      { body },
      {
        status: () => ({ json: resolve }),
        json: resolve,
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

test("uses one Eastern calendar-day window for availability boundaries", () => {
  const { today, maximumDate } = getBookingWindow(fixedNow);
  const tomorrow = addCalendarDays(today, 1);
  const firstOutOfRangeDate = addCalendarDays(maximumDate, 1);
  const farFutureDate = addCalendarDays(maximumDate, MAX_BOOKING_DAYS);

  for (const date of [today, tomorrow, maximumDate]) {
    assert.deepEqual(
      validateAvailabilityPayload({ variationIds: ["variation-a"], date }, { now: fixedNow }),
      { variationIds: ["variation-a"], date },
    );
  }

  assert.deepEqual(
    validateAvailabilityPayload(
      { variationIds: ["variation-a"], startDate: today, endDate: maximumDate },
      { now: fixedNow },
    ),
    { variationIds: ["variation-a"], startDate: today, endDate: maximumDate },
  );
  assertOutOfRange(() =>
    validateAvailabilityPayload(
      { variationIds: ["variation-a"], date: firstOutOfRangeDate },
      { now: fixedNow },
    ),
  );
  assertOutOfRange(() =>
    validateAvailabilityPayload(
      { variationIds: ["variation-a"], date: farFutureDate },
      { now: fixedNow },
    ),
  );
});

test("rejects direct CreateBooking payloads beyond the same calendar-day window", () => {
  const { today, maximumDate } = getBookingWindow(fixedNow);
  const tomorrow = addCalendarDays(today, 1);
  const firstOutOfRangeDate = addCalendarDays(maximumDate, 1);
  const farFutureDate = addCalendarDays(maximumDate, MAX_BOOKING_DAYS);

  for (const date of [today, tomorrow, maximumDate]) {
    assert.equal(
      validateBookingPayload(bookingPayload(date), { now: fixedNow }).startAt,
      bookingPayload(date).startAt,
    );
  }

  assertOutOfRange(() =>
    validateBookingPayload(bookingPayload(firstOutOfRangeDate), { now: fixedNow }),
  );
  assertOutOfRange(() =>
    validateBookingPayload(bookingPayload(farFutureDate), { now: fixedNow }),
  );
  assert.throws(
    () => validateBookingPayload(bookingPayload(addCalendarDays(today, -1)), { now: fixedNow }),
    /Appointment time must be in the future/,
  );
});

test("rejects an out-of-window CreateBooking route request before any Square work", async () => {
  const { maximumDate } = getBookingWindow();
  const outOfRangePayload = bookingPayload(addCalendarDays(maximumDate, 1));

  await assert.rejects(
    postBooking(outOfRangePayload),
    (error) =>
      error.statusCode === 400 &&
      error.errorCode === "BOOKING_DATE_OUT_OF_RANGE",
  );
});
