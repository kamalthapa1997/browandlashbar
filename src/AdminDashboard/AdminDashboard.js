import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

const settingsFields = [
  "businessName",
  "contactPhone",
  "businessEmail",
  "streetAddress",
  "suiteNumber",
  "city",
  "state",
  "zipCode",
  "homepageOfferLink",
  "homepageOffer",
];

function toSettingsForm(settings = {}) {
  return Object.fromEntries(
    settingsFields.map((field) => [field, settings[field] || ""]),
  );
}

function findErrorField(message, fieldMatchers) {
  const normalizedMessage = (message || "").toLowerCase();

  return Object.entries(fieldMatchers).find(([, terms]) =>
    terms.some((term) => normalizedMessage.includes(term)),
  )?.[0];
}

function InlineFormError({ message }) {
  return message ? (
    <p className="form-error form-error--inline">{message}</p>
  ) : null;
}

function AdminDashboard({ onSettingsUpdated }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
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
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  function upsertService(service) {
    setServices((current) => {
      const next = Object.fromEntries(
        serviceCategories.map((category) => [
          category,
          (current[category] || []).filter((item) => item._id !== service._id),
        ]),
      );
      next[service.category] = [...next[service.category], service].sort(
        (first, second) =>
          Number(first.price) - Number(second.price) ||
          first.name.localeCompare(second.name),
      );
      return next;
    });
  }

  function removeService(serviceId) {
    setServices((current) =>
      Object.fromEntries(
        serviceCategories.map((category) => [
          category,
          (current[category] || []).filter((item) => item._id !== serviceId),
        ]),
      ),
    );
  }

  function upsertGalleryItem(item) {
    setGallery((current) => {
      const withoutItem = current.filter((entry) => entry._id !== item._id);
      return item.createdAt
        ? [item, ...withoutItem].sort(
            (first, second) =>
              new Date(second.createdAt) - new Date(first.createdAt),
          )
        : [...withoutItem, item];
    });
  }

  function removeGalleryItem(itemId) {
    setGallery((current) => current.filter((item) => item._id !== itemId));
  }

  function applySettings(nextSettings) {
    setSettings(nextSettings);
    onSettingsUpdated?.(nextSettings);
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
          <strong>Admin panel</strong>
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
            {/* <p>Welcome back</p> */}
            <h1>{navItems.find(([id]) => id === activeSection)?.[1]}</h1>
          </div>
          <TopbarToast toast={toast} />
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
                onSaved={upsertService}
                onDeleted={removeService}
                notify={showToast}
                confirmAction={requestConfirmation}
              />
            )}
            {activeSection === "gallery" && (
              <GalleryManager
                gallery={gallery}
                onSaved={upsertGalleryItem}
                onDeleted={removeGalleryItem}
                notify={showToast}
                confirmAction={requestConfirmation}
              />
            )}
            {activeSection === "settings" && (
              <SettingsManager
                settings={settings}
                onSaved={applySettings}
                notify={showToast}
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

function ServicesManager({
  services,
  onSaved,
  onDeleted,
  notify,
  confirmAction,
}) {
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
        onDeleted(item._id);
        notify("Service deleted");
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
          onSaved={(service) => {
            setEditor(null);
            onSaved(service);
            notify("Service saved");
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
  const [errorField, setErrorField] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setErrorField("");
    try {
      const savedService = service._id
        ? await updateService(service._id, form)
        : await createService(form);
      onSaved(savedService);
    } catch (requestError) {
      const message = requestError.message || "Unable to save service.";
      setError(message);
      setErrorField(
        findErrorField(message, {
          name: ["service name", "name"],
          price: ["price"],
          category: ["category"],
        }) || "",
      );
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
        <label>
          Service name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <InlineFormError message={errorField === "name" ? error : ""} />
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
        <InlineFormError message={errorField === "price" ? error : ""} />
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
        <InlineFormError message={errorField === "category" ? error : ""} />
        <FormActions onClose={onClose} saving={saving} label="Save service" />
        <InlineFormError message={!errorField ? error : ""} />
      </form>
    </Modal>
  );
}

function GalleryManager({
  gallery,
  onSaved,
  onDeleted,
  notify,
  confirmAction,
}) {
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
        onDeleted(item._id);
        notify("Gallery image deleted");
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
          onSaved={(galleryItem) => {
            setEditor(null);
            onSaved(galleryItem);
            notify("Gallery updated");
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
  const [errorField, setErrorField] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!item._id && !image) {
      setError("Choose an image to upload.");
      setErrorField("image");
      return;
    }
    setSaving(true);
    setError("");
    setErrorField("");
    const formData = new FormData();
    formData.append("caption", caption);
    if (image) formData.append("image", image);
    try {
      const savedItem = item._id
        ? await updateGalleryItem(item._id, formData)
        : await createGalleryItem(formData);
      onSaved(savedItem);
    } catch (requestError) {
      const message = requestError.message || "Unable to save image.";
      setError(message);
      setErrorField(
        findErrorField(message, {
          caption: ["caption"],
          image: ["image", "jpg", "png", "webp", "upload"],
        }) || "",
      );
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
        <label>
          Caption
          <input
            maxLength="300"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Describe this work"
          />
        </label>
        <InlineFormError message={errorField === "caption" ? error : ""} />
        <FileUpload
          label="Upload image"
          helpText="JPG, PNG, or WEBP image files"
          file={image}
          existingPreview={item.imageUrl}
          onChange={setImage}
          required={!item._id}
        />
        <InlineFormError message={errorField === "image" ? error : ""} />
        <FormActions onClose={onClose} saving={saving} label="Save image" />
        <InlineFormError message={!errorField ? error : ""} />
      </form>
    </Modal>
  );
}

function SettingsManager({ settings, onSaved, notify }) {
  const initialSettingsRef = useRef(toSettingsForm(settings));
  const [form, setForm] = useState(() => toSettingsForm(settings));
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");

  function appendChangedFields(formData) {
    Object.entries(form).forEach(([field, value]) => {
      const initialValue = initialSettingsRef.current[field] || "";
      if (value !== initialValue) formData.append(field, value);
    });
  }

  async function submit(event) {
    event.preventDefault();
    // Client-side validation for homepageOfferLink
    if (form.homepageOfferLink !== undefined) {
      const raw = (form.homepageOfferLink || "").trim();
      if (raw) {
        try {
          const parsed = new URL(raw);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            setError("Offer link must use http or https protocol");
            setErrorField("homepageOfferLink");
            return;
          }
        } catch (e) {
          setError("Offer link must be a valid URL");
          setErrorField("homepageOfferLink");
          return;
        }
      }
    }
    const formData = new FormData();
    appendChangedFields(formData);
    if (logo) formData.append("logo", logo);

    if (![...formData.keys()].length) {
      notify("No changes to save");
      return;
    }

    setSaving(true);
    setError("");
    setErrorField("");
    try {
      const savedSettings = await updateSettings(formData);
      const nextForm = toSettingsForm(savedSettings);
      onSaved(savedSettings);
      initialSettingsRef.current = nextForm;
      setForm(nextForm);
      setLogo(null);
      notify("Settings saved");
    } catch (requestError) {
      const message = requestError.message || "Unable to save settings.";
      setError(message);
      setErrorField(
        findErrorField(message, {
          businessName: ["business name"],
          contactPhone: ["contact phone"],
          businessEmail: ["business email", "email address"],
          streetAddress: ["street address", "streetaddress"],
          suiteNumber: ["suite", "apartment", "suitenumber"],
          city: ["city"],
          state: ["state"],
          zipCode: ["zip", "zipcode"],
          homepageOfferLink: ["homepage", "link", "offer", "book"],
          homepageOffer: ["homepage", "offer", "announcement"],
          logo: ["image", "jpg", "png", "webp", "upload"],
        }) || "",
      );
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
          <InlineFormError
            message={errorField === "businessName" ? error : ""}
          />
          <label>
            Contact phone
            <input
              value={form.contactPhone}
              onChange={(e) =>
                setForm({ ...form, contactPhone: e.target.value })
              }
            />
          </label>
          <InlineFormError
            message={errorField === "contactPhone" ? error : ""}
          />
          <label>
            Business email
            <input
              type="email"
              value={form.businessEmail}
              onChange={(e) =>
                setForm({ ...form, businessEmail: e.target.value })
              }
              placeholder="hello@example.com"
            />
          </label>
          <InlineFormError
            message={errorField === "businessEmail" ? error : ""}
          />
          <label>
            Street address
            <input
              value={form.streetAddress}
              onChange={(e) =>
                setForm({ ...form, streetAddress: e.target.value })
              }
              placeholder="123 Main Street"
            />
          </label>
          <InlineFormError
            message={errorField === "streetAddress" ? error : ""}
          />
          <label>
            Suite / Apt number (optional)
            <input
              value={form.suiteNumber}
              onChange={(e) =>
                setForm({ ...form, suiteNumber: e.target.value })
              }
              placeholder="Suite 205"
            />
          </label>
          <InlineFormError
            message={errorField === "suiteNumber" ? error : ""}
          />
          <label>
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <InlineFormError message={errorField === "city" ? error : ""} />
          <label>
            State
            <input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
          </label>
          <InlineFormError message={errorField === "state" ? error : ""} />
          <label>
            ZIP code
            <input
              inputMode="numeric"
              value={form.zipCode}
              onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
            />
          </label>
          <InlineFormError message={errorField === "zipCode" ? error : ""} />
          <label>
            Offer Book Now Link
            <input
              value={form.homepageOfferLink}
              onChange={(e) =>
                setForm({ ...form, homepageOfferLink: e.target.value })
              }
              placeholder="https://example.com/special-offer"
            />
            <small className="help-text">
              Enter the URL where visitors should be sent when they click Book
              Now. Leave empty to use the default booking link.
            </small>
          </label>
          <InlineFormError
            message={errorField === "homepageOfferLink" ? error : ""}
          />

          <label>
            Homepage Offer
            <textarea
              maxLength="200"
              rows={2}
              value={form.homepageOffer}
              className="adminDashboard__offer-textarea"
              onChange={(e) =>
                setForm({ ...form, homepageOffer: e.target.value })
              }
              placeholder="Enter a short promotional message to display above the navigation bar"
            />
            <small className="help-text">
              Enter a promotional message to display above the navigation bar.
              Leave empty to hide the offer bar.
            </small>
          </label>
          <InlineFormError
            message={errorField === "homepageOffer" ? error : ""}
          />
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
          <InlineFormError message={errorField === "logo" ? error : ""} />
        </section>
        <div className="settings-actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          <InlineFormError message={!errorField ? error : ""} />
        </div>
      </form>
    </>
  );
}

function TopbarToast({ toast }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className={`admin-toast admin-toast--${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
          initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {toast.type === "error" ? "!" : "✓"} {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionHeading({ title, description, action, onAction }) {
  return (
    <header className="section-heading">
      <div>
        {/* <h2>{title}</h2> */}
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
