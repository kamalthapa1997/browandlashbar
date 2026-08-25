import { useEffect, useMemo, useRef, useState } from "react";
import "./Gallery.css";
import { getGallery } from "../api/galleryService";
import GalleryLightbox from "./GalleryLightbox";

function Gallery() {
  const [images, setImages] = useState([]);
  const [imageSizes, setImageSizes] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const galleryRef = useRef(null);

  /* =====================================================
     LOAD GALLERY
     ===================================================== */

  useEffect(() => {
    async function loadGallery() {
      setError("");
      setLoading(true);

      try {
        const data = await getGallery();
        setImages(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load gallery.");
      } finally {
        setLoading(false);
      }
    }

    loadGallery();
  }, []);

  /* =====================================================
     TRACK GALLERY WIDTH
     ===================================================== */

  useEffect(() => {
    const element = galleryRef.current;

    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [images]);

  /* =====================================================
     IMAGE DIMENSIONS
     ===================================================== */

  const handleImageLoad = (index, event) => {
    const image = event.currentTarget;

    if (!image.naturalWidth || !image.naturalHeight) return;

    setImageSizes((current) => ({
      ...current,
      [index]: {
        width: image.naturalWidth,
        height: image.naturalHeight,
        ratio: image.naturalWidth / image.naturalHeight,
      },
    }));
  };

  /* =====================================================
     CREATE JUSTIFIED ROWS
     ===================================================== */

  const rows = useMemo(() => {
    if (!images.length || !containerWidth) return [];

    /*
      Target row heights.
      The algorithm adjusts the final width
      based on each image's aspect ratio.
    */

    const isMobile = containerWidth <= 640;
    const targetHeight = isMobile
      ? Math.max(150, Math.min(210, containerWidth * 0.42))
      : Math.max(210, Math.min(300, containerWidth * 0.23));

    const gap = isMobile ? 8 : 12;

    const result = [];
    let currentRow = [];
    let currentRatioTotal = 0;

    images.forEach((image, index) => {
      const ratio = imageSizes[index]?.ratio || 1;

      currentRow.push({
        image,
        index,
        ratio,
      });

      currentRatioTotal += ratio;

      const estimatedWidth =
        currentRatioTotal * targetHeight +
        Math.max(0, currentRow.length - 1) * gap;

      /*
        Once the row is large enough to fill the container,
        finish the row.
      */

      if (estimatedWidth >= containerWidth && currentRow.length > 1) {
        result.push({
          items: currentRow,
          ratioTotal: currentRatioTotal,
          targetHeight,
          gap,
          isLast: false,
        });

        currentRow = [];
        currentRatioTotal = 0;
      }
    });

    /*
      Remaining images become the last row.
    */

    if (currentRow.length) {
      result.push({
        items: currentRow,
        ratioTotal: currentRatioTotal,
        targetHeight,
        gap,
        isLast: true,
      });
    }

    return result;
  }, [images, imageSizes, containerWidth]);

  /* =====================================================
     SCROLL REVEAL
     ===================================================== */

  useEffect(() => {
    if (!galleryRef.current) return;

    const items = galleryRef.current.querySelectorAll(".gallery-page__item");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("gallery-page__item--visible");

            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -50px 0px",
      },
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [rows]);

  /* =====================================================
     RENDER
     ===================================================== */

  return (
    <main className="gallery-page">
      <header className="gallery-page__header">
        <p className="gallery-page__subtitle">Our Portfolio</p>

        <h1 className="gallery-page__title">Beauty in every detail</h1>
      </header>

      {/* ERROR */}

      {error && (
        <p className="gallery-page__error" role="alert">
          {error}
        </p>
      )}

      {/* LOADING */}

      {!error && loading && (
        <p className="gallery-page__empty" role="status">
          Loading gallery…
        </p>
      )}

      {/* GALLERY */}

      {!error && !loading && images.length > 0 && (
        <section
          ref={galleryRef}
          className="gallery-page__list"
          aria-label="Our portfolio"
        >
          {rows.length > 0 &&
            rows.map((row, rowIndex) => {
              const totalGap = Math.max(0, row.items.length - 1) * row.gap;

              /*
                For normal rows:
                make the images fill the complete row.

                For the last row:
                don't stretch the images.
                Keep them naturally sized and center them.
              */

              const availableWidth = containerWidth - totalGap;

              const rowHeight = row.isLast
                ? row.targetHeight
                : availableWidth / row.ratioTotal;

              return (
                <div
                  className={`gallery-page__row ${
                    row.isLast ? "gallery-page__row--last" : ""
                  }`}
                  key={`row-${rowIndex}`}
                >
                  {row.items.map(({ image, index, ratio }) => {
                    const width = row.isLast
                      ? row.targetHeight * ratio
                      : ratio * rowHeight;

                    return (
                      <article
                        className="gallery-page__item"
                        key={image._id || index}
                        style={{
                          "--gallery-width": `${width}px`,
                          "--gallery-height": `${rowHeight}px`,
                          "--gallery-delay": `${Math.min(index * 60, 420)}ms`,
                        }}
                      >
                        <button
                          type="button"
                          className="gallery-page__image"
                          onClick={() => setLightboxIndex(index)}
                          aria-label={`View ${
                            image.caption || `our work ${index + 1}`
                          }`}
                        >
                          <img
                            src={image.imageUrl}
                            alt={image.caption || `Our work ${index + 1}`}
                            loading={index < 4 ? "eager" : "lazy"}
                            onLoad={(event) => handleImageLoad(index, event)}
                          />
                        </button>
                      </article>
                    );
                  })}
                </div>
              );
            })}
        </section>
      )}

      {/* EMPTY */}

      {!error && !loading && images.length === 0 && (
        <p className="gallery-page__empty">
          Our latest work will be here soon.
        </p>
      )}

      {/* LIGHTBOX */}

      {lightboxIndex !== null && (
        <GalleryLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </main>
  );
}

export default Gallery;
