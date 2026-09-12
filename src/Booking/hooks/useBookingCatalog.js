import { useEffect, useMemo, useRef, useState } from "react";
import { getSquareBookingServices } from "../../api/squareService";
import { wait } from "../utils/bookingHelpers";

export default function useBookingCatalog({ submitting, uiDelay }) {
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [catalogLoadVersion, setCatalogLoadVersion] = useState(0);
  const [loadingCategoryId, setLoadingCategoryId] = useState("");
  const catalogRequestRef = useRef(false);
  const categoryRequestRef = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadServices() {
      if (catalogRequestRef.current) return;
      catalogRequestRef.current = true;
      setLoadingServices(true);
      setCatalogError("");

      try {
        const data = await getSquareBookingServices();
        if (!active) return;
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
      } catch (requestError) {
        if (!active) return;
        setCatalogError(requestError.message || "Unable to load online services.");
      } finally {
        catalogRequestRef.current = false;
        if (active) setLoadingServices(false);
      }
    }

    loadServices();
    return () => { active = false; };
  }, [catalogLoadVersion]);

  const variations = useMemo(() => categories.flatMap((category) =>
    (category.services || []).flatMap((service) =>
      (service.variations || []).map((variation) => ({ ...variation, serviceName: service.name })),
    ),
  ), [categories]);

  const availableCategories = useMemo(() => categories.filter((category) =>
    (category.services || []).some((service) => (service.variations || []).length > 0),
  ), [categories]);

  const activeCategory = useMemo(() =>
    availableCategories.find((category) => category.id === activeCategoryId) || availableCategories[0] || null,
  [activeCategoryId, availableCategories]);

  useEffect(() => {
    if (activeCategory && activeCategory.id !== activeCategoryId) {
      setActiveCategoryId(activeCategory.id);
    }
  }, [activeCategory, activeCategoryId]);

  function handleCategoryChange(categoryId) {
    if (categoryId === activeCategoryId || submitting || loadingCategoryId || categoryRequestRef.current) return;
    categoryRequestRef.current = categoryId;
    setLoadingCategoryId(categoryId);
    void wait(uiDelay).then(() => {
      if (categoryRequestRef.current === categoryId) {
        setActiveCategoryId(categoryId);
        setLoadingCategoryId("");
        categoryRequestRef.current = "";
      }
    });
  }

  function retryCatalog() { setCatalogLoadVersion((value) => value + 1); }

  return {
    categories,
    variations,
    availableCategories,
    activeCategory,
    loadingServices,
    catalogError,
    loadingCategory: Boolean(loadingCategoryId),
    loadingCategoryId,
    handleCategoryChange,
    retryCatalog,
  };
}
