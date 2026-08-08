import { apiRequest } from "./client";

export function getSettings() {
  return apiRequest("/api/settings");
}

export function updateSettings(formData) {
  return apiRequest("/api/settings", { method: "PUT", body: formData });
}
