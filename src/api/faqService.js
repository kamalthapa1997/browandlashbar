import { apiRequest, authenticatedApiRequest } from "./client";

export function getFaqs() {
  return apiRequest("/api/faqs");
}

export function getAdminFaqs() {
  return authenticatedApiRequest("/api/faqs/admin");
}

export function createFaq(faq) {
  return authenticatedApiRequest("/api/faqs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(faq),
  });
}

export function updateFaq(id, faq) {
  return authenticatedApiRequest(`/api/faqs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(faq),
  });
}

export function deleteFaq(id) {
  return authenticatedApiRequest(`/api/faqs/${id}`, { method: "DELETE" });
}
