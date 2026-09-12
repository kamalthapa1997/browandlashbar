import { useEffect, useRef, useState } from "react";
import ServiceCard from "./ServiceCard";

export default function ServiceSelector({
  serviceSectionRef,
  serviceSelectorCollapsed,
  selectedVariations,
  selectedServiceEstimate,
  submitting,
  editServices,
  loadingServices,
  catalogError,
  retryCatalog,
  availableCategories,
  activeCategory,
  loadingCategory,
  loadingCategoryId,
  handleCategoryChange,
  toggleVariation,
}) {
  const categoryTabsRef = useRef(null);
  const categoryTabRefs = useRef({});
  const [categoryScrollState, setCategoryScrollState] = useState({
    hasOverflow: false,
    canScrollLeft: false,
    canScrollRight: false,
  });

  function updateCategoryScrollState() {
    const container = categoryTabsRef.current;

    if (!container) {
      return;
    }

    const hasOverflow = container.scrollWidth > container.clientWidth + 1;
    const canScrollLeft = container.scrollLeft > 1;
    const canScrollRight =
      container.scrollLeft + container.clientWidth < container.scrollWidth - 1;

    setCategoryScrollState((current) => {
      if (
        current.hasOverflow === hasOverflow &&
        current.canScrollLeft === canScrollLeft &&
        current.canScrollRight === canScrollRight
      ) {
        return current;
      }

      return { hasOverflow, canScrollLeft, canScrollRight };
    });
  }

  useEffect(() => {
    const container = categoryTabsRef.current;

    if (!container) {
      return undefined;
    }

    updateCategoryScrollState();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateCategoryScrollState);

    resizeObserver?.observe(container);
    window.addEventListener("resize", updateCategoryScrollState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateCategoryScrollState);
    };
  }, [availableCategories.length]);

  useEffect(() => {
    const categoryId = loadingCategoryId || activeCategory?.id;

    if (!categoryId) {
      return;
    }

    const categoryTab = categoryTabRefs.current[categoryId];

    if (typeof categoryTab?.scrollIntoView === "function") {
      categoryTab.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeCategory?.id, loadingCategoryId]);

  function scrollCategories(direction) {
    const container = categoryTabsRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: direction * Math.max(container.clientWidth * 0.7, 160),
      behavior: "smooth",
    });
  }

  return (
    <section
      ref={serviceSectionRef}
      className={`booking__section booking__service-section ${
        serviceSelectorCollapsed ? "is-collapsed" : ""
      }`}
      aria-labelledby="service-heading"
    >
      <div className="booking__section-heading">
        <span className="booking__section-number">01</span>

        <div>
          <h2 id="service-heading">Select a service</h2>

          <p>Choose one or more treatments you’d like to book.</p>
        </div>
      </div>

      {serviceSelectorCollapsed && selectedVariations.length > 0 ? (
        <>
          {/* <div className="booking__service-collapsed">
            <div>
              <strong>{formatServiceCount(selectedVariations.length)}</strong>

              <span>
                {formatPrice(selectedServiceEstimate.priceMoney)} ·{" "}
                {formatDuration(selectedServiceEstimate.durationMs)}
              </span>
            </div>

            <button type="button" onClick={editServices} disabled={submitting}>
              Edit services
            </button>
          </div> */}
        </>
      ) : loadingServices ? (
        <div
          className="booking__loading"
          aria-live="polite"
          aria-label="Loading services"
        >
          <div className="booking__loading-line" />

          <div className="booking__loading-grid">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      ) : catalogError ? (
        <div className="booking__catalog-error" role="alert">
          <p>{catalogError}</p>

          <button
            className="booking__button"
            type="button"
            onClick={() => retryCatalog()}
          >
            Try again
          </button>
        </div>
      ) : availableCategories.length === 0 ? (
        <div className="booking__catalog-error">
          <p>No online services are available right now.</p>

          <button
            className="booking__button"
            type="button"
            onClick={() => retryCatalog()}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div
            className={`booking__category-navigation${
              categoryScrollState.hasOverflow ? " has-overflow" : ""
            }`}
          >
            <button
              className="booking__category-arrow booking__category-arrow--prev"
              type="button"
              aria-label="Previous categories"
              onClick={() => scrollCategories(-1)}
              disabled={!categoryScrollState.canScrollLeft}
              tabIndex={categoryScrollState.canScrollLeft ? 0 : -1}
            >
              <span aria-hidden="true">‹</span>
            </button>

            <div
              ref={categoryTabsRef}
              className={`booking__category-tabs ${
                loadingCategory ? "is-loading" : ""
              }`}
              role="tablist"
              aria-label="Service categories"
              onScroll={updateCategoryScrollState}
            >
              {availableCategories.map((category) => {
                const isActive = category.id === activeCategory?.id;
                const isLoading = category.id === loadingCategoryId;

                return (
                  <button
                    ref={(element) => {
                      if (element) {
                        categoryTabRefs.current[category.id] = element;
                      } else {
                        delete categoryTabRefs.current[category.id];
                      }
                    }}
                    type="button"
                    role="tab"
                    key={category.id}
                    id={`category-tab-${category.id}`}
                    aria-selected={isActive}
                    aria-controls={`category-panel-${category.id}`}
                    aria-busy={isLoading}
                    className={isActive ? "is-active" : ""}
                    onClick={() => handleCategoryChange(category.id)}
                    disabled={submitting || loadingCategory}
                  >
                    {isLoading && (
                      <span
                        className="booking__button-spinner"
                        aria-hidden="true"
                      />
                    )}

                    <span>{category.name}</span>
                  </button>
                );
              })}
            </div>

            <button
              className="booking__category-arrow booking__category-arrow--next"
              type="button"
              aria-label="Next categories"
              onClick={() => scrollCategories(1)}
              disabled={!categoryScrollState.canScrollRight}
              tabIndex={categoryScrollState.canScrollRight ? 0 : -1}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          {loadingCategory ? (
            <div
              className="booking__category-loading"
              aria-live="polite"
              aria-label="Loading category"
            >
              <span />
              <span />
              <span />
            </div>
          ) : (
            activeCategory && (
              <div
                className="booking__category-panel"
                id={`category-panel-${activeCategory.id}`}
                role="tabpanel"
                aria-labelledby={`category-tab-${activeCategory.id}`}
              >
                <div className="booking__category-title">
                  <h3>{activeCategory.name}</h3>
                </div>

                <div className="booking__catalog-services">
                  {(activeCategory.services || []).map((service) => {
                    const serviceVariations = service.variations || [];

                    if (!serviceVariations.length) {
                      return null;
                    }

                    return (
                      <div
                        className="booking__catalog-service"
                        key={service.id}
                      >
                        {serviceVariations.length > 1 && <p>{service.name}</p>}

                        <div className="booking__services">
                          {serviceVariations.map((variation) => {
                            const isSelected = selectedVariations.some(
                              (item) => item.id === variation.id,
                            );

                            return (
                              <ServiceCard
                                key={variation.id}
                                service={service}
                                variation={variation}
                                isSelected={isSelected}
                                disabled={submitting}
                                onToggle={toggleVariation}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </>
      )}
    </section>
  );
}
