import "./Home.css";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";

function Home({ businessName = "Mero Brow & Lash Bar" }) {
  const welcome = useRevealOnScroll();
  const title = useRevealOnScroll();
  const description = useRevealOnScroll();
  const booking = useRevealOnScroll();

  return (
    <div className="home">
      <div
        className="home-decoration home-decoration--top"
        aria-hidden="true"
      />

      <div
        className="home-decoration home-decoration--bottom"
        aria-hidden="true"
      />

      <div className="home-botanical home-botanical--left" aria-hidden="true">
        ❦
      </div>

      <div className="home-botanical home-botanical--right" aria-hidden="true">
        ❧
      </div>

      <div className="home-content">
        <p ref={welcome.ref} className={`aboutus__text ${welcome.className}`}>
          Welcome To
        </p>

        <h1
          ref={title.ref}
          className={`aboutus__text-title ${title.className}`}
        >
          {businessName}
        </h1>

        <div className="home-title-divider" aria-hidden="true">
          <span />
          <b>✦</b>
          <span />
        </div>

        <p
          ref={description.ref}
          className={`aboutus__texts ${description.className}`}
        >
          At Mero Brow &amp; Lash Bar, we specialize in enhancing your natural
          beauty with precision and care. Our experienced team offers a range of
          high-quality services, including{" "}
          <span className="highlight">eyebrow threading</span>,{" "}
          <span className="highlight">eyelash extensions</span>,{" "}
          <span className="highlight">henna designs</span>, and{" "}
          <span className="highlight">professional waxing</span> for smooth,
          flawless skin.
          <br />
          <br />
          Whether you're getting ready for a special event or just want to treat
          yourself, we’re here to help you look and feel your best — every day.
        </p>

        <button
          ref={booking.ref}
          className={`aboutus__booknow ${booking.className}`}
          onClick={() =>
            window.open("https://merobrwoandlashbar.square.site/", "_blank")
          }
        >
          Book an Appointment
        </button>
      </div>
    </div>
  );
}

export default Home;
