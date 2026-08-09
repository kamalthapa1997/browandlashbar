import { apiRequest, authenticatedApiRequest } from "./client";

export function getGallery() {
  return apiRequest("/api/gallery");
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
