import React, { useEffect, useState } from "react";
import "./Gallery.css";
import { getGallery } from "../api/galleryService";

const Gallery = () => {
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");

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

  return (
    <main className="gallery-page">
      <header className="gallery-page__header">
        <p>Our portfolio</p>
        <h1>Beauty in every detail</h1>
      </header>
      <div className="gallery-list">
        {error && <p className="gallery-error" role="alert">{error}</p>}
        {images.map((item, i) => (
          <div className="gallery-item" key={item._id || i}>
            <img src={item.imageUrl} alt={item.caption || `Work ${i + 1}`} />
            {item.caption && <p>{item.caption}</p>}
          </div>
        ))}
        {!error && images.length === 0 && (
          <p className="gallery-empty">Our latest work will be here soon.</p>
        )}
      </div>
    </main>
  );
};

export default Gallery;
