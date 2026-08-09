import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal/Modal";
import ConfirmationModal from "../components/Modal/ConfirmationModal";
import FileUpload from "../components/FileUpload/FileUpload";
import { logoutAdmin } from "../api/authService";
import {
  createService,
  deleteService,
  getServices,
  updateService,
} from "../api/serviceService";
import {
  createGalleryItem,
  deleteGalleryItem,
  getGallery,
  updateGalleryItem,
} from "../api/galleryService";
import { getSettings, updateSettings } from "../api/settingsService";
import {
  serviceCategories,
  serviceCategoryLabels,
} from "../constants/serviceCategories";
import "./AdminDashboard.css";

const navItems = [
  ["overview", "Overview", "⌂"],
  ["services", "Services", "✦"],
  ["gallery", "Gallery", "▧"],
  ["settings", "Settings", "⚙"],
];

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const serviceList = useMemo(() => Object.values(services).flat(), [services]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [nextServices, nextGallery, nextSettings] = await Promise.all([
        getServices(),
        getGallery(),
        getSettings(),
      ]);
      setServices(nextServices || {});
      setGallery(Array.isArray(nextGallery) ? nextGallery : []);
      setSettings(nextSettings || {});
    } catch (requestError) {
      setError(requestError.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function selectSection(section) {
    setActiveSection(section);
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

  const stats = [
    ["Services", serviceList.length, "✦", "services"],
    ["Gallery images", gallery.length, "▧", "gallery"],
    [
      "Service groups",
      Object.keys(services).filter((key) => services[key]?.length).length,
      "◫",
      "services",
    ],
  ];

  return (
    <div className="admin-shell">
      <button
        className="admin-menu-button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open navigation"
      >
        ☰
      </button>
      <button
        className="admin-mobile-home"
        onClick={() => navigate("/admin")}
        aria-label="Go to website home"
      >
        <img
          src={settings?.logoUrl || "/mainlogo.png"}
          alt="Mero Brow & Lash Bar"
        />
      </button>
      {menuOpen && (
        <button
          className="admin-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={`admin-sidebar ${menuOpen ? "admin-sidebar--open" : ""}`}
      >
        <div className="admin-brand">
          <span>MB</span>
          <div>
            <strong>Mero Brow</strong>
            <small>Admin panel</small>
          </div>
        </div>
        <nav aria-label="Dashboard sections">
          {navItems.map(([id, label, icon]) => (
            <button
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
          className="admin-logout"
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

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>Welcome back</p>
            <h1>{navItems.find(([id]) => id === activeSection)?.[1]}</h1>
          </div>
          <button
            className="admin-profile"
            onClick={() =>
              requestConfirmation({
                title: "Sign out?",
                message: "Are you sure you want to sign out?",
                confirmLabel: "Yes, Sign Out",
                action: performLogout,
              })
            }
            title="Sign out"
          >
            MB
          </button>
        </header>
        {notice && (
          <div className="admin-notice" role="status">
            ✓ {notice}
          </div>
        )}
        {error && (
          <div className="admin-error" role="alert">
            {error} <button onClick={refresh}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="admin-loading">Loading your dashboard…</div>
        ) : (
          <div className="admin-content" key={activeSection}>
            {activeSection === "overview" && (
              <Overview
                stats={stats}
                selectSection={selectSection}
                settings={settings}
              />
            )}
            {activeSection === "services" && (
              <ServicesManager
                services={services}
                onChange={refresh}
                notify={setNotice}
                confirmAction={requestConfirmation}
              />
            )}
            {activeSection === "gallery" && (
              <GalleryManager
                gallery={gallery}
                onChange={refresh}
                notify={setNotice}
                confirmAction={requestConfirmation}
              />
            )}
            {activeSection === "settings" && (
              <SettingsManager
                settings={settings}
                onChange={refresh}
                notify={setNotice}
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

function Overview({ stats, selectSection, settings }) {
  return (
    <>
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Business overview</p>
          <h2>Everything is looking polished.</h2>
          <p>
            Manage your services, gallery, and website details from one place.
          </p>
        </div>
        <button
          className="button button--primary"
          onClick={() => selectSection("services")}
        >
          Manage services
        </button>
      </section>
      <section className="stat-grid">
        {stats.map(([label, value, icon, destination]) => (
          <button
            key={label}
            className="stat-card"
            onClick={() => selectSection(destination)}
          >
            <span className="stat-card__icon">{icon}</span>
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
            <b>›</b>
          </button>
        ))}
      </section>
      <section className="admin-panel admin-business-card">
        <div>
          <p className="admin-eyebrow">Website identity</p>
          <h2>{settings?.businessName || "Mero Brow & Lash Bar"}</h2>
          <p>{settings?.contactPhone || "Add a contact number in Settings"}</p>
        </div>
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Business logo" />
        ) : (
          <div className="logo-placeholder">MB</div>
        )}
      </section>
    </>
  );
}

function ServicesManager({ services, onChange, notify, confirmAction }) {
  const [editor, setEditor] = useState(null);
  const [openGroups, setOpenGroups] = useState(
    () => new Set(serviceCategories),
  );
  function remove(item) {
    confirmAction({
      title: "Delete service?",
      message: `Are you sure you want to delete ${item.name}? This cannot be undone.`,
      confirmLabel: "Yes, Delete",
      destructive: true,
      action: async () => {
        await deleteService(item._id);
        notify("Service deleted");
        await onChange();
      },
    });
  }
  function toggle(category) {
    setOpenGroups((current) => {
      const next = new Set(current);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  }
  return (
    <>
      <SectionHeading
        title="Services"
        description="Keep your menu and pricing up to date."
        action="Add service"
        onAction={() => setEditor({})}
      />
      <div className="manager-groups">
        {serviceCategories.map((category) => {
          const items = services[category] || [];
          const isOpen = openGroups.has(category);
          return (
            <section className="admin-panel service-group" key={category}>
              <button className="group-header" onClick={() => toggle(category)}>
                <span>
                  <b>{serviceCategoryLabels[category] || category}</b>
                  <small>
                    {items.length} {items.length === 1 ? "service" : "services"}
                  </small>
                </span>
                <span>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="service-list">
                  {items.length ? (
                    items.map((item) => (
                      <article className="service-card" key={item._id}>
                        <div className="service-cardtitle">
                          <h3>{item.name}</h3>
                          <p>${Number(item.price).toFixed(2)}</p>
                        </div>
                        <div className="card-actions">
                          <button onClick={() => setEditor(item)}>Edit</button>
                          <button
                            className="button--danger-text"
                            onClick={() => remove(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="empty-copy">
                      No services in this category yet.
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {editor && (
        <ServiceModal
          service={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            notify("Service saved");
            onChange();
          }}
        />
      )}
    </>
  );
}

function ServiceModal({ service, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: service.name || "",
    price: service.price || "",
    category: service.category || serviceCategories[0],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      service._id
        ? await updateService(service._id, form)
        : await createService(form);
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal isOpen onClose={onClose} maxWidth="560px">
      <form className="admin-form" onSubmit={submit}>
        <ModalHeading
          title={service._id ? "Edit service" : "Add service"}
          onClose={onClose}
        />
        {error && <p className="form-error">{error}</p>}
        <label>
          Service name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Price
          <input
            required
            min="0"
            step="0.01"
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </label>
        <label>
          Category
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {serviceCategories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <FormActions onClose={onClose} saving={saving} label="Save service" />
      </form>
    </Modal>
  );
}

function GalleryManager({ gallery, onChange, notify, confirmAction }) {
  const [editor, setEditor] = useState(null);
  function remove(item) {
    confirmAction({
      title: "Delete image?",
      message:
        "Are you sure you want to delete this image? This cannot be undone.",
      confirmLabel: "Yes, Delete",
      destructive: true,
      action: async () => {
        await deleteGalleryItem(item._id);
        notify("Gallery image deleted");
        await onChange();
      },
    });
  }
  return (
    <>
      <SectionHeading
        title="Gallery"
        description="Showcase your latest work."
        action="Upload image"
        onAction={() => setEditor({})}
      />
      <section className="gallery-manager-grid">
        {gallery.length ? (
          gallery.map((item) => (
            <article className="admin-panel gallery-admin-card" key={item._id}>
              <img src={item.imageUrl} alt={item.caption || "Gallery work"} />
              <div>
                <p>{item.caption || "No caption"}</p>
                <div className="card-actions">
                  <button onClick={() => setEditor(item)}>Edit</button>
                  <button
                    className="button--danger-text"
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="admin-panel empty-state">
            No gallery images yet. Upload your first image to get started.
          </div>
        )}
      </section>
      {editor && (
        <GalleryModal
          item={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            notify("Gallery updated");
            onChange();
          }}
        />
      )}
    </>
  );
}

function GalleryModal({ item, onClose, onSaved }) {
  const [caption, setCaption] = useState(item.caption || "");
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!item._id && !image) {
      setError("Choose an image to upload.");
      return;
    }
    setSaving(true);
    setError("");
    const formData = new FormData();
    formData.append("caption", caption);
    if (image) formData.append("image", image);
    try {
      item._id
        ? await updateGalleryItem(item._id, formData)
        : await createGalleryItem(formData);
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal isOpen onClose={onClose} maxWidth="560px">
      <form className="admin-form" onSubmit={submit}>
        <ModalHeading
          title={item._id ? "Edit gallery image" : "Upload gallery image"}
          onClose={onClose}
        />
        {error && <p className="form-error">{error}</p>}
        <label>
          Caption
          <input
            maxLength="300"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe this work"
          />
        </label>
        <FileUpload
          label="Upload image"
          helpText="JPG, PNG, or WEBP image files"
          file={image}
          existingPreview={item.imageUrl}
          onChange={setImage}
          required={!item._id}
        />
        <FormActions onClose={onClose} saving={saving} label="Save image" />
      </form>
    </Modal>
  );
}

function SettingsManager({ settings, onChange, notify }) {
  const [form, setForm] = useState({
    businessName: settings?.businessName || "",
    contactPhone: settings?.contactPhone || "",
  });
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData();
    formData.append("businessName", form.businessName);
    formData.append("contactPhone", form.contactPhone);
    if (logo) formData.append("logo", logo);
    try {
      await updateSettings(formData);
      notify("Website settings saved");
      onChange();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <SectionHeading
        title="Website settings"
        description="Update the details shown on your public website."
      />
      <form className="settings-grid" onSubmit={submit}>
        {error && <p className="form-error">{error}</p>}
        <section className="admin-panel settings-card">
          <h2>Business details</h2>
          <label>
            Business name
            <input
              required
              value={form.businessName}
              onChange={(e) =>
                setForm({ ...form, businessName: e.target.value })
              }
            />
          </label>
          <label>
            Contact phone
            <input
              required
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
            />
          </label>
          <button className="button button--primary" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </section>
        <section className="admin-panel settings-card">
          <h2>Brand logo</h2>
          <FileUpload
            label="Upload logo"
            helpText="JPG, PNG, or WEBP image files"
            file={logo}
            existingPreview={settings?.logoUrl}
            onChange={setLogo}
          />
          <button className="button button--primary" disabled={saving}>
            {saving ? "Saving…" : "Save Logo"}
          </button>
        </section>
      </form>
    </>
  );
}

function SectionHeading({ title, description, action, onAction }) {
  return (
    <header className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && (
        <button className="button button--primary" onClick={onAction}>
          + {action}
        </button>
      )}
    </header>
  );
}
function ModalHeading({ title }) {
  return (
    <div className="modal-heading">
      <h2>{title}</h2>
    </div>
  );
}
function FormActions({ onClose, saving, label }) {
  return (
    <div className="form-actions">
      <button
        type="button"
        className="button button--secondary"
        onClick={onClose}
      >
        Cancel
      </button>
      <button className="button button--primary" disabled={saving}>
        {saving ? "Saving…" : label}
      </button>
    </div>
  );
}

export default AdminDashboard;
