import { useCallback, useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

function GalleryLightbox({ images, initialIndex, onClose }) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const closeButtonRef = useRef(null);

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const selectedImage = images[selectedIndex];

  /* =====================================================
     PREVIOUS
     ===================================================== */

  const showPrevious = useCallback(() => {
    setSelectedIndex((current) =>
      current === 0 ? images.length - 1 : current - 1,
    );
  }, [images.length]);

  /* =====================================================
     NEXT
     ===================================================== */

  const showNext = useCallback(() => {
    setSelectedIndex((current) => (current + 1) % images.length);
  }, [images.length]);

  /* =====================================================
     KEYBOARD
     ===================================================== */

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        showPrevious();
        return;
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    }

    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleKeyDown);

    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, showNext, showPrevious]);

  /* =====================================================
     TOUCH START
     ===================================================== */

  const handleTouchStart = (event) => {
    if (!event.touches.length) return;

    touchStartX.current = event.touches[0].clientX;

    touchStartY.current = event.touches[0].clientY;
  };

  /* =====================================================
     TOUCH END
     ===================================================== */

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      return;
    }

    const touch = event.changedTouches[0];

    const deltaX = touch.clientX - touchStartX.current;

    const deltaY = touch.clientY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    /*
     * Ignore vertical scrolling gestures.
     */
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    /*
     * Minimum swipe distance.
     */
    const SWIPE_THRESHOLD = 50;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return;
    }

    if (deltaX < 0) {
      showNext();
    } else {
      showPrevious();
    }
  };

  /* =====================================================
     OUTSIDE CLICK
     ===================================================== */

  const handleBackdropClick = (event) => {
    /*
     * Clicking the actual image does NOT close.
     *
     * Clicking:
     * - dark background
     * - empty area
     * - outside the image
     *
     * DOES close.
     *
     * Caption and navigation controls remain interactive.
     */

    const clickedInsideImage = event.target.closest(
      ".gallery-lightbox__figure",
    );

    const clickedControl = event.target.closest(".gallery-lightbox__control");

    const clickedClose = event.target.closest(".gallery-lightbox__close");

    if (!clickedInsideImage && !clickedControl && !clickedClose) {
      onClose();
    }
  };

  /* =====================================================
     SAFETY
     ===================================================== */

  if (!selectedImage) {
    return null;
  }

  /* =====================================================
     RENDER
     ===================================================== */

  return createPortal(
    <section
      className="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Portfolio image viewer"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* =================================================
          CLOSE
          ================================================= */}

      <button
        ref={closeButtonRef}
        type="button"
        className="gallery-lightbox__close"
        onClick={onClose}
        aria-label="Close image viewer"
      >
        ×
      </button>

      {/* =================================================
          CONTENT
          ================================================= */}

      <div className="gallery-lightbox__content">
        {/* =================================================
            PREVIOUS
            ================================================= */}

        {images.length > 1 && (
          <button
            type="button"
            className="
              gallery-lightbox__control
              gallery-lightbox__control--previous
            "
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}

        {/* =================================================
            IMAGE
            ================================================= */}

        <figure className="gallery-lightbox__figure">
          <img
            className="gallery-lightbox__image"
            src={selectedImage.imageUrl}
            alt={selectedImage.caption || `Our work ${selectedIndex + 1}`}
            draggable="false"
          />

          {/* =================================================
              CAPTION
              ================================================= */}

          {selectedImage.caption && (
            <figcaption className="gallery-lightbox__caption">
              {selectedImage.caption}
            </figcaption>
          )}
        </figure>

        {/* =================================================
            NEXT
            ================================================= */}

        {images.length > 1 && (
          <button
            type="button"
            className="
              gallery-lightbox__control
              gallery-lightbox__control--next
            "
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            aria-label="Next image"
          >
            ›
          </button>
        )}
      </div>
    </section>,
    document.body,
  );
}

export default GalleryLightbox;
