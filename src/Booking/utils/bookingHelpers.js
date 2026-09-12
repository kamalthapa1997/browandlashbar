import { getEasternDateForInstant } from "./bookingFormatters";

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export function canonicalizeVariationIds(variationIds) {
  return [...new Set(variationIds)].sort();
}

export function isCurrentAvailabilitySlot(slot, date, variationIds) {
  const requestedVariationIds = canonicalizeVariationIds(variationIds);
  return Boolean(
    slot &&
    Array.isArray(slot.variationIds) &&
    slot.variationIds.length === requestedVariationIds.length &&
    slot.variationIds.every(
      (variationId, index) => variationId === requestedVariationIds[index],
    ) &&
    slot.availabilityDate === date &&
    getEasternDateForInstant(slot.startAt) === date,
  );
}

export function getBookingStatusPresentation(booking) {
  const status =
    typeof booking?.status === "string"
      ? booking.status.trim().toUpperCase()
      : "";
  const presentations = {
    PENDING: {
      tone: "pending",
      mark: "…",
      eyebrow: "Appointment request submitted",
      title: "Your request is awaiting approval.",
      message:
        "Your appointment request has been submitted and is awaiting approval.",
    },
    ACCEPTED: {
      tone: "accepted",
      mark: "✓",
      eyebrow: "Appointment confirmed",
      title: "We’ll see you soon.",
      message: "Your appointment is confirmed.",
    },
    DECLINED: {
      tone: "declined",
      mark: "×",
      eyebrow: "Appointment declined",
      title: "Your request was declined.",
      message:
        "The requested appointment was declined. Please select another time or service, or contact the business for help.",
    },
  };
  return {
    status: presentations[status] ? status : "",
    ...(presentations[status] || {
      tone: "unknown",
      mark: "?",
      eyebrow: "Appointment status needs verification",
      title: "We received your request.",
      message:
        "Your appointment request was received, but its current status needs to be verified.",
    }),
  };
}
