import "./Home.css";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";
import { useSettings } from "../contexts/SettingsContext";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const businessName =
    settings?.businessName === undefined
      ? "Mero Brow & Lash Bar"
      : settings?.businessName;
  const welcome = useRevealOnScroll();
  const title = useRevealOnScroll();
  const description = useRevealOnScroll();
  const booking = useRevealOnScroll();

  return (
    <div className="home-hero">
      <div
        className="home-hero__decoration home-hero__decoration--top"
        aria-hidden="true"
      />

      <div
        className="home-hero__decoration home-hero__decoration--bottom"
        aria-hidden="true"
      />

      <div
        className="home-hero__botanical home-hero__botanical--left"
        aria-hidden="true"
      >
        ❦
      </div>

      <div
        className="home-hero__botanical home-hero__botanical--right"
        aria-hidden="true"
      >
        ❧
      </div>

      <div className="home-hero__content">
        <p
          ref={welcome.ref}
          className={`home-hero__eyebrow ${welcome.className}`}
        >
          Welcome To
        </p>

        <h1
          ref={title.ref}
          className={`home-hero__title ${title.className}`}
        >
          {businessName}
        </h1>

        <div className="home-hero__title-divider" aria-hidden="true">
          <span />
          <b>✦</b>
          <span />
        </div>

        <p
          ref={description.ref}
          className={`home-hero__description ${description.className}`}
        >
          At Mero Brow &amp; Lash Bar, we specialize in enhancing your natural
          beauty with precision and care. Our experienced team offers a range of
          high-quality services, including{" "}
          <span className="home-hero__highlight">eyebrow threading</span>,{" "}
          <span className="home-hero__highlight">eyelash extensions</span>,{" "}
          <span className="home-hero__highlight">henna designs</span>, and{" "}
          <span className="home-hero__highlight">professional waxing</span> for smooth,
          flawless skin.
          <br />
          <br />
          Whether you're getting ready for a special event or just want to treat
          yourself, we’re here to help you look and feel your best — every day.
        </p>

        <button
          ref={booking.ref}
          className={`home-hero__booking-button ${booking.className}`}
          onClick={() => navigate("/book")}
        >
          Book an Appointment
        </button>
      </div>
    </div>
  );
}

export default Home;
