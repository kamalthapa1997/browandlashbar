import { useEffect, useState } from "react";
import "./Treatmentnavlists.css";
import { getServices } from "../api/serviceService";
import {
  serviceCategories,
  serviceCategoryLabels,
} from "../constants/serviceCategories";

const Treatmentnavlists = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const [categoryServices, setCategoryServices] = useState([]);
  const [error, setError] = useState("");

  const toggleService = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  useEffect(() => {
    async function loadServices() {
      setError("");
      try {
        const data = await getServices();
        const grouped = serviceCategories.map((category) => ({
          name: serviceCategoryLabels[category] || category,
          rawName: category,
          items: Array.isArray(data[category]) ? data[category] : [],
        }));
        setCategoryServices(grouped.filter((group) => group.items.length > 0));
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load services.");
      }
    }

    loadServices();
  }, []);

  return (
    <div className="service-accordion">
      {error && <div className="service-accordion__error">{error}</div>}
      <div className="service-accordion__list">
        {categoryServices.map((service, index) => (
          <div
            className="treatment-card service-accordion__item"
            key={service.rawName}
          >
            <button
              className={`service-accordion__header ${
                openIndex === index ? "service-accordion__header--open" : ""
              }`}
              onClick={() => toggleService(index)}
              aria-expanded={openIndex === index}
              aria-controls={`treatment-details-${index}`}
            >
              {service.name}
              <span className="service-accordion__toggle-icon">
                {openIndex === index ? "−" : "+"}
              </span>
            </button>

            <div
              id={`treatment-details-${index}`}
              className={`service-accordion__content ${
                openIndex === index ? "service-accordion__content--open" : ""
              }`}
            >
              <ul className="service-accordion__services">
                {service.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="service-accordion__service"
                    style={{ "--i": idx }}
                  >
                    <div className="service-accordion__line">
                      <span className="service-accordion__name">{item.name}</span>
                      <span className="service-accordion__dotted-line"></span>
                      <span className="service-accordion__price">
                        ${item.price.toFixed(2)}
                      </span>
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
