import React from "react";
import "./Home.css";

function Home() {
  return (
    <div className="home">
      <p className="aboutus__text ">WELCOME TO</p>
      <h1 className="aboutus__text-title">Mero Brow & Lash Bar</h1>
      <p className="aboutus__texts">
        At Mero Brow & Lash Bar, we specialize in enhancing your natural beauty
        with precision and care. Our experienced team offers a range of
        high-quality services, including eyebrow threading, eyelash extensions,
        henna designs, and professional waxing for smooth, flawless skin.
        <br />
        Whether you're getting ready for a special event or just want to treat
        yourself, we’re here to help you look and feel your best — every day.
      </p>
      <button
        className="aboutus__booknow"
        onClick={() =>
          window.open(
            "https://app.squareup.com/appointments/book/qsq55wbkhksqjt/LX84C87YJHGBC/start",
            "_blank"
          )
        }
      >
        Book an Appointment
      </button>
    </div>
  );
}

export default Home;
