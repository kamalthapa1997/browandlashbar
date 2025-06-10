import React from "react";
import "./ContactUs.css";

function ContactUs({ sectionId, sectionClass }) {
  const handlePhoneClick = () => {
    window.location.href = "tel:+12406021445";
  };

  const handleEmailClick = () => {
    window.location.href =
      "mailto:Merobrowandlashbar4711@gmail.com?subject=Inquiry";
  };

  const handleAddressClick = () => {
    const encodedAddress = encodeURIComponent(
      "4711 Montgomery Ln, Bethesda, MD 20814"
    );
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      "_blank"
    );
  };

  const openingHours = [
    { day: "Monday", hours: "Closed" },
    { day: "Tuesday", hours: "10:00 AM - 7:00 PM" },
    { day: "Wednesday", hours: "10:00 AM - 7:00 PM" },
    { day: "Thursday", hours: "10:00 AM - 7:00 PM" },
    { day: "Friday", hours: "10:00 AM - 7:00 PM" },
    { day: "Saturday", hours: "10:00 AM - 7:00 PM" },
    { day: "Sunday", hours: "10:00 AM - 6:00 PM" },
  ];

  // Highlight today's day
  const today = new Date().toLocaleString("en-us", { weekday: "long" });

  return (
    <div id={sectionId} className={`${sectionClass} contact-container`}>
      <h1 className="contact-title">Contact Us</h1>
      <div className="contact-content">
        <div className="contact-left">
          <div
            className="contact-item clickable"
            onClick={handlePhoneClick}
            title="Click to call"
          >
            <span className="contact-icon">📞</span>
            <span className="contact-text">(240) 602-1445</span>
          </div>
          <div
            className="contact-item clickable"
            onClick={handleEmailClick}
            title="Click to email"
          >
            <span className="contact-icon">📧</span>
            <span className="contact-text">
              Merobrowandlashbar4711@gmail.com
            </span>
          </div>
        </div>
        <div className="contact-right">
          <div
            className="contact-item clickable"
            onClick={handleAddressClick}
            title="Click to view on map"
          >
            <span className="contact-icon">📍</span>
            <span className="contact-text">
              4711 Montgomery Ln, Bethesda, MD 20814
            </span>
          </div>
          {/* <div className="contact-item">
            <div className="opening-hours-container">
              <h3 className="hours-title">
                <span className="contact-icon">⏰</span>
                Opening Hours
              </h3>
              <div className="hours-grid">
                {openingHours.map((item, index) => (
                  <React.Fragment key={index}>
                    <div className={`day ${item.day === today ? "today" : ""}`}>
                      {item.day}
                    </div>
                    <div
                      className={`hours ${item.day === today ? "today" : ""}`}
                    >
                      {item.hours}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div> */}
          <div className="contact-us__item">
            <div className="contact-us__opening-hours-container">
              <h3 className="contact-us__hours-title">
                <span className="contact-us__icon">⏰</span>
                Opening Hours
              </h3>
              <div className="contact-us__hours-grid">
                {openingHours.map((item, index) => (
                  <React.Fragment key={index}>
                    <div
                      className={`contact-us__day ${
                        item.day === today ? "contact-us__today" : ""
                      }`}
                    >
                      {item.day}
                    </div>
                    <div
                      className={`contact-us__hours ${
                        item.day === today ? "contact-us__today" : ""
                      }`}
                    >
                      {item.hours}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactUs;
