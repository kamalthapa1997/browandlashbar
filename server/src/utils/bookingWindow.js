const createHttpError = require("./httpError");

const BUSINESS_TIME_ZONE = "America/New_York";
const MAX_BOOKING_DAYS = 30;

function calendarDateInBusinessTimeZone(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const fields = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function addCalendarDays(date, days) {
  const calendarDate = new Date(`${date}T12:00:00Z`);
  calendarDate.setUTCDate(calendarDate.getUTCDate() + days);
  return calendarDate.toISOString().slice(0, 10);
}

function getBookingWindow(now = new Date()) {
  const today = calendarDateInBusinessTimeZone(now);
  return { today, maximumDate: addCalendarDays(today, MAX_BOOKING_DAYS) };
}

function assertDateWithinBookingWindow(date, { now = new Date() } = {}) {
  const { maximumDate } = getBookingWindow(now);
  if (date > maximumDate) {
    throw createHttpError(
      400,
      `Appointments can only be booked up to ${MAX_BOOKING_DAYS} days in advance.`,
      undefined,
      "BOOKING_DATE_OUT_OF_RANGE",
    );
  }
}

module.exports = {
  BUSINESS_TIME_ZONE,
  MAX_BOOKING_DAYS,
  addCalendarDays,
  assertDateWithinBookingWindow,
  calendarDateInBusinessTimeZone,
  getBookingWindow,
};
