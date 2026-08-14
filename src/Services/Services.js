import "./Services.css";
import Treatmentnavlists from "../Treatmentnavlists/Treatmentnavlists";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";

function Services({ sectionId, sectionClass }) {
  const heading = useRevealOnScroll();
  const paragraph = useRevealOnScroll();
  const cards = useRevealOnScroll();

  return (
    <div id={sectionId} className={`${sectionClass} services-container`}>
      <div
        className="services-decoration services-decoration--top"
        aria-hidden="true"
      />

      <div
        className="services-decoration services-decoration--bottom"
        aria-hidden="true"
      />

      <div
        className="services-botanical services-botanical--top"
        aria-hidden="true"
      >
        ❦
      </div>

      <div
        className="services-botanical services-botanical--bottom"
        aria-hidden="true"
      >
        ❧
      </div>

      <h1 ref={heading.ref} className={`services__header ${heading.className}`}>
        Our Services
      </h1>

      <p
        ref={paragraph.ref}
        className={`services__paragraph ${paragraph.className}`}
      >
        We proudly offer lash extensions, brow shaping, facials, waxing, and
        more. Our professional staff is dedicated to making every client look
        and feel their absolute best.
      </p>

      <div ref={cards.ref} className={`services__cards ${cards.className}`}>
        <Treatmentnavlists />
      </div>
    </div>
  );
}

export default Services;
