import React from "react";
import "./Gallery.css";

const images = [
  "/images/img1.jpg",
  "/images/img2.jpg",
  "/images/img3.jpg",
  "/images/img4.jpg",
  "/images/img5.jpg",
  "/images/img6.jpg",
];

const Gallery = () => {
  return (
    <div className="gallery-page">
      <h2>Our Work</h2>
      <div className="gallery-grid">
        {images.map((src, i) => (
          <img key={i} src={src} alt={`Work ${i + 1}`} />
        ))}
      </div>
    </div>
  );
};

export default Gallery;
