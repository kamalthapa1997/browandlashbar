import { useState } from "react";
import Modal from "../../components/Modal/Modal";
import FileUpload from "../../components/FileUpload/FileUpload";
import {
  createGalleryItem,
  deleteGalleryItem,
  updateGalleryItem,
} from "../../api/galleryService";
import InlineFormError from "./InlineFormError";
import SectionHeading from "./SectionHeading";
import ModalHeading from "./ModalHeading";
import FormActions from "./FormActions";
import {
  getGalleryCategoryLabel,
  getGalleryCategoryOptions,
} from "../../utils/galleryCategoryOptions";

function GalleryManager({
  gallery,
  services,
  onSaved,
  onDeleted,
  notify,
  confirmAction,
  findErrorField,
}) {
  const [editor, setEditor] = useState(null);
  const categoryOptions = getGalleryCategoryOptions(services);

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
        description="Manage the work featured in your public portfolio."
        action="Upload image"
        onAction={() => setEditor({})}
      />
      <section className="admin-gallery__grid">
        {gallery.length ? (
          gallery.map((item) => {
            const visible = item.active !== false;
            return (
              <article className="admin-panel admin-gallery__card" key={item._id}>
                <div className="admin-gallery__image-wrap">
                  <img
                    src={item.imageUrl}
                    alt={getGalleryCategoryLabel(item.category, categoryOptions)}
                  />
                  {item.featured && (
                    <span className="admin-gallery__featured" aria-label="Featured image">
                      ★ Featured
                    </span>
                  )}
                </div>
                <div className="admin-gallery__content">
                  {item.caption && <h2>{item.caption}</h2>}
                  <div className="admin-gallery__meta">
                    <span>{getGalleryCategoryLabel(item.category, categoryOptions)}</span>
                    <span className={visible ? "is-active" : "is-inactive"}>
                      {visible ? "Visible" : "Hidden"}
                    </span>
                    <span>Order {Number.isFinite(Number(item.displayOrder)) ? item.displayOrder : 0}</span>
                  </div>
                  <div className="admin-card-actions">
                    <button type="button" onClick={() => setEditor(item)}>Edit</button>
                    <button
                      type="button"
                      className="admin-button--danger-text"
                      onClick={() => remove(item)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="admin-panel admin-empty-state">
            No gallery images yet. Upload your first image to get started.
          </div>
        )}
      </section>
      {editor && (
        <GalleryModal
          item={editor}
          categoryOptions={categoryOptions}
          onClose={() => setEditor(null)}
          onSaved={(galleryItem) => {
            setEditor(null);
            onSaved(galleryItem);
            notify("Gallery updated");
          }}
          findErrorField={findErrorField}
        />
      )}
    </>
  );
}

function GalleryModal({ item, categoryOptions, onClose, onSaved, findErrorField }) {
  const [caption, setCaption] = useState(item.caption || "");
  const [category, setCategory] = useState(
    item.category || categoryOptions[0]?.value || "",
  );
  const [featured, setFeatured] = useState(Boolean(item.featured));
  const [displayOrder, setDisplayOrder] = useState(item.displayOrder ?? 0);
  const [active, setActive] = useState(item.active !== false);
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
    if (category) formData.append("category", category);
    formData.append("featured", String(featured));
    formData.append("displayOrder", String(displayOrder));
    formData.append("active", String(active));
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
          category: ["category"],
          featured: ["featured"],
          displayOrder: ["display order"],
          active: ["active"],
          image: ["image", "jpg", "png", "webp", "upload"],
        }) || "",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} maxWidth="560px">
      <form className="admin-form admin-gallery__form" onSubmit={submit}>
        <ModalHeading
          title={item._id ? "Edit gallery image" : "Upload gallery image"}
          onClose={onClose}
        />
        <FileUpload
          label="Upload image"
          helpText="JPG, PNG, WEBP, HEIC, or HEIF image files"
          file={image}
          existingPreview={item.imageUrl}
          onChange={setImage}
          required={!item._id}
        />
        <InlineFormError message={errorField === "image" ? error : ""} />
        <label>
          Caption
          <input
            maxLength="300"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Wispy Volume Set"
          />
        </label>
        <InlineFormError message={errorField === "caption" ? error : ""} />
        <div className="admin-gallery__form-details">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {!categoryOptions.some((option) => option.value === category) && category && (
                <option value={category}>
                  {getGalleryCategoryLabel(category, categoryOptions)} (legacy)
                </option>
              )}
              {categoryOptions.map((option) => (
                <option value={option.value} key={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Display order
            <input
              type="number"
              step="1"
              value={displayOrder}
              onChange={(event) => setDisplayOrder(event.target.value)}
            />
          </label>
        </div>
        <InlineFormError message={errorField === "category" || errorField === "displayOrder" ? error : ""} />
        <div className="admin-gallery__toggles">
          <label className="admin-gallery__toggle">
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => setFeatured(event.target.checked)}
              disabled={!active}
            />
            <span>
              Set as featured image
              <small>Only one active gallery image can be featured.</small>
            </span>
          </label>
          <label className="admin-gallery__toggle">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            <span>
              Visible on website
              <small>Hidden images stay available here for later use.</small>
            </span>
          </label>
        </div>
        <InlineFormError message={errorField === "featured" || errorField === "active" ? error : ""} />
        <FormActions onClose={onClose} saving={saving} label="Save image" />
        <InlineFormError message={!errorField ? error : ""} />
      </form>
    </Modal>
  );
}

export default GalleryManager;
