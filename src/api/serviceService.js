import { apiRequest } from "./client";

export function getServices() {
  return apiRequest("/api/services");
}

export function createService(service) {
  return apiRequest("/api/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(service),
  });
}

export function updateService(id, service) {
  return apiRequest(`/api/services/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(service),
  });
}

export function deleteService(id) {
  return apiRequest(`/api/services/${id}`, { method: "DELETE" });
}
