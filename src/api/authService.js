import { apiRequest, authenticatedApiRequest } from "./client";

export function loginAdmin(credentials) {
  return apiRequest("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

export function getCurrentAdmin() {
  return authenticatedApiRequest("/api/admin/session");
}

export function logoutAdmin() {
  return apiRequest("/api/admin/logout", { method: "POST" });
}
