import {
  apiRequest,
  authenticatedApiRequest,
  resetAuthenticationFailure,
} from "./client";

export async function loginAdmin(credentials) {
  const response = await apiRequest("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  resetAuthenticationFailure();
  return response;
}

export function getCurrentAdmin() {
  return apiRequest("/api/admin/session");
}

export function logoutAdmin() {
  return authenticatedApiRequest("/api/admin/logout", { method: "POST" });
}
