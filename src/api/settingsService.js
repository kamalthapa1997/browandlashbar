import { apiRequest, authenticatedApiRequest } from "./client";

export function getSettings() {
  return apiRequest("/api/settings");
}

export function updateSettings(formData) {
  return authenticatedApiRequest("/api/settings", { method: "PUT", body: formData });
}
