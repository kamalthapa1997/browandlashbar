import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal/Modal";
import FileUpload from "../../components/FileUpload/FileUpload";
import {
  createGalleryCategory,
  createGalleryItem,
  deleteGalleryCategory,
  deleteGalleryItem,
  getGalleryCategories,
  updateGalleryItem,
} from "../../api/galleryService";
import InlineFormError from "./InlineFormError";
import SectionHeading from "./SectionHeading";
import ModalHeading from "./ModalHeading";
import FormActions from "./FormActions";
import { getGalleryCategoryLabel } from "../../utils/galleryCategoryOptions";

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13" />
    </svg>
  );
}

function GalleryManager({
  gallery,
  onSaved,
  onDeleted,
  notify,
  confirmAction,
  findErrorField,
}) {
  const [editor, setEditor] = useState(null);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError("");
    try {
      const categories = await getGalleryCategories();
      const nextCategories = Array.isArray(categories) ? categories : [];
      setCategoryOptions(nextCategories);
      return nextCategories;
    } catch (requestError) {
      setCategoriesError(
        requestError.message || "Unable to load gallery categories.",
      );
      setCategoryOptions([]);
      return [];
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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
              <article
                className="admin-panel admin-gallery__card"
                key={item._id}
              >
                <div className="admin-gallery__image-wrap">
                  <img
                    src={item.imageUrl}
                    alt={getGalleryCategoryLabel(
                      item.category,
                      categoryOptions,
                    )}
                  />
                  {item.featured && (
                    <span
                      className="admin-gallery__featured"
                      aria-label="Featured image"
                    >
                      ★ Featured
                    </span>
                  )}
                </div>
                <div className="admin-gallery__content">
                  {item.caption && <h2>{item.caption}</h2>}
                  <div className="admin-gallery__meta">
                    <span>
                      {getGalleryCategoryLabel(item.category, categoryOptions)}
                    </span>
                    <span className={visible ? "is-active" : "is-inactive"}>
                      {visible ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <div className="admin-card-actions">
                    <button type="button" onClick={() => setEditor(item)}>
                      Edit
                    </button>
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
          categoriesLoading={categoriesLoading}
          categoriesError={categoriesError}
          loadCategories={loadCategories}
          confirmAction={confirmAction}
          notify={notify}
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

export function GalleryCategoryField({
  value,
  options,
  loading,
  loadError,
  onChange,
  onCategoriesChanged,
  confirmAction,
  notify,
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  async function handleCreateCategory(event) {
    event.preventDefault();
    if (creating || creatingRef.current) return;

    const normalizedLabel = label.trim();
    if (!normalizedLabel) {
      setError("Enter a category name.");
      return;
    }
    if (normalizedLabel.length > 80) {
      setError("Category name must be 80 characters or fewer.");
      return;
    }

    creatingRef.current = true;
    setCreating(true);
    setError("");
    try {
      const created = await createGalleryCategory(normalizedLabel);
      await onCategoriesChanged();
      onChange(created.value);
      setLabel("");
      setAdding(false);
      notify("Gallery category created");
    } catch (requestError) {
      setError(requestError.message || "Unable to create gallery category.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  function requestDelete(category) {
    confirmAction({
      title: "Delete category?",
      message: `Are you sure you want to delete the “${category.label}” gallery category? Categories currently used by gallery images cannot be deleted.`,
      confirmLabel: "Delete category",
      destructive: true,
      action: async () => {
        setDeletingId(category.id);
        setError("");
        try {
          await deleteGalleryCategory(category.id);
          const nextCategories = await onCategoriesChanged();
          if (value === category.value)
            onChange(nextCategories[0]?.value || "");
          notify("Gallery category deleted");
        } catch (requestError) {
          setError(
            requestError.message || "Unable to delete gallery category.",
          );
        } finally {
          setDeletingId("");
        }
      },
    });
  }

  const hasLegacyValue =
    value && !options.some((option) => option.value === value);
  return (
    <section
      className="admin-gallery__category-field"
      aria-describedby="gallery-category-help"
    >
      <label>
        Category
        <select
          className="admin-gallery__category-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={loading}
        >
          {loading ? (
            <option value={value || ""}>Loading categories…</option>
          ) : (
            <>
              {!value && <option value="">Select a category</option>}
              {hasLegacyValue && (
                <option value={value}>
                  {getGalleryCategoryLabel(value, options)} (legacy)
                </option>
              )}
              {options.map((option) => (
                <option value={option.value} key={option.id || option.value}>
                  {option.label}
                </option>
              ))}
              {!options.length && !hasLegacyValue && (
                <option value="">No categories available</option>
              )}
            </>
          )}
        </select>
      </label>
      <small id="gallery-category-help">
        Choose a category or manage the gallery taxonomy below.
      </small>
      {(loadError || error) && (
        <p className="admin-gallery__category-error" role="alert">
          {loadError || error}
        </p>
      )}
      <div className="admin-gallery__category-management">
        <p>Manage categories</p>
        {loading ? (
          <div className="admin-gallery__category-status" role="status">
            Loading categories…
          </div>
        ) : options.length ? (
          <ul className="admin-gallery__category-list">
            {options.map((option) => (
              <li
                className="admin-gallery__category-item"
                key={option.id || option.value}
              >
                <span className="admin-gallery__category-name">
                  {option.label}
                </span>
                <button
                  type="button"
                  className="admin-gallery__category-delete"
                  aria-label={`Delete ${option.label} category`}
                  title={`Delete ${option.label}`}
                  disabled={deletingId === option.id}
                  aria-busy={deletingId === option.id}
                  onClick={() => requestDelete(option)}
                >
                  {deletingId === option.id ? (
                    <span className="admin-gallery__category-spinner" aria-hidden="true" />
                  ) : (
                    <TrashIcon />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-gallery__category-status">
            No categories yet. Add your first category below.
          </div>
        )}
        {adding ? (
          <div className="admin-gallery__category-add-form">
            <label htmlFor="new-gallery-category">
              New category name
              <input
                id="new-gallery-category"
                autoFocus
                maxLength="80"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleCreateCategory(event);
                }}
                placeholder="Facials"
                disabled={creating}
              />
            </label>
            <div>
              <button
                type="button"
                className={`admin-gallery__category-create${creating ? " is-loading" : ""}`}
                disabled={creating}
                aria-busy={creating}
                onClick={handleCreateCategory}
              >
                {creating && (
                  <span className="admin-gallery__category-spinner" aria-hidden="true" />
                )}
                {creating ? "Creating category…" : "Create category"}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="admin-gallery__category-add"
            onClick={() => setAdding(true)}
          >
            <span aria-hidden="true">+</span> Add new category
          </button>
        )}
      </div>
    </section>
  );
}

function GalleryModal({
  item,
  categoryOptions,
  categoriesLoading,
  categoriesError,
  loadCategories,
  confirmAction,
  notify,
  onClose,
  onSaved,
  findErrorField,
}) {
  const [caption, setCaption] = useState(item.caption || "");
  const [category, setCategory] = useState(item.category || "");
  const [featured, setFeatured] = useState(Boolean(item.featured));
  const [active, setActive] = useState(item.active !== false);
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [saving, setSaving] = useState(false);
  const categoryIsAvailable = categoryOptions.some(
    (option) => option.value === category,
  );
  const isLegacyCategory = Boolean(
    item._id && category && category === item.category && !categoryIsAvailable,
  );

  useEffect(() => {
    if (!item._id && !category && categoryOptions.length) {
      setCategory(categoryOptions[0].value);
    }
  }, [category, categoryOptions, item._id]);

  async function submit(event) {
    event.preventDefault();
    if (!item._id && !image) {
      setError("Choose an image to upload.");
      setErrorField("image");
      return;
    }
    if (!category || (!categoryIsAvailable && !isLegacyCategory)) {
      setError("Choose a valid gallery category before saving.");
      setErrorField("category");
      return;
    }
    setSaving(true);
    setError("");
    setErrorField("");
    const formData = new FormData();
    formData.append("caption", caption);
    formData.append("category", category);
    formData.append("featured", String(featured));
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
        <GalleryCategoryField
          value={category}
          options={categoryOptions}
          loading={categoriesLoading}
          loadError={categoriesError}
          onChange={setCategory}
          onCategoriesChanged={loadCategories}
          confirmAction={confirmAction}
          notify={notify}
        />
        <InlineFormError message={errorField === "category" ? error : ""} />
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
        <InlineFormError
          message={
            errorField === "featured" || errorField === "active" ? error : ""
          }
        />
        <FormActions onClose={onClose} saving={saving} label="Save image" />
        <InlineFormError message={!errorField ? error : ""} />
      </form>
    </Modal>
  );
}

export default GalleryManager;
