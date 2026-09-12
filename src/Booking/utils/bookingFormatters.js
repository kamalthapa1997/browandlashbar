export const EASTERN_TIME_ZONE = "America/New_York";

export function getEasternDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getEasternDateForInstant(isoDate) { return getEasternDate(isoDate); }

export function getEasternMaxBookingDate(value = new Date()) {
  const easternDate = new Date(`${getEasternDate(value)}T12:00:00Z`);
  easternDate.setUTCDate(easternDate.getUTCDate() + 30);
  return easternDate.toISOString().slice(0, 10);
}

export function formatTime(isoDate) {
  return new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(isoDate));
}

export function formatPrice(priceMoney) {
  if (!Number.isFinite(priceMoney?.amount) || !priceMoney.currency) return "Price varies";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: priceMoney.currency }).format(priceMoney.amount / 100);
}

export function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "Duration varies";
  return `${Math.round(durationMs / 60000)} min`;
}

export function formatEstimatedDuration(durationMs) {
  const duration = formatDuration(durationMs);
  return duration === "Duration varies" ? duration : `Estimated ${duration}`;
}

export function formatServiceCount(count) { return `${count} service${count === 1 ? "" : "s"}`; }

export function formatAppointmentDate(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIME_ZONE, month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}
