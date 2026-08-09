import { apiRequest, authenticatedApiRequest } from "./client";

export function getServices() {
  return apiRequest("/api/services");
}

export function createService(service) {
  return authenticatedApiRequest("/api/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(service),
  });
}

export function updateService(id, service) {
  return authenticatedApiRequest(`/api/services/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(service),
  });
}

export function deleteService(id) {
  return authenticatedApiRequest(`/api/services/${id}`, { method: "DELETE" });
}
