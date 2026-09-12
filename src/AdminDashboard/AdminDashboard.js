import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmationModal from "../components/Modal/ConfirmationModal";
import ServicesManager from "./components/ServicesManager";
import GalleryManager from "./components/GalleryManager";
import FaqManager from "./components/FaqManager";
import SettingsManager from "./components/SettingsManager";
import Overview from "./components/Overview";
import TopbarToast from "./components/TopbarToast";
import useAdminDashboardData from "./hooks/useAdminDashboardData";
import { logoutAdmin } from "../api/authService";
import "../components/Button/Button.css";
import "./AdminDashboard.css";

const navItems = [
  ["overview", "Overview", "⌂"],
  ["services", "Services", "✦"],
  ["gallery", "Gallery", "▧"],
  ["faq", "FAQ", "?"],
  ["settings", "Settings", "⚙"],
];

function findErrorField(message, fieldMatchers) {
  const normalizedMessage = (message || "").toLowerCase();

  return Object.entries(fieldMatchers).find(([, terms]) =>
    terms.some((term) => normalizedMessage.includes(term)),
  )?.[0];
}

function AdminDashboard({ onSettingsUpdated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(
    location.pathname === "/admin/faq" ? "faq" : "overview",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const {
    services,
    gallery,
    faqs,
    settings,
    loading,
    error,
    refresh,
    upsertService,
    removeService,
    upsertGalleryItem,
    removeGalleryItem,
    upsertFaq,
    removeFaq,
    applySettings,
  } = useAdminDashboardData(onSettingsUpdated);

  const serviceList = useMemo(() => Object.values(services).flat(), [services]);

  useEffect(() => {
    setActiveSection(
      location.pathname === "/admin/faq"
        ? "faq"
        : location.state?.adminSection || "overview",
    );
  }, [location.pathname, location.state]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function selectSection(section) {
    setActiveSection(section);
    if (section === "faq" && location.pathname !== "/admin/faq") {
      navigate("/admin/faq");
    } else if (section !== "faq" && location.pathname !== "/admin") {
      navigate("/admin", { state: { adminSection: section } });
    }
    setMenuOpen(false);
  }

  async function performLogout() {
    try {
      await logoutAdmin();
    } finally {
      setConfirmation(null);
    }
    navigate("/", { replace: true });
  }

  function requestConfirmation(config) {
    setConfirmation(config);
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  const stats = [
    ["Services", serviceList.length, "✦", "services"],
    ["Gallery images", gallery.length, "▧", "gallery"],
    ["FAQs", faqs.length, "?", "faq"],
    [
      "Service groups",
      Object.keys(services).filter((key) => services[key]?.length).length,
      "◫",
      "services",
    ],
  ];

  return (
    <div className="admin-dashboard">
      <button
        type="button"
        className="admin-dashboard__menu-button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open navigation"
        aria-controls="admin-navigation"
        aria-expanded={menuOpen}
      >
        ☰
      </button>
      <button
        type="button"
        className="admin-dashboard__mobile-home"
        onClick={() =>
          requestConfirmation({
            title: "Sign out?",

            message: "Are you sure you want to sign out?",

            confirmLabel: "Yes, Sign Out",

            action: performLogout,
          })
        }
        aria-label="Sign out and navigate to homepage"
      >
        <img
          src={settings?.logoUrl || "/mainlogo.png"}
          alt="Mero Brow & Lash Bar"
        />
      </button>
      {menuOpen && (
        <button
          type="button"
          className="admin-dashboard__scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        id="admin-navigation"
        className={`admin-dashboard__sidebar ${
          menuOpen ? "admin-dashboard__sidebar--open" : ""
        }`}
      >
        <div className="admin-dashboard__brand">
          <strong>Admin panel</strong>
        </div>
        <nav aria-label="Dashboard sections">
          {navItems.map(([id, label, icon]) => (
            <button
              type="button"
              key={id}
              onClick={() => selectSection(id)}
              className={activeSection === id ? "is-active" : ""}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          className="admin-dashboard__logout"
          onClick={() =>
            requestConfirmation({
              title: "Sign out?",
              message: "Are you sure you want to sign out?",
              confirmLabel: "Yes, Sign Out",
              action: performLogout,
            })
          }
        >
          <span>↪</span> Sign out
        </button>
      </aside>

      <main className="admin-dashboard__main">
        <header className="admin-dashboard__topbar">
          <div>
            <h1>{navItems.find(([id]) => id === activeSection)?.[1]}</h1>
          </div>
          <TopbarToast toast={toast} />
          <button
            type="button"
            className="admin-dashboard__profile"
            onClick={() =>
              requestConfirmation({
                title: "Sign out?",
                message: "Are you sure you want to sign out?",
                confirmLabel: "Yes, Sign Out",
                action: performLogout,
              })
            }
            title="Sign out"
            aria-label="Sign out"
          >
            MB
          </button>
        </header>
        {error && (
          <div className="admin-error" role="alert">
            {error} <button onClick={refresh}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="admin-loading">Loading your dashboard…</div>
        ) : (
          <div className="admin-dashboard__content" key={activeSection}>
            {activeSection === "overview" && (
              <Overview
                stats={stats}
                settings={settings}
                onSelectSection={selectSection}
              />
            )}
            {activeSection === "services" && (
              <ServicesManager
                services={services}
                onSaved={upsertService}
                onDeleted={removeService}
                notify={showToast}
                confirmAction={requestConfirmation}
                findErrorField={findErrorField}
              />
            )}
            {activeSection === "gallery" && (
              <GalleryManager
                gallery={gallery}
                services={services}
                onSaved={upsertGalleryItem}
                onDeleted={removeGalleryItem}
                notify={showToast}
                confirmAction={requestConfirmation}
                findErrorField={findErrorField}
              />
            )}
            {activeSection === "faq" && (
              <FaqManager
                faqs={faqs}
                onSaved={upsertFaq}
                onDeleted={removeFaq}
                notify={showToast}
                confirmAction={requestConfirmation}
              />
            )}
            {activeSection === "settings" && (
              <SettingsManager
                settings={settings}
                onSaved={applySettings}
                notify={showToast}
                findErrorField={findErrorField}
              />
            )}
          </div>
        )}
        <ConfirmationModal
          isOpen={Boolean(confirmation)}
          onClose={() => setConfirmation(null)}
          onConfirm={() => confirmation?.action()}
          title={confirmation?.title || "Confirm action"}
          message={confirmation?.message || ""}
          confirmLabel={confirmation?.confirmLabel}
          cancelLabel="Cancel"
          destructive={confirmation?.destructive}
        />
      </main>
    </div>
  );
}

export default AdminDashboard;
