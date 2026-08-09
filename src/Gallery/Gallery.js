import React, { useEffect, useRef, useState } from "react";
import "./Gallery.css";
import { getGallery } from "../api/galleryService";

const Gallery = () => {
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");

  const galleryRef = useRef(null);

  useEffect(() => {
    async function loadGallery() {
      setError("");

      try {
        const data = await getGallery();
        setImages(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setError(loadError.message || "Unable to load gallery.");
      }
    }

    loadGallery();
  }, []);

  /*
    Animate gallery items as they enter
    the viewport while scrolling.
  */
  useEffect(() => {
    if (!galleryRef.current) return;

    const items = galleryRef.current.querySelectorAll(".gallery-item");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");

            /*
              Once the animation has happened,
              stop observing that item.
            */
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -60px 0px",
      },
    );

    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [images]);

  return (
    <main className="gallery-page">
      <header className="gallery-page__header">
        <p>Our Portfolio</p>
        <h1>Beauty in every detail</h1>
      </header>

      {error && <p className="gallery-error">{error}</p>}

      {!error && images.length > 0 && (
        <section className="gallery-list" ref={galleryRef}>
          {images.map((item, i) => (
            <article className="gallery-item" key={item._id || i}>
              <div className="gallery-item__image">
                <img
                  src={item.imageUrl}
                  alt={item.caption || `Our work ${i + 1}`}
                  loading="lazy"
                />
              </div>

              {item.caption && (
                <div className="gallery-item__caption">
                  <p>{item.caption}</p>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {!error && images.length === 0 && (
        <p className="gallery-empty">Our latest work will be here soon.</p>
      )}
    </main>
  );
};

export default Gallery;
