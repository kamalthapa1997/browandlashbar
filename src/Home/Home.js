import React from "react";
import "./Home.css";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";

function Home({ businessName = "Mero Brow & Lash Bar" }) {
  const welcome = useRevealOnScroll();
  const title = useRevealOnScroll();
  const description = useRevealOnScroll();
  const booking = useRevealOnScroll();

  return (
    <div className="home">
      <p ref={welcome.ref} className={`aboutus__text ${welcome.className}`}>WELCOME TO</p>
      <h1 ref={title.ref} className={`aboutus__text-title ${title.className}`}>{businessName}</h1>
      <p ref={description.ref} className={`aboutus__texts ${description.className}`}>
        At Mero Brow &amp; Lash Bar, we specialize in enhancing your natural
        beauty with precision and care. Our experienced team offers a range of
        high-quality services, including{" "}
        <span className="highlight">eyebrow threading</span>,{" "}
        <span className="highlight">eyelash extensions</span>,{" "}
        <span className="highlight">henna designs</span>, and{" "}
        <span className="highlight">professional waxing</span> for smooth,
        flawless skin.
        <br />
        Whether you're getting ready for a special event or just want to treat
        yourself, we’re here to help you look and feel your best — every day.
      </p>

      {/* <p className="aboutus__texts">
        At Mero Brow & Lash Bar, we specialize in enhancing your natural beauty
        with precision and care. Our experienced team offers a range of
        high-quality services, including eyebrow threading, eyelash extensions,
        henna designs, and professional waxing for smooth, flawless skin.
        <br />
        Whether you're getting ready for a special event or just want to treat
        yourself, we’re here to help you look and feel your best — every day.
      </p> */}

      {/* <div className="aboutus__announcement">
        📢 <strong>New Waxing Services!</strong> Starting July 15 — Enjoy{" "}
        <strong>40% off</strong> your first visit and <strong>15% off</strong>{" "}
        your second visit. Booking opens on <strong>July 13</strong>.
      </div> */}

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
  );
}

export default Home;
