import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  Navigate,
} from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import "./App.css";
import Header from "./Header/Header.js";
import Services from "./Services/Services";
import ContactUs from "./ContactUs/ContactUs";
import Gallery from "./Gallery/Gallery.js";
import Home from "./Home/Home.js";
import BookingCart from "./Home/BookingCart";
import Reviews from "./Reviews/Reviews";
import Login from "./Login/Login";
import Booking from "./Booking/Booking";
import Footer from "./Footer/Footer";
import Faq from "./components/FAQ/Faq";
import AdminDashboard from "./AdminDashboard/AdminDashboard";
import PageTransition from "./components/PageTransition/PageTransition";
import { SettingsProvider, useSettings } from "./contexts/SettingsContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

function RequireAuth({ children }) {
  const location = useLocation();
  const { isChecking, isAuthenticated } = useAuth();

  if (isChecking) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

function HomePage() {
  return (
    <>
      <Home />
      <Reviews />
      <Services sectionId="services" sectionClass="section services-section" />
      <ContactUs
        sectionId="contact"
        sectionClass="section contact-section"
      />
      <Faq />
      <Footer />
      <BookingCart />
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
  const { setSettings } = useSettings();

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

  const showHeader = !location.pathname.startsWith("/admin");
  const pageTransitionKey = location.pathname.startsWith("/admin")
    ? "/admin"
    : location.pathname;

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
        />
      )}

      <AnimatePresence mode="sync" initial={false}>
        <PageTransition key={pageTransitionKey}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/login"
              element={
                <AuthProvider checkSession={false}>
                  <Login />
                </AuthProvider>
              }
            />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/book" element={<Booking />} />
            <Route
              path="/admin/*"
              element={
                <AuthProvider>
                  <RequireAuth>
                    <AdminDashboard onSettingsUpdated={setSettings} />
                  </RequireAuth>
                </AuthProvider>
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
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
