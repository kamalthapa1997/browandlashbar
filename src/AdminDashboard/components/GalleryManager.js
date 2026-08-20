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

function GalleryManager({
  gallery,
  onSaved,
  onDeleted,
  notify,
  confirmAction,
  findErrorField,
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
      <section className="admin-gallery__grid">
        {gallery.length ? (
          gallery.map((item) => (
            <article className="admin-panel admin-gallery__card" key={item._id}>
              <img src={item.imageUrl} alt={item.caption || "Gallery work"} />
              <div>
                <p>{item.caption || "No caption"}</p>
                <div className="admin-card-actions">
                  <button onClick={() => setEditor(item)}>Edit</button>
                  <button
                    className="admin-button--danger-text"
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="admin-panel admin-empty-state">
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
          findErrorField={findErrorField}
        />
      )}
    </>
  );
}

function GalleryModal({ item, onClose, onSaved, findErrorField }) {
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

export default GalleryManager;
