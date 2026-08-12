import { apiRequest } from "./client";

export function getReviews() {
  return apiRequest("/api/reviews");
}
