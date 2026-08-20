import { useState } from "react";
import Modal from "../../components/Modal/Modal";
import {
  createService,
  deleteService,
  updateService,
} from "../../api/serviceService";
import {
  serviceCategories,
  serviceCategoryLabels,
} from "../../constants/serviceCategories";
import InlineFormError from "./InlineFormError";
import SectionHeading from "./SectionHeading";
import ModalHeading from "./ModalHeading";
import FormActions from "./FormActions";

function ServicesManager({
  services,
  onSaved,
  onDeleted,
  notify,
  confirmAction,
  findErrorField,
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
      <div className="admin-services__groups">
        {serviceCategories.map((category) => {
          const items = services[category] || [];
          const isOpen = openGroups.has(category);
          return (
            <section className="admin-panel admin-services__group" key={category}>
              <button
                className="admin-services__group-header"
                onClick={() => toggle(category)}
              >
                <span>
                  <b>{serviceCategoryLabels[category] || category}</b>
                  <small>
                    {items.length} {items.length === 1 ? "service" : "services"}
                  </small>
                </span>
                <span>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="admin-services__list">
                  {items.length ? (
                    items.map((item) => (
                      <article className="admin-services__card" key={item._id}>
                        <div className="admin-services__card-title">
                          <h3>{item.name}</h3>
                          <p>${Number(item.price).toFixed(2)}</p>
                        </div>
                        <div className="admin-card-actions">
                          <button onClick={() => setEditor(item)}>Edit</button>
                          <button
                            className="admin-button--danger-text"
                            onClick={() => remove(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="admin-empty-state__copy">
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
          findErrorField={findErrorField}
        />
      )}
    </>
  );
}

function ServiceModal({ service, onClose, onSaved, findErrorField }) {
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

export default ServicesManager;
