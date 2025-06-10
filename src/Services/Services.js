import React from "react";
import "./Services.css";
import Treatmentnavlists from "../Treatmentnavlists/Treatmentnavlists";

function Services({ sectionId, sectionClass }) {
  return (
    <div id={sectionId} className={`${sectionClass} services-container`}>
      <h1>Our Services</h1>
      <p>
        We offer lash extensions, brow shaping, facials, waxing, and more. Our
        professional staff ensures every client looks and feels their best.
      </p>
      <Treatmentnavlists />
    </div>
  );
}

export default Services;
