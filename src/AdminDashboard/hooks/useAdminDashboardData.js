import { useEffect, useState } from "react";
import { getGallery } from "../../api/galleryService";
import { getSettings } from "../../api/settingsService";
import { getAdminFaqs } from "../../api/faqService";

function useAdminDashboardData(onSettingsUpdated) {
  const [gallery, setGallery] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [nextGallery, nextSettings, nextFaqs] =
        await Promise.all([
          getGallery(),
          getSettings(),
          getAdminFaqs(),
        ]);
      setGallery(Array.isArray(nextGallery) ? nextGallery : []);
      setSettings(nextSettings || {});
      setFaqs(Array.isArray(nextFaqs) ? nextFaqs : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function upsertGalleryItem(item) {
    setGallery((current) => {
      const shouldClearFeatured = item.featured && item.active !== false;
      const withoutItem = current
        .filter((entry) => entry._id !== item._id)
        .map((entry) =>
          shouldClearFeatured ? { ...entry, featured: false } : entry,
        );
      return [item, ...withoutItem].sort((first, second) => {
        const featuredDifference =
          Number(Boolean(second.featured)) - Number(Boolean(first.featured));
        if (featuredDifference) return featuredDifference;

        const displayOrderDifference =
          Number(first.displayOrder ?? 0) - Number(second.displayOrder ?? 0);
        if (displayOrderDifference) return displayOrderDifference;

        return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
      });
    });
  }

  function removeGalleryItem(itemId) {
    setGallery((current) => current.filter((item) => item._id !== itemId));
  }

  function upsertFaq(faq) {
    setFaqs((current) =>
      [...current.filter((item) => item._id !== faq._id), faq].sort(
        (first, second) =>
          first.displayOrder - second.displayOrder ||
          new Date(first.createdAt) - new Date(second.createdAt),
      ),
    );
  }

  function removeFaq(faqId) {
    setFaqs((current) => current.filter((item) => item._id !== faqId));
  }

  function applySettings(nextSettings) {
    setSettings(nextSettings);
    onSettingsUpdated?.(nextSettings);
  }

  return {
    gallery,
    faqs,
    settings,
    loading,
    error,
    refresh,
    upsertGalleryItem,
    removeGalleryItem,
    upsertFaq,
    removeFaq,
    applySettings,
  };
}

export default useAdminDashboardData;
