import { useEffect, useId, useMemo, useState } from "react";
import { getFaqs } from "../../api/faqService";
import useRevealOnScroll from "../Reveal/useRevealOnScroll";
import "./Faq.css";

function Faq() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [openId, setOpenId] = useState(null);
  const heading = useRevealOnScroll();
  const list = useRevealOnScroll();
  const sectionId = useId();

  useEffect(() => {
    let current = true;
    getFaqs()
      .then((data) => current && setFaqs(Array.isArray(data) ? data : []))
      .catch((requestError) => {
        if (current) setError(requestError.message || "Unable to load FAQs.");
      })
      .finally(() => current && setLoading(false));
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (faqs.length && window.location.hash === "#faq") {
      document.getElementById("faq")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  }, [faqs.length]);

  const categories = useMemo(
    () => ["All", ...new Set(faqs.map((faq) => faq.category))],
    [faqs],
  );
  const filteredFaqs = useMemo(
    () => faqs.filter((faq) => activeCategory === "All" || faq.category === activeCategory),
    [faqs, activeCategory],
  );
  const showFilters = faqs.length >= 5 && categories.length > 2;

  useEffect(() => {
    if (!filteredFaqs.some((faq) => faq._id === openId)) setOpenId(null);
  }, [filteredFaqs, openId]);

  return (
    <section id="faq" className="faq-section" aria-labelledby="faq-title">
      <div className="faq-section__inner">
        <header ref={heading.ref} className={`faq-section__heading ${heading.className}`}>
          <p>Helpful details</p>
          <h2 id="faq-title">Frequently Asked Questions</h2>
          <span aria-hidden="true"><i />✦<i /></span>
          <div>Answers to the questions we hear most before your visit.</div>
        </header>

        {error ? (
          <p className="faq-section__error" role="alert">{error}</p>
        ) : loading ? (
          <p className="faq-section__empty">Loading frequently asked questions…</p>
        ) : !faqs.length ? (
          <p className="faq-section__empty">We’re preparing helpful answers for your next visit.</p>
        ) : (
          <div ref={list.ref} className={`faq-section__content ${list.className}`}>
            {showFilters && (
              <div className="faq-section__filters" aria-label="Filter FAQs by category">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={activeCategory === category ? "is-active" : ""}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
            <div className="faq-accordion">
              {filteredFaqs.map((faq) => {
                const isOpen = faq._id === openId;
                const contentId = `${sectionId}-answer-${faq._id}`;
                return (
                  <article className={`faq-accordion__item ${isOpen ? "is-open" : ""}`} key={faq._id}>
                    <button
                      type="button"
                      className="faq-accordion__trigger"
                      aria-expanded={isOpen}
                      aria-controls={contentId}
                      onClick={() => setOpenId(isOpen ? null : faq._id)}
                    >
                      <span>{faq.question}</span>
                      <b aria-hidden="true">{isOpen ? "−" : "+"}</b>
                    </button>
                    <div id={contentId} className="faq-accordion__answer" hidden={!isOpen}>
                      <p>{faq.answer}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Faq;
