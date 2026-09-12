import { apiRequest } from "./client";

export function getSquareBookingServices() {
  return apiRequest("/api/square/booking-services");
}

export function getSquareMenuServices() {
  return apiRequest("/api/square/menu");
}

export function getSquareAvailability({ variationIds, date }) {
  return apiRequest("/api/square/availability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variationIds, date }),
  });
}

export function createSquareBooking({ bookingAttemptId, variationIds, startAt, customer }) {
  return apiRequest("/api/square/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingAttemptId, variationIds, startAt, customer }),
  });
}
