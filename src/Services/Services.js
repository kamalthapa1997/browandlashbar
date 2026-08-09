import React from "react";
import "./Services.css";
import Treatmentnavlists from "../Treatmentnavlists/Treatmentnavlists";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";

function Services({ sectionId, sectionClass }) {
  const heading = useRevealOnScroll();
  const paragraph = useRevealOnScroll();
  const cards = useRevealOnScroll();

  return (
    <div id={sectionId} className={`${sectionClass} services-container`}>
      <h1 ref={heading.ref} className={`services__header ${heading.className}`}>Our Services</h1>
      <p ref={paragraph.ref} className={`services__paragraph ${paragraph.className}`}>
        We proudly offer lash extensions, brow shaping, facials, waxing, and
        more. Our professional staff is dedicated to making every client look
        and feel their absolute best.
        <br />
        <br />
        {/* Please note, the prices shown here reflect our regular rates, but if you
        choose to book online, you’ll enjoy special discounts designed to make
        your experience even better. */}
      </p>
      <div ref={cards.ref} className={`services__cards ${cards.className}`}>
        <Treatmentnavlists />
      </div>
    </div>
  );
}

export default Services;
