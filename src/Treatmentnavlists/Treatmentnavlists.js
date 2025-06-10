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
        { name: "Upper Lip Threading", price: "$10" },
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
        { name: "Classic Lashes", price: "$135" },
        { name: "Hybrid Lashes", price: "$155" },
        { name: "Volume Lashes", price: "$175" },
        { name: "Lash Remove", price: "$25" },
      ],
    },
    {
      name: "Waxing",
      items: [
        { name: "Full leg with Brazilian waxing", price: "$125" },
        { name: "Full leg with Bikini waxing", price: "$110" },
        { name: "Full leg waxing", price: "$80" },
        { name: "Brazilian waxing", price: "$60" },
        { name: "Full arm waxing", price: "$50" },
        { name: "Upper leg waxing", price: "$50" },
        { name: "Bikini waxing", price: "$45" },
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
      items: [{ name: "Custom Design", price: "$20" }],
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
