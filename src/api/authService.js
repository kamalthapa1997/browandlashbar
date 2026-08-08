import { apiRequest } from "./client";

export function loginAdmin(credentials) {
  return apiRequest("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem("adminToken"));
}

export function logoutAdmin() {
  localStorage.removeItem("adminToken");
}
