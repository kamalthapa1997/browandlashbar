import { useRef, useState } from "react";
import FileUpload from "../../components/FileUpload/FileUpload";
import { updateSettings } from "../../api/settingsService";
import InlineFormError from "./InlineFormError";
import SectionHeading from "./SectionHeading";

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

const gallerySettingsDefaults = {
  galleryEyebrow: "OUR PORTFOLIO",
  galleryTitle: "Beauty in every detail",
  galleryDescription: "Explore our latest lash and brow work.",
};

function toSettingsForm(settings = {}) {
  const form = Object.fromEntries(
    settingsFields.map((field) => [field, settings[field] || ""]),
  );

  return {
    ...form,
    galleryEyebrow:
      settings.gallery?.eyebrow ?? gallerySettingsDefaults.galleryEyebrow,
    galleryTitle: settings.gallery?.title ?? gallerySettingsDefaults.galleryTitle,
    galleryDescription:
      settings.gallery?.description ?? gallerySettingsDefaults.galleryDescription,
  };
}

function SettingsManager({ settings, onSaved, notify, findErrorField }) {
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
          galleryEyebrow: ["gallery", "eyebrow"],
          galleryTitle: ["gallery", "title"],
          galleryDescription: ["gallery", "description"],
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
      <form className="admin-settings__grid" onSubmit={submit}>
        <section className="admin-panel admin-settings__card">
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
              className="admin-settings__offer-textarea"
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
        <section className="admin-panel admin-settings__card">
          <h2>Gallery settings</h2>
          <p className="admin-settings__intro">
            These details appear at the top of your public portfolio.
          </p>
          <label>
            Gallery eyebrow
            <input
              maxLength="80"
              value={form.galleryEyebrow}
              onChange={(e) =>
                setForm({ ...form, galleryEyebrow: e.target.value })
              }
              placeholder="OUR PORTFOLIO"
            />
          </label>
          <InlineFormError
            message={errorField === "galleryEyebrow" ? error : ""}
          />
          <label>
            Gallery title
            <input
              maxLength="160"
              value={form.galleryTitle}
              onChange={(e) =>
                setForm({ ...form, galleryTitle: e.target.value })
              }
              placeholder="Beauty in every detail"
            />
          </label>
          <InlineFormError
            message={errorField === "galleryTitle" ? error : ""}
          />
          <label>
            Gallery description
            <textarea
              maxLength="360"
              rows={3}
              value={form.galleryDescription}
              className="admin-settings__offer-textarea"
              onChange={(e) =>
                setForm({ ...form, galleryDescription: e.target.value })
              }
              placeholder="Explore our latest lash and brow work."
            />
          </label>
          <InlineFormError
            message={errorField === "galleryDescription" ? error : ""}
          />
        </section>
        <section className="admin-panel admin-settings__card">
          <h2>Brand logo</h2>
          <FileUpload
            label="Upload logo"
            helpText="JPG, PNG, WEBP, HEIC, or HEIF image files"
            file={logo}
            existingPreview={settings?.logoUrl}
            onChange={setLogo}
          />
          <InlineFormError message={errorField === "logo" ? error : ""} />
        </section>
        <div className="admin-settings__actions">
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

export default SettingsManager;
