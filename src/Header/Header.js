import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./Header.css";

function Header({ sectionId, sectionClass }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

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
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header id={sectionId} className={`${sectionClass} header`}>
      <div id={sectionId} className="nav_lists">
        <a href="/">
          <img src="/logoo.svg" alt="logo" className="header__mainlogo" />
        </a>
        <div className="nav-container desktop">
          <nav className="nav-links desktop">
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
          </nav>
        </div>

        <div
          className="menu-icon mobile"
          onClick={toggleMenu}
          ref={toggleRef}
          aria-label="Toggle menu"
          role="button"
          tabIndex={0}
          onKeyPress={(e) => {
            if (e.key === "Enter") toggleMenu();
          }}
        >
          {menuOpen ? "\u2715" : "\u2261"} {/* × or ≡ */}
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="mobile-menu"
            ref={menuRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="nav-link"
              onClick={() => {
                handleSectionClick("services");
                setMenuOpen(false);
              }}
            >
              Services
            </span>
            <Link
              to="/gallery"
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              Gallery
            </Link>
            <span
              className="nav-link"
              onClick={() => {
                handleSectionClick("contact");
                setMenuOpen(false);
              }}
            >
              Contact Us
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Header;
