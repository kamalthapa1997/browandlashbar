import React from "react";
import "./Gallery.css";
import gal1 from "../Images/gall1.jpg";
import gal2 from "../Images/gal2.jpg";
import gal3 from "../Images/gal3.jpg";
import gal4 from "../Images/gal4.jpg";
import gal5 from "../Images/gal5.jpg";
import gal6 from "../Images/gal6.jpg";
import gal7 from "../Images/gal7.jpg";
import gal8 from "../Images/gal8.jpg";
import gal9 from "../Images/gal9.jpg";
import gal10 from "../Images/gal10.jpg";

const images = [gal1, gal2, gal3, gal4, gal5, gal6, gal7, gal8, gal9, gal10];

const Gallery = () => {
  return (
    <div className="gallery-page">
      <h2 className="gallery__heading">Our Work</h2>
      <div className="gallery-grid">
        {images.map((src, i) => (
          <img key={i} src={src} alt={`Work ${i + 1}`} />
        ))}
      </div>
    </div>
  );
};

export default Gallery;
