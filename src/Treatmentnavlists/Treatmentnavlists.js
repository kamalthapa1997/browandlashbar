import React, { useState } from "react";
import "./Treatmentnavlists.css";

const Treatmentnavlists = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleService = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const services = [
    {
      name: "Threading",
      items: [
        { name: "Eyebrow Threading", price: "$15" },
        { name: " Lip Threading", price: "$10" },
        { name: "Chin Threading", price: "$11" },
        { name: "Forehead Threading", price: "$10" },
        { name: "Neck Threading", price: "$10" },
        { name: "Side Burn Threading", price: "$15" },
        { name: "Full Face Threading", price: "$55" },
      ],
    },
    {
      name: "Eyelashes",
      items: [
        { name: "Classic Lashes", price: "$120" },
        { name: "Hybrid Lashes", price: "$130" },
        { name: "Volume Lashes", price: "$140" },
        { name: "Lash Remove", price: "$25" },
      ],
    },

    ///
    {
      name: "Refill",
      items: [
        { name: "Classic 1 week refill", price: "$40" },
        { name: "Hybrid 1 week refill", price: "$45" },
        { name: "Volume 1 week refill", price: "$50" },
        { name: "Classic 2 week refill", price: "$65" },
        { name: "Hybrid 2 week refill", price: "$75" },
        { name: "Volume 2 week refill", price: "$85" },
      ],
    },
    {
      name: "Tint",
      items: [
        { name: "Eyebrow Tint", price: "$20" },
        { name: "Lash Tint", price: "$20" },
      ],
    },
    {
      name: "Lift and Lamination ",
      items: [
        { name: " Lashe Lift", price: "$75" },
        { name: " Lashe lift and Tint", price: "$85" },
        { name: "Brow Lamination", price: "$75" },
        { name: "Brow Lamination and Tint", price: "$90" },
        { name: "Brow Lamination, Tint, and Eyebrows", price: "$105" },
        { name: "Brow Threading and Lamination", price: "$85" },
      ],
    },

    ///
    {
      name: "Waxing",
      items: [
        { name: "Full leg with Brazilian waxing", price: "$125" },
        { name: "Full leg with Bikini waxing", price: "$110" },
        { name: "Full leg waxing", price: "$80" },
        { name: "Full Face waxing", price: "$65" },
        { name: "Brazilian waxing", price: "$55" },
        { name: "Full arm waxing", price: "$50" },
        { name: "Upper leg waxing", price: "$50" },
        { name: "Bikini waxing", price: "$40" },
        { name: "Lower leg waxing", price: "$40" },
        { name: "Half arm up/low waxing", price: "$35" },
        { name: "Chest waxing", price: "$35" },
        { name: "Underarm waxing", price: "$25" },
        { name: "Belly waxing", price: "$25" },
        { name: "Eyebrow waxing", price: "$18" },
        { name: "Sideburn waxing", price: "$18" },
        { name: "Toes waxing", price: "$15" },
        { name: "Chin waxing", price: "$14" },
        { name: "Forehead waxing", price: "$12" },
        { name: "Upper lip waxing", price: "$10" },
      ],
    },
    {
      name: "Henna",
      items: [{ name: "Custom Design", price: "$20 and up" }],
    },
    {
      name: "Others ",
      items: [
        { name: " Eyebrow and Lip Threading", price: "$20" },
        { name: " Eyebrow Threading and Tint", price: "$30" },
      ],
    },
  ];

  return (
    <div className="treatment-container">
      {/* <div className="treatment-header">
        <h2>Our Services & Pricing</h2>
        <p>Click on a service category to view options</p>
      </div> */}

      <div className="treatmentnavlists__service-lists">
        {services.map((service, index) => (
          <div className="treatment-card" key={index}>
            <button
              className={`treatmentnavlists__btn ${
                openIndex === index ? "active" : ""
              }`}
              onClick={() => toggleService(index)}
              aria-expanded={openIndex === index}
              aria-controls={`treatment-details-${index}`}
            >
              {service.name}
              <span className="toggle-icon">
                {openIndex === index ? "−" : "+"}
              </span>
            </button>

            <div
              id={`treatment-details-${index}`}
              className={`treatmentnavlists_details ${
                openIndex === index ? "active" : ""
              }`}
            >
              <ul className="treatmentnavlists_lists">
                {service.items.map((item, idx) => (
                  <li key={idx} className="service-item" style={{ "--i": idx }}>
                    <div className="service-line">
                      <span className="service-name">{item.name}</span>
                      <span className="dotted-line"></span>
                      <span className="service-price">{item.price}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Treatmentnavlists;
