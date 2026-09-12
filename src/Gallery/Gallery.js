import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Gallery.css";
import { getGallery } from "../api/galleryService";
import { getServices } from "../api/serviceService";
import { useSettings } from "../contexts/SettingsContext";
import {
  getGalleryCategoryLabel,
  getGalleryCategoryOptions,
} from "../utils/galleryCategoryOptions";
import GalleryLightbox from "./GalleryLightbox";

const galleryDefaults = {
  eyebrow: "OUR PORTFOLIO",
  title: "Beauty in every detail",
  description: "Explore our latest lash and brow work.",
};

function imageKey(image, index) {
  return image._id || image.imageUrl || index;
}

function categoryFor(image) {
  return typeof image.category === "string" ? image.category : "";
}

function sortGalleryItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((first, second) => {
      const featuredDifference = Number(Boolean(second.item.featured)) - Number(Boolean(first.item.featured));
      if (featuredDifference) return featuredDifference;

      const firstOrder = Number(first.item.displayOrder);
      const secondOrder = Number(second.item.displayOrder);
      const displayOrderDifference =
        (Number.isFinite(firstOrder) ? firstOrder : first.index) -
        (Number.isFinite(secondOrder) ? secondOrder : second.index);
      return displayOrderDifference || first.index - second.index;
    })
    .map(({ item }) => item);
}

function imageAlt(image, index, categoryOptions) {
  const categoryLabel = getGalleryCategoryLabel(
    categoryFor(image),
    categoryOptions,
  );

  return image.caption
    ? `${categoryLabel}: ${image.caption}`
    : categoryLabel || `Our work ${index + 1}`;
}

