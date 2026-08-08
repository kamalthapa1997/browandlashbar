import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";
import Header from "./Header/Header.js";
import Services from "./Services/Services";
import ContactUs from "./ContactUs/ContactUs";
import Gallery from "./Gallery/Gallery.js";
import Home from "./Home/Home.js";
import Login from "./Login/Login";
import Footer from "./Footer/Footer";
import AdminDashboard from "./AdminDashboard/AdminDashboard";
import { getSettings } from "./api/settingsService";
import { isAuthenticated } from "./api/authService";

function RequireAuth({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
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

  const isHomePage = location.pathname === "/";
  const showHeader = location.pathname !== "/admin";

  return (
    <div className="App">
      {showHeader && (
        <Header
          sectionId="home"
          sectionClass="headermain header-section"
          logoUrl={settings?.logoUrl}
        />
      )}

      {isHomePage && (
        <>
          <Home businessName={settings?.businessName} />
          <Services
            sectionId="services"
            sectionClass="section services-section"
          />
          <ContactUs
            sectionId="contact"
            sectionClass="section contact-section"
            phoneNumber={settings?.contactPhone}
          />
          <Footer />
        </>
      )}

      <Routes>
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
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
