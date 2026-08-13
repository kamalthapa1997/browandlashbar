import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "./Header.css";

const DISMISS_PREFIX = "homepage-offer-dismissed:";
const DEFAULT_BOOKING_URL = "https://merobrowandlashbar.square.site";

function Header({
  sectionId,
  sectionClass,
  logoUrl,
  homepageOffer,
  homepageOfferLink,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const headerRef = useRef(null);
  const [dismissed, setDismissed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const scrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches
    ? "auto"
    : "smooth";

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        toggleRef.current &&
        !toggleRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  // Offer handling
  const offerText =
    typeof homepageOffer === "string" ? homepageOffer.trim() : "";
  const hasOffer = offerText.length > 0;
  const storageKey = hasOffer
    ? DISMISS_PREFIX + encodeURIComponent(offerText)
    : null;

  // Compute the URL for the Book Now action; fall back to default if invalid/empty
  const rawLink =
    typeof homepageOfferLink === "string" ? homepageOfferLink.trim() : "";
  let offerUrl = DEFAULT_BOOKING_URL;
  if (rawLink) {
    try {
      const parsed = new URL(rawLink);
      if (["http:", "https:"].includes(parsed.protocol)) {
        offerUrl = rawLink;
      }
    } catch (e) {
      // invalid URL -> fall back to default
      offerUrl = DEFAULT_BOOKING_URL;
    }
  }

  useEffect(() => {
    if (!hasOffer) {
      setDismissed(false);
      return;
    }
    try {
      const stored = sessionStorage.getItem(storageKey);
      setDismissed(Boolean(stored));
    } catch (e) {
      setDismissed(false);
    }
  }, [storageKey, hasOffer]);

  function closeOffer() {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch (e) {
      // ignore
    }
    setDismissed(true);
  }

  // Keep CSS variable --header-height in sync with rendered header height
  function updateHeaderHeight() {
    const el = headerRef.current;
    if (!el) return;
    const h = el.offsetHeight || 76;
    try {
      el.style.setProperty("--header-height", `${h}px`);
    } catch (e) {
      // ignore
    }
  }

  function updateDocumentHeaderVar() {
    const el = headerRef.current;
    if (!el) return;
    const h = el.offsetHeight || 76;
    try {
      document.documentElement.style.setProperty("--header-height", `${h}px`);
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    updateHeaderHeight();
    updateDocumentHeaderVar();
    const onResize = () => {
      updateHeaderHeight();
      updateDocumentHeaderVar();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hasOffer, dismissed]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const handleSectionClick = (sectionId) => {
    setMenuOpen(false);
    const targetHash = `#${sectionId}`;

    if (location.pathname !== "/" || location.hash !== targetHash) {
      navigate({ pathname: "/", hash: targetHash });
      return;
    }

    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({
        behavior: scrollBehavior,
        block: "start",
      });
    }
  };

  const sectionLinkClass = (sectionId) =>
    `nav-link${
      location.pathname === "/" && location.hash === `#${sectionId}`
        ? " is-active"
        : ""
    }`;

  const routeLinkClass = ({ isActive }) =>
    `nav-link${isActive ? " is-active" : ""}`;

  return (
    <header
      ref={headerRef}
      id={sectionId}
      className={`${sectionClass || ""} header`}
    >
      <AnimatePresence>
        {hasOffer && !dismissed && (
          <motion.div
            className="header__offer"
            initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, height: "auto" }
            }
            exit={
              shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
            }
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          >
            <div className="header__offer-inner">
              <a
                className="header__offer-book"
                href={offerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Book now"
              >
                Book Now
              </a>

              <div className="header__offer-text" aria-live="polite">
                {offerText}
              </div>

              <button
                type="button"
                className="header__offer-close"
                onClick={closeOffer}
                aria-label="Close offer"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="nav_lists">
        <Link
          to="/"
          state={{ scrollToTop: true }}
          className="logo-container"
          aria-label="Mero Brow & Lash Bar home"
          onClick={(event) => {
            setMenuOpen(false);
            if (location.pathname === "/") {
              event.preventDefault();

              window.scrollTo({
                top: 0,
                behavior: scrollBehavior,
              });
            }
          }}
        >
          <img
            src={logoUrl || "/mainlogo.png"}
            alt="Mero Brow & Lash Bar"
            className="header__mainlogo"
          />
        </Link>

        <div className="nav-container desktop">
          <nav className="nav-links" aria-label="Desktop navigation">
            <button
              type="button"
              className={sectionLinkClass("services")}
              onClick={() => handleSectionClick("services")}
            >
              Services
            </button>

            <NavLink to="/gallery" className={routeLinkClass}>
              Gallery
            </NavLink>

            <button
              type="button"
              className={sectionLinkClass("contact")}
              onClick={() => handleSectionClick("contact")}
            >
              Contact Us
            </button>

            <NavLink to="/login" className={routeLinkClass}>
              Login
            </NavLink>
          </nav>
        </div>

        <button
          type="button"
          className="menu-icon mobile"
          onClick={toggleMenu}
          ref={toggleRef}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
        >
          <span className={menuOpen ? "menu-icon__close" : "menu-icon__open"}>
            {menuOpen ? "×" : "≡"}
          </span>
        </button>

        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                className="mobile-menu-backdrop"
                initial={shouldReduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.25,
                  ease: "easeOut",
                }}
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />

              <motion.nav
                id="mobile-navigation"
                ref={menuRef}
                className="mobile-menu"
                aria-label="Mobile navigation"
                initial={
                  shouldReduceMotion
                    ? false
                    : {
                        opacity: 0,
                        x: 30,
                      }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                exit={
                  shouldReduceMotion
                    ? undefined
                    : {
                        opacity: 0,
                        x: 30,
                      }
                }
                transition={{
                  duration: shouldReduceMotion ? 0 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <button
                  type="button"
                  className={`${sectionLinkClass("services")} mobile-menu__link`}
                  onClick={() => {
                    setMenuOpen(false);
                    handleSectionClick("services");
                  }}
                >
                  Services
                </button>

                <NavLink
                  to="/gallery"
                  className={({ isActive }) =>
                    `${routeLinkClass({ isActive })} mobile-menu__link`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  Gallery
                </NavLink>

                <button
                  type="button"
                  className={`${sectionLinkClass("contact")} mobile-menu__link`}
                  onClick={() => {
                    setMenuOpen(false);
                    handleSectionClick("contact");
                  }}
                >
                  Contact Us
                </button>

                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `${routeLinkClass({ isActive })} mobile-menu__link`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </NavLink>
              </motion.nav>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export default Header;
