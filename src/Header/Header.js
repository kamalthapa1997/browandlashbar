import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import "./Header.css";

function Header({ sectionId, sectionClass, logoUrl }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleSectionClick = (sectionId) => {
    if (location.pathname !== "/") {
      navigate(`/#${sectionId}`);
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

  return (
    <header id={sectionId} className={`${sectionClass || ""} header`}>
      <div className="nav_lists">
        <Link
          to="/"
          state={{ scrollToTop: true }}
          className="logo-container"
          aria-label="Mero Brow & Lash Bar home"
          onClick={(event) => {
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
              className="nav-link"
              onClick={() => handleSectionClick("services")}
            >
              Services
            </button>

            <Link to="/gallery" className="nav-link">
              Gallery
            </Link>

            <button
              type="button"
              className="nav-link"
              onClick={() => handleSectionClick("contact")}
            >
              Contact Us
            </button>

            <Link to="/login" className="nav-link">
              Login
            </Link>
          </nav>
        </div>

        <button
          type="button"
          className="menu-icon mobile"
          onClick={toggleMenu}
          ref={toggleRef}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
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
                  className="nav-link mobile-menu__link"
                  onClick={() => {
                    setMenuOpen(false);
                    handleSectionClick("services");
                  }}
                >
                  Services
                </button>

                <Link
                  to="/gallery"
                  className="nav-link mobile-menu__link"
                  onClick={() => setMenuOpen(false)}
                >
                  Gallery
                </Link>

                <button
                  type="button"
                  className="nav-link mobile-menu__link"
                  onClick={() => {
                    setMenuOpen(false);
                    handleSectionClick("contact");
                  }}
                >
                  Contact Us
                </button>

                <Link
                  to="/login"
                  className="nav-link mobile-menu__link"
                  onClick={() => setMenuOpen(false)}
                >
                  Login
                </Link>
              </motion.nav>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export default Header;
