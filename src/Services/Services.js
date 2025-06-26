import React from "react";
import "./Services.css";
import Treatmentnavlists from "../Treatmentnavlists/Treatmentnavlists";

function Services({ sectionId, sectionClass }) {
  return (
    <div id={sectionId} className={`${sectionClass} services-container`}>
      <h1 className="services__header">Our Services</h1>
      <p className="services__paragraph">
        We proudly offer lash extensions, brow shaping, facials, waxing, and
        more. Our professional staff is dedicated to making every client look
        and feel their absolute best.
        <br />
        <br />
        Please note, the prices shown here reflect our regular rates, but if you
        choose to book online, you’ll enjoy special discounts designed to make
        your experience even better.
      </p>
      <Treatmentnavlists />
    </div>
  );
}

export default Services;
