import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import "./App.css";
import Header from "./Header/Header.js";
import Services from "./Services/Services";
import ContactUs from "./ContactUs/ContactUs";
import Gallery from "./Gallery/Gallery.js";
import Home from "./Home/Home.js";
import Reviews from "./Reviews/Reviews";
import Login from "./Login/Login";
import Footer from "./Footer/Footer";
import AdminDashboard from "./AdminDashboard/AdminDashboard";
import PageTransition from "./components/PageTransition/PageTransition";
import { getSettings } from "./api/settingsService";
import { getCurrentAdmin } from "./api/authService";

function RequireAuth({ children }) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getCurrentAdmin()
      .then((session) => {
        if (isMounted) setIsAuthenticated(Boolean(session?.authenticated));
      })
      .catch(() => {
        if (isMounted) setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) setIsChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  if (isChecking) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function HomePage({ settings }) {
  return (
    <>
      <Home businessName={settings?.businessName} />
      <Reviews />
      <Services sectionId="services" sectionClass="section services-section" />
      <ContactUs
        sectionId="contact"
        sectionClass="section contact-section"
        phoneNumber={settings?.contactPhone}
        businessEmail={settings?.businessEmail}
        streetAddress={settings?.streetAddress}
        suiteNumber={settings?.suiteNumber}
        city={settings?.city}
        state={settings?.state}
        zipCode={settings?.zipCode}
      />
      <Footer />
    </>
  );
}

function NotFound() {
  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <p className="not-found__eyebrow">Page not found</p>
      <h1 id="not-found-title">We couldn’t find that page.</h1>
      <p>The link may be outdated, or the page may have moved.</p>
      <Link className="not-found__link" to="/">
        Return home
      </Link>
    </section>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    function handleAuthenticationFailure() {
      if (location.pathname !== "/login") {
        navigate("/login", { replace: true, state: { from: location } });
      }
    }

    window.addEventListener("admin-auth-failed", handleAuthenticationFailure);
    return () =>
      window.removeEventListener(
        "admin-auth-failed",
        handleAuthenticationFailure,
      );
  }, [location, navigate]);

  useEffect(() => {
    if (location.pathname === "/admin") return undefined;

    let isCurrent = true;

    async function loadSettings() {
      try {
        const data = await getSettings();
        if (isCurrent) setSettings(data);
      } catch {
        if (isCurrent) setSettings(null);
      }
    }

    loadSettings();

    return () => {
      isCurrent = false;
    };
  }, [location.pathname]);

  const showHeader = location.pathname !== "/admin";

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const behavior = reducedMotion ? "auto" : "smooth";

      if (location.pathname === "/" && location.hash) {
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior, block: "start" });
      } else if (location.pathname === "/" && location.state?.scrollToTop) {
        window.scrollTo({ top: 0, behavior });
      } else if (location.pathname !== "/") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [location.hash, location.pathname, location.state]);

  return (
    <div className="App">
      {showHeader && (
        <Header
          sectionId="home"
          sectionClass="headermain header-section"
          logoUrl={settings?.logoUrl}
          homepageOffer={settings?.homepageOffer}
          homepageOfferLink={settings?.homepageOfferLink}
        />
      )}

      <AnimatePresence mode="sync" initial={false}>
        <PageTransition key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<HomePage settings={settings} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminDashboard onSettingsUpdated={setSettings} />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