function storedImageRatio(image) {
  const ratio = Number(image.aspectRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

function ImageDetails({ image, featured = false }) {
  if (!image.caption && !featured) return null;

  return (
    <div className={featured ? "gallery-page__featured-copy" : "gallery-page__item-copy"}>
      {featured && <p className="gallery-page__featured-label">Featured work</p>}
      {image.caption && <h2>{image.caption}</h2>}
    </div>
  );
}

function Gallery() {
  const { settings } = useSettings();
  const [images, setImages] = useState([]);
  const [imageSizes, setImageSizes] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all");
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [galleryElement, setGalleryElement] = useState(null);
  const measuredWidthRef = useRef(0);
  const resizeFrameRef = useRef(null);
  const galleryRef = useCallback((element) => setGalleryElement(element), []);

  const gallerySettings = {
    eyebrow: settings?.gallery?.eyebrow || galleryDefaults.eyebrow,
    title: settings?.gallery?.title || galleryDefaults.title,
    description: settings?.gallery?.description || galleryDefaults.description,
  };

  useEffect(() => {
    let cancelled = false;

    function preloadImage(image) {
      return new Promise((resolve) => {
        const preloadedImage = new Image();

        const finish = async (loaded) => {
          if (!loaded) {
            resolve({ image, width: 0, height: 0, loaded: false });
            return;
          }

          try {
            if (typeof preloadedImage.decode === "function") {
              await preloadedImage.decode();
            }
          } catch {
            // The browser can still display an image when decode() rejects.
          }

          resolve({
            image,
            width: preloadedImage.naturalWidth,
            height: preloadedImage.naturalHeight,
            loaded: true,
          });
        };

        preloadedImage.onload = () => finish(true);
        preloadedImage.onerror = () => finish(false);
        preloadedImage.src = image.imageUrl;
      });
    }

    async function loadGallery() {
      setError("");
      setLoading(true);

      try {
        const [data, services] = await Promise.all([
          getGallery(),
          getServices().catch(() => ({})),
        ]);
        const galleryImages = sortGalleryItems(
          (Array.isArray(data) ? data : []).filter((image) => image.active !== false),
        );

        if (cancelled) return;

        if (!galleryImages.length) {
          setImages([]);
          setImageSizes({});
          setLoading(false);
          return;
        }

        const preloadPromises = galleryImages.map(preloadImage);
        const firstSuccessfulImage = new Promise((resolve) => {
          let remaining = preloadPromises.length;
          preloadPromises.forEach((promise) => {
            promise.then((result) => {
              if (result.loaded) {
                resolve(result);
                return;
              }
              remaining -= 1;
              if (remaining === 0) resolve(null);
            });
          });
        });

        await firstSuccessfulImage;
        if (cancelled) return;

        setImages(galleryImages);
        setCategoryOptions(getGalleryCategoryOptions(services));
        setLoading(false);

        Promise.all(preloadPromises).then((results) => {
          if (cancelled) return;
          const dimensions = results.reduce((sizes, result, index) => {
            if (!result?.loaded || !result.width || !result.height) return sizes;
            sizes[imageKey(result.image, index)] = {
              width: result.width,
              height: result.height,
              ratio: result.width / result.height,
            };
            return sizes;
          }, {});
          setImageSizes(dimensions);
        });
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Unable to load gallery.");
        setLoading(false);
      }
    }

    loadGallery();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!galleryElement) return undefined;

    function scheduleWidthUpdate(width) {
      const nextWidth = Math.max(0, Math.round(width * 100) / 100);

      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }

      if (Math.abs(measuredWidthRef.current - nextWidth) < 0.5) return;

      resizeFrameRef.current = requestAnimationFrame(() => {
        measuredWidthRef.current = nextWidth;
        setContainerWidth(nextWidth);
        resizeFrameRef.current = null;
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) scheduleWidthUpdate(entry.contentRect.width);
    });

    resizeObserver.observe(galleryElement);
    scheduleWidthUpdate(galleryElement.getBoundingClientRect().width);

    return () => {
      resizeObserver.disconnect();
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
    };
  }, [galleryElement]);

  const availableCategories = useMemo(() => {
    const imageCategories = new Set(images.map(categoryFor).filter(Boolean));
    const menuCategories = categoryOptions.filter((option) =>
      imageCategories.has(option.value),
    );
    const legacyCategories = [...imageCategories]
      .filter(
        (category) =>
          !menuCategories.some((option) => option.value === category),
      )
      .map((category) => ({
        value: category,
        label: getGalleryCategoryLabel(category, categoryOptions),
      }));

    return [{ value: "all", label: "All" }, ...menuCategories, ...legacyCategories];
  }, [categoryOptions, images]);

  useEffect(() => {
    if (!availableCategories.some((option) => option.value === activeCategory)) {
      setActiveCategory("all");
    }
  }, [activeCategory, availableCategories]);

  const filteredImages = useMemo(
    () =>
      activeCategory === "all"
        ? images
        : images.filter((image) => categoryFor(image) === activeCategory),
    [activeCategory, images],
  );

  const featuredImage = filteredImages.find((image) => image.featured) || filteredImages[0];
  const featuredRatio = featuredImage
    ? imageSizes[imageKey(featuredImage, 0)]?.ratio ||
      storedImageRatio(featuredImage) ||
      4 / 3
    : 4 / 3;
  const supportingImages = useMemo(
    () =>
      filteredImages.filter(
        (image, index) => imageKey(image, index) !== imageKey(featuredImage, 0),
      ),
    [featuredImage, filteredImages],
  );

  const rows = useMemo(() => {
    if (!supportingImages.length || !containerWidth) return [];

    const isMobile = containerWidth <= 640;
    const targetHeight = isMobile
      ? Math.max(150, Math.min(220, containerWidth * 0.48))
      : Math.max(210, Math.min(300, containerWidth * 0.23));
    const gap = isMobile ? 8 : 14;
    const result = [];
    let currentRow = [];
    let currentRatioTotal = 0;

    supportingImages.forEach((image, index) => {
      const ratio =
        imageSizes[imageKey(image, index)]?.ratio ||
        storedImageRatio(image) ||
        1;
      currentRow.push({ image, index, ratio });
      currentRatioTotal += ratio;
      const estimatedWidth =
        currentRatioTotal * targetHeight + Math.max(0, currentRow.length - 1) * gap;

      if (
        (estimatedWidth >= containerWidth || (isMobile && currentRow.length >= 2)) &&
        currentRow.length > 1
      ) {
        result.push({ items: currentRow, ratioTotal: currentRatioTotal, targetHeight, gap, isLast: false });
        currentRow = [];
        currentRatioTotal = 0;
      }
    });

    if (currentRow.length) {
      result.push({ items: currentRow, ratioTotal: currentRatioTotal, targetHeight, gap, isLast: true });
    }
    return result;
  }, [containerWidth, imageSizes, supportingImages]);

  function changeCategory(category) {
    setActiveCategory(category);
    setLightboxIndex(null);
  }

  function openLightbox(image) {
    const index = filteredImages.indexOf(image);
    if (index >= 0) setLightboxIndex(index);
  }

  return (
    <main className="gallery-page">
      <header className="gallery-page__header">
        <p className="gallery-page__subtitle">{gallerySettings.eyebrow}</p>
        <h1 className="gallery-page__title">{gallerySettings.title}</h1>
        <p className="gallery-page__description">{gallerySettings.description}</p>
      </header>

      {error && <p className="gallery-page__error" role="alert">{error}</p>}

      {!error && loading && (
        <section className="gallery-page__loader" role="status" aria-live="polite">
          <div className="gallery-page__loader-content">
            <span className="gallery-page__loader-mark" aria-hidden="true">
              <span className="gallery-page__loader-mark-inner" />
            </span>
            <span className="gallery-page__loader-line" aria-hidden="true" />
            <p>Curating our portfolio</p>
          </div>
        </section>
      )}

      {!error && !loading && images.length > 0 && (
        <>
          <nav className="gallery-page__filters" aria-label="Filter portfolio by category">
            {availableCategories.map((category) => (
              <button
                type="button"
                key={category.value}
                className={activeCategory === category.value ? "is-active" : ""}
                aria-pressed={activeCategory === category.value}
                onClick={() => changeCategory(category.value)}
              >
                {category.label}
              </button>
            ))}
          </nav>
          <section ref={galleryRef} className="gallery-page__list gallery-page__list--ready" aria-label="Our portfolio">
            {featuredImage && (
              <article className="gallery-page__featured">
                <button
                  type="button"
                  className="gallery-page__featured-image"
                  style={{ "--gallery-featured-ratio": featuredRatio }}
                  onClick={() => openLightbox(featuredImage)}
                  aria-label={`View featured image: ${imageAlt(featuredImage, 0, categoryOptions)}`}
                >
                  <img
                    src={featuredImage.imageUrl}
                    alt={imageAlt(featuredImage, 0, categoryOptions)}
                    loading="eager"
                    decoding="async"
                    draggable="false"
                  />
                </button>
                <ImageDetails image={featuredImage} featured />
              </article>
            )}

            {rows.map((row, rowIndex) => {
              const totalGap = Math.max(0, row.items.length - 1) * row.gap;
              const availableWidth = containerWidth - totalGap;
              const rowHeight = row.isLast
                ? Math.min(row.targetHeight, availableWidth / row.ratioTotal)
                : availableWidth / row.ratioTotal;

              return (
                <div
                  className={`gallery-page__row ${row.isLast ? "gallery-page__row--last" : ""}`}
                  key={`row-${rowIndex}`}
                  style={{ "--gallery-gap": `${row.gap}px` }}
                >
                  {row.items.map(({ image, index, ratio }) => {
                    const width = ratio * rowHeight;
                    return (
                      <article
                        className="gallery-page__item"
                        key={imageKey(image, index)}
                        style={{ "--gallery-width": `${width}px`, "--gallery-height": `${rowHeight}px` }}
                      >
                        <button
                          type="button"
                          className="gallery-page__image"
                          onClick={() => openLightbox(image)}
                          aria-label={`View ${imageAlt(image, index, categoryOptions)}`}
                        >
                          <img
                            src={image.imageUrl}
                            alt={imageAlt(image, index, categoryOptions)}
                            loading="eager"
                            decoding="async"
                            draggable="false"
                          />
                        </button>
                        <ImageDetails image={image} />
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </section>
        </>
      )}

      {!error && !loading && images.length === 0 && (
        <p className="gallery-page__empty">Our latest work will be here soon.</p>
      )}

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={filteredImages}
          initialIndex={lightboxIndex}
          getAltText={(image, index) => imageAlt(image, index, categoryOptions)}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </main>
  );
}

export default Gallery;
