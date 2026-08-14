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
    <div className="treatment-container">
      {error && <div className="treatment-error">{error}</div>}
      <div className="treatmentnavlists__service-lists">
        {categoryServices.map((service, index) => (
          <div className="treatment-card" key={service.rawName}>
            <button
              className={`treatmentnavlists__btn ${openIndex === index ? "active" : ""}`}
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
              className={`treatmentnavlists_details ${openIndex === index ? "active" : ""}`}
            >
              <ul className="treatmentnavlists_lists">
                {service.items.map((item, idx) => (
                  <li key={idx} className="service-item" style={{ "--i": idx }}>
                    <div className="service-line">
                      <span className="service-name">{item.name}</span>
                      <span className="dotted-line"></span>
                      <span className="service-price">
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
