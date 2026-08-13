import React from "react";
import "./ContactUs.css";
import useRevealOnScroll from "../components/Reveal/useRevealOnScroll";

function ContactUs({
  sectionId,
  sectionClass,
  phoneNumber,
  businessEmail,
  streetAddress,
  suiteNumber,
  city,
  state,
  zipCode,
}) {
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
    <div id={sectionId} className={`${sectionClass || ""} contact-container`}>
      {/* =====================================================
          VINTAGE DECORATIONS
          ===================================================== */}

      <div
        className="contact-decoration contact-decoration--top"
        aria-hidden="true"
      />

      <div
        className="contact-decoration contact-decoration--bottom"
        aria-hidden="true"
      />

      <div
        className="contact-botanical contact-botanical--left"
        aria-hidden="true"
      >
        ❦
      </div>

      <div
        className="contact-botanical contact-botanical--right"
        aria-hidden="true"
      >
        ❧
      </div>

      {/* =====================================================
          TITLE
          ===================================================== */}

      <h1
        ref={title.ref}
        className={`contact-title Header__text ${title.className}`}
      >
        Contact Us
      </h1>

      <div className="contact-title-line" aria-hidden="true">
        <span />
        <b>✦</b>
        <span />
      </div>

      {/* =====================================================
          MAIN CONTENT
          ===================================================== */}

      <div ref={content.ref} className={`contact-content ${content.className}`}>
        {/* ===================================================
            CONTACT INFORMATION
            =================================================== */}

        <div className="contact-us__infos">
          {/* Phone */}
          <div className="contact-us__item">
            <button
              type="button"
              onClick={handlePhoneClick}
              className="contact-us__link"
            >
              <span className="contact-us__icon">📞</span>

              <span className="contact-infos">{contactPhone}</span>
            </button>
          </div>

          {/* Email */}
          {businessEmail && (
            <div className="contact-us__item">
              <button
                type="button"
                onClick={handleEmailClick}
                className="contact-us__link"
              >
                <span className="contact-us__icon">📧</span>

                <span className="contact-infos">{businessEmail}</span>
              </button>
            </div>
          )}

          {/* Address */}
          {addressLines.length > 0 && (
            <div
              className="contact-item clickable"
              onClick={handleAddressClick}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  handleAddressClick();
                }
              }}
            >
              <span className="contact-icon">📍</span>

              <span className="contact-text">
                <span className="contact-address-line">
                  {[streetAddress, suiteNumber].filter(Boolean).join(", ")}
                </span>

                <span className="contact-address-line">
                  {[cityState, zipCode].filter(Boolean).join(" ")}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ===================================================
            OPENING HOURS
            =================================================== */}

        <div className="contact-us__hours-section">
          <div className="contact-us__opening-hours-container">
            <h3 className="contact-us__hours-title">
              <span className="contact-us__icon">⏰</span>

              <span>Opening Hours</span>
            </h3>

            <div className="contact-hours-divider">
              <span />
              <span>✦</span>
              <span />
            </div>

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
  );
}

export default ContactUs;
