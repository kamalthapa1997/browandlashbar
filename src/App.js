import {
  // BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import "./App.css";
import Header from "./Header/Header.js";
import Services from "./Services/Services";
import ContactUs from "./ContactUs/ContactUs";
import Gallery from "./Gallery/Gallery.js";
import Home from "./Home/Home.js";

function AppContent() {
  const location = useLocation();

  const isHomePage = location.pathname === "/";
  console.log(isHomePage);

  return (
    <div className="App">
      <Header sectionId="home" sectionClass="headermain header-section" />

      {isHomePage && (
        <>
          <Home />
          <Services
            sectionId="services"
            sectionClass="section services-section"
          />
          <ContactUs
            sectionId="contact"
            sectionClass="section contact-section"
          />
        </>
      )}

      <Routes>
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
