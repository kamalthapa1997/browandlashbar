import { useEffect, useState } from "react";
import "./Treatmentnavlists.css";
import { getSquareMenuServices } from "../api/squareService";

const Treatmentnavlists = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const [categoryServices, setCategoryServices] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const toggleService = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  useEffect(() => {
    async function loadServices() {
      setError("");
      setLoading(true);
      try {
        const data = await getSquareMenuServices();
        const grouped = (Array.isArray(data.categories) ? data.categories : [])
          .map((category) => ({
            name: category.name || "Other",
            rawName: category.id || category.name || "other",
            items: Array.isArray(category.services) ? category.services : [],
          }))
          .filter((group) => group.items.length > 0);
        setCategoryServices(grouped);
      } catch (fetchError) {
        setError(fetchError.message || "Unable to load services.");
      } finally {
        setLoading(false);
      }
    }

    loadServices();
  }, []);

  return (
    <div className="service-accordion">
      {error && <div className="service-accordion__error" role="alert">{error}</div>}
      {!loading && !error && categoryServices.length === 0 && (
        <div className="service-accordion__error" role="status">
          No appointment services are available right now.
        </div>
      )}
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
                    key={item.variationId || item.id || idx}
                    className="service-accordion__service"
                    style={{ "--i": idx }}
                  >
                    <div className="service-accordion__line">
                      <span className="service-accordion__name">{item.name}</span>
                      <span className="service-accordion__dotted-line"></span>
                      <span className="service-accordion__price">
                        {Number.isFinite(item.price)
                          ? `$${item.price.toFixed(2)}`
                          : "Price varies"}
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
