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
     LOAD + PRELOAD GALLERY
     ===================================================== */

  useEffect(() => {
    let cancelled = false;

    async function preloadImage(image) {
      return new Promise((resolve) => {
        const preloadedImage = new Image();

        const finish = async (loaded) => {
          if (!loaded) {
            resolve({
              image,
              width: 0,
              height: 0,
              loaded: false,
            });
            return;
          }

          try {
            if (typeof preloadedImage.decode === "function") {
              await preloadedImage.decode();
            }
          } catch {
            /*
             * decode() can fail even when the image is usable.
             * The image is still considered loaded.
             */
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
        const data = await getGallery();
        const galleryImages = Array.isArray(data) ? data : [];

        if (cancelled) return;

        if (galleryImages.length === 0) {
          setImages([]);
          setImageSizes({});
          setLoading(false);
          return;
        }

        /*
         * Start loading EVERY image at the same time.
         */
        const preloadPromises = galleryImages.map((image) =>
          preloadImage(image),
        );

        /*
         * Finish the loader when the FIRST image has
         * successfully loaded and decoded.
         */
        const firstSuccessfulImage = new Promise((resolve) => {
          let remaining = preloadPromises.length;

          preloadPromises.forEach((promise) => {
            promise.then((result) => {
              if (result.loaded) {
                resolve(result);
                return;
              }

              remaining -= 1;

              /*
               * If every image failed, allow the gallery
               * to finish loading instead of hanging forever.
               */
              if (remaining === 0) {
                resolve(null);
              }
            });
          });
        });

        /*
         * Wait only for the first successfully loaded image.
         */
        await firstSuccessfulImage;

        if (cancelled) return;

        /*
         * Show the gallery immediately.
         */
        setImages(galleryImages);
        setLoading(false);

        /*
         * Continue collecting dimensions in the background.
         */
        Promise.all(preloadPromises).then((results) => {
          if (cancelled) return;

          const dimensions = results.reduce((sizes, result, index) => {
            if (!result?.loaded) return sizes;

            if (!result.width || !result.height) return sizes;

            sizes[index] = {
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

  /* =====================================================
     MEASURE GALLERY WIDTH
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

    return () => {
      resizeObserver.disconnect();
    };
  }, [images]);

  /* =====================================================
     BUILD JUSTIFIED ROWS
     ===================================================== */

  const rows = useMemo(() => {
    if (!images.length || !containerWidth) {
      return [];
    }

    const isMobile = containerWidth <= 640;

    const targetHeight = isMobile
      ? Math.max(150, Math.min(210, containerWidth * 0.42))
      : Math.max(210, Math.min(300, containerWidth * 0.23));

    const gap = isMobile ? 8 : 12;

    const result = [];

    let currentRow = [];
    let currentRatioTotal = 0;

    images.forEach((image, index) => {
      /*
       * Use the real aspect ratio when available.
       *
       * Until the dimensions are available, use 1:1
       * as a temporary conservative ratio.
       */
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
       * Complete the row once it reaches the
       * available gallery width.
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
     * Add the final row.
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
     RENDER
     ===================================================== */

  return (
    <main className="gallery-page">
      {/* =================================================
          HEADER
          ================================================= */}

      <header className="gallery-page__header">
        <p className="gallery-page__subtitle">Our Portfolio</p>

        <h1 className="gallery-page__title">Beauty in every detail</h1>
      </header>

      {/* =================================================
          ERROR
          ================================================= */}

      {error && (
        <p className="gallery-page__error" role="alert">
          {error}
        </p>
      )}

      {/* =================================================
          LOADING
          ================================================= */}

      {!error && loading && (
        <section
          className="gallery-page__loader"
          role="status"
          aria-live="polite"
        >
          <div className="gallery-page__loader-content">
            <span className="gallery-page__loader-mark" aria-hidden="true">
              <span className="gallery-page__loader-mark-inner" />
            </span>

            <span className="gallery-page__loader-line" aria-hidden="true" />

            <p>Curating our portfolio</p>
          </div>
        </section>
      )}

      {/* =================================================
          GALLERY
          ================================================= */}

      {!error && !loading && images.length > 0 && (
        <section
          ref={galleryRef}
          className="gallery-page__list gallery-page__list--ready"
          aria-label="Our portfolio"
        >
          {rows.length > 0 &&
            rows.map((row, rowIndex) => {
              const totalGap = Math.max(0, row.items.length - 1) * row.gap;

              const availableWidth = containerWidth - totalGap;

              /*
               * Normal rows fill the complete width.
               *
               * The final row intentionally keeps the
               * target height so images don't become
               * excessively large.
               */
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
                            loading="eager"
                            decoding="async"
                            draggable="false"
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

      {/* =================================================
          EMPTY
          ================================================= */}

      {!error && !loading && images.length === 0 && (
        <p className="gallery-page__empty">
          Our latest work will be here soon.
        </p>
      )}

      {/* =================================================
          LIGHTBOX
          ================================================= */}

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
