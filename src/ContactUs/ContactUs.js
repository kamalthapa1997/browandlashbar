import React from "react";
import "./ContactUs.css";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";
import { useSettings } from "../contexts/SettingsContext";

function ContactUs({ sectionId, sectionClass }) {
  const { settings } = useSettings();
  const {
    contactPhone: phoneNumber,
    businessEmail,
    streetAddress,
    suiteNumber,
    city,
    state,
    zipCode,
  } = settings || {};
  const title = useRevealOnScroll();
  const content = useRevealOnScroll();

  const contactPhone = phoneNumber || "+12406021445";

  const handlePhoneClick = () => {
    window.location.href = `tel:${contactPhone.replace(/[^0-9+]/g, "")}`;
  };

  const handleEmailClick = () => {
    window.location.href = `mailto:${businessEmail}?subject=Inquiry`;
  };

  const cityState = [city, state].filter(Boolean).join(", ");

  const addressLines = [
    streetAddress,
    suiteNumber,
    [cityState, zipCode].filter(Boolean).join(" "),
  ].filter(Boolean);

  const handleAddressClick = () => {
    const encodedAddress = encodeURIComponent(addressLines.join(", "));

    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
      "_blank",
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

  const today = new Date().toLocaleString("en-us", {
    weekday: "long",
  });

  return (
    <div id={sectionId} className={`${sectionClass || ""} contact-section`}>
      <div
        className="contact-section__decoration contact-section__decoration--top"
        aria-hidden="true"
      />

      <div
        className="contact-section__decoration contact-section__decoration--bottom"
        aria-hidden="true"
      />

      <div
        className="contact-section__botanical contact-section__botanical--left"
        aria-hidden="true"
      >
        ❦
      </div>

      <div
        className="contact-section__botanical contact-section__botanical--right"
        aria-hidden="true"
      >
        ❧
      </div>

      <h1
        ref={title.ref}
        className={`contact-section__title ${title.className}`}
      >
        Contact Us
      </h1>

      <div className="contact-section__title-divider" aria-hidden="true">
        <span />
        <b>✦</b>
        <span />
      </div>

      <div
        ref={content.ref}
        className={`contact-section__content ${content.className}`}
      >
        <div className="contact-section__details">
          <div className="contact-section__item">
            <button
              type="button"
              onClick={handlePhoneClick}
              className="contact-section__link"
            >
              <span className="contact-section__icon">📞</span>

              <span className="contact-section__info">{contactPhone}</span>
            </button>
          </div>

          {businessEmail && (
            <div className="contact-section__item">
              <button
                type="button"
                onClick={handleEmailClick}
                className="contact-section__link"
              >
                <span className="contact-section__icon">📧</span>

                <span className="contact-section__info">{businessEmail}</span>
              </button>
            </div>
          )}

          {addressLines.length > 0 && (
            <div
              className="contact-section__address contact-section__address--interactive"
              onClick={handleAddressClick}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  handleAddressClick();
                }
              }}
            >
              <span className="contact-section__icon">📍</span>

              <span className="contact-section__address-text">
                <span className="contact-section__address-line">
                  {[streetAddress, suiteNumber].filter(Boolean).join(", ")}
                </span>

                <span className="contact-section__address-line">
                  {[cityState, zipCode].filter(Boolean).join(" ")}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="contact-section__hours">
          <div className="contact-section__hours-card">
            <h3 className="contact-section__hours-title">
              <span className="contact-section__icon">⏰</span>

              <span>Opening Hours</span>
            </h3>

            <div className="contact-section__hours-divider">
              <span />
              <span>✦</span>
              <span />
            </div>

            <div className="contact-section__hours-grid">
              {openingHours.map((item, index) => (
                <React.Fragment key={index}>
                  <div
                    className={`contact-section__hours-day ${
                      item.day === today ? "contact-section__hours-current" : ""
                    }`}
                  >
                    {item.day}
                  </div>

                  <div
                    className={`contact-section__hours-value ${
                      item.day === today ? "contact-section__hours-current" : ""
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
  );
}

export default ContactUs;
