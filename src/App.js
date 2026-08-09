import {
  Routes,
  Route,
  useLocation,
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
import Login from "./Login/Login";
import Footer from "./Footer/Footer";
import AdminDashboard from "./AdminDashboard/AdminDashboard";
import PageTransition from "./components/PageTransition/PageTransition";
import { getSettings } from "./api/settingsService";
import { isAuthenticated } from "./api/authService";

function RequireAuth({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function HomePage({ settings }) {
  return (
    <>
      <Home businessName={settings?.businessName} />
      <Services sectionId="services" sectionClass="section services-section" />
      <ContactUs
        sectionId="contact"
        sectionClass="section contact-section"
        phoneNumber={settings?.contactPhone}
      />
      <Footer />
    </>
  );
}

function AppContent() {
  const location = useLocation();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getSettings();
        setSettings(data);
      } catch {
        setSettings(null);
      }
    }

    loadSettings();
  }, []);

  const showHeader = location.pathname !== "/admin";

  useEffect(() => {
    if (location.pathname !== "/") return;

    const frame = requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const behavior = reducedMotion ? "auto" : "smooth";

      if (location.hash) {
        document
          .getElementById(location.hash.slice(1))
          ?.scrollIntoView({ behavior, block: "start" });
      } else if (location.state?.scrollToTop) {
        window.scrollTo({ top: 0, behavior });
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
        />
      )}

      <AnimatePresence mode="wait" initial={false}>
        <PageTransition key={location.pathname}>
          <Routes location={location}>
            <Route path="/" element={<HomePage settings={settings} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
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
