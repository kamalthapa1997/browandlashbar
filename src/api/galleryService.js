import { apiRequest } from "./client";

export function getGallery() {
  return apiRequest("/api/gallery");
}

export function createGalleryItem(formData) {
  return apiRequest("/api/gallery", { method: "POST", body: formData });
}

export function updateGalleryItem(id, formData) {
  return apiRequest(`/api/gallery/${id}`, { method: "PUT", body: formData });
}

export function deleteGalleryItem(id) {
  return apiRequest(`/api/gallery/${id}`, { method: "DELETE" });
}
