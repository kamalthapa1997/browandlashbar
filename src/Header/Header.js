import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./Header.css";

function Header({ sectionId, sectionClass, logoUrl }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const scrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches
    ? "auto"
    : "smooth";

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  // Handle outside click for mobile menu
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
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  // Scroll handler for "Services" and "Contact Us"
  const handleSectionClick = (sectionId) => {
    if (location.pathname !== "/") {
      navigate(`/#${sectionId}`);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: scrollBehavior });
      }
    }
  };

  return (
    <header id={sectionId} className={`${sectionClass} header`}>
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
            alt="logo"
            className="header__mainlogo"
          />
        </Link>

        <div className="nav-container desktop">
          <div className="nav-links">
            <span
              className="nav-link"
              onClick={() => handleSectionClick("services")}
            >
              Services
            </span>

            <Link to="/gallery" className="nav-link">
              Gallery
            </Link>

            <span
              className="nav-link"
              onClick={() => handleSectionClick("contact")}
            >
              Contact Us
            </span>

            <Link to="/login" className="nav-link">
              Login
            </Link>
          </div>
        </div>

        <div
          className="menu-icon mobile"
          onClick={toggleMenu}
          ref={toggleRef}
          aria-label="Toggle menu"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleMenu();
            }
          }}
        >
          {menuOpen ? "×" : "≡"}
        </div>
      </div>
    </header>
  );
}

export default Header;
