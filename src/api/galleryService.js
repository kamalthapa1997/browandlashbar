import { apiRequest, authenticatedApiRequest } from "./client";

export function getGallery() {
  return apiRequest("/api/gallery");
}

export function getGalleryCategories() {
  return apiRequest("/api/gallery/categories");
}

export function createGalleryCategory(label) {
  return authenticatedApiRequest("/api/gallery/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
}

export function deleteGalleryCategory(id) {
  return authenticatedApiRequest(`/api/gallery/categories/${id}`, { method: "DELETE" });
}

export function createGalleryItem(formData) {
  return authenticatedApiRequest("/api/gallery", { method: "POST", body: formData });
}

export function updateGalleryItem(id, formData) {
  return authenticatedApiRequest(`/api/gallery/${id}`, { method: "PUT", body: formData });
}

export function deleteGalleryItem(id) {
  return authenticatedApiRequest(`/api/gallery/${id}`, { method: "DELETE" });
}
