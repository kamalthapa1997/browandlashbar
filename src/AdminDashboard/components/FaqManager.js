import { useState } from "react";
import Modal from "../../components/Modal/Modal";
import { createFaq, deleteFaq, updateFaq } from "../../api/faqService";
import InlineFormError from "./InlineFormError";
import SectionHeading from "./SectionHeading";
import ModalHeading from "./ModalHeading";
import FormActions from "./FormActions";

const faqCategories = ["General", "Brows", "Lashes", "Waxing", "Appointments"];

function FaqManager({ faqs, onSaved, onDeleted, notify, confirmAction }) {
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const visibleFaqs = faqs.filter((faq) => {
    const matchesSearch = `${faq.question} ${faq.answer}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matchesSearch && (category === "All" || faq.category === category);
  });

  function remove(faq) {
    confirmAction({
      title: "Delete FAQ?",
      message:
        "Are you sure you want to delete this frequently asked question?",
      confirmLabel: "Delete",
      destructive: true,
      action: async () => {
        await deleteFaq(faq._id);
        onDeleted(faq._id);
        notify("FAQ deleted");
      },
    });
  }

  return (
    <>
      <SectionHeading
        title="FAQ Management"
        description="Manage frequently asked questions displayed on your website."
        action="Add FAQ"
        onAction={() => setEditor({ displayOrder: faqs.length })}
      />
      {faqs.length > 0 && (
        <div className="admin-faq__controls">
          <label>
            <span className="sr-only">Search FAQs</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search FAQs"
            />
          </label>
          <label>
            <span className="sr-only">Filter by category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="All">All categories</option>
              {faqCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <section
        className="admin-faq__list"
        aria-label="Frequently asked questions"
      >
        {faqs.length === 0 ? (
          <div className="admin-panel admin-empty-state admin-faq__empty-state">
            <h2>No FAQs yet.</h2>
            <p>
              Add your first frequently asked question to help customers find
              answers quickly.
            </p>
            <button
              className="button button--primary"
              onClick={() => setEditor({ displayOrder: 0 })}
            >
              + Add FAQ
            </button>
          </div>
        ) : visibleFaqs.length ? (
          visibleFaqs.map((faq) => (
            <article className="admin-panel admin-faq__card" key={faq._id}>
              <div className="admin-faq__copy">
                <h2>{faq.question}</h2>
                <p>{faq.answer}</p>
                <div className="admin-faq__meta">
                  <span>{faq.category}</span>
                  <span className={faq.isActive ? "is-active" : "is-inactive"}>
                    {faq.isActive ? "Active" : "Inactive"}
                  </span>
                  <span>Order {faq.displayOrder}</span>
                </div>
              </div>
              <div className="admin-card-actions">
                <button onClick={() => setEditor(faq)}>Edit</button>
                <button
                  className="admin-button--danger-text"
                  onClick={() => remove(faq)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="admin-panel admin-empty-state">
            No FAQs match your search.
          </div>
        )}
      </section>
      {editor && (
        <FaqModal
          faq={editor}
          onClose={() => setEditor(null)}
          onSaved={(faq) => {
            setEditor(null);
            onSaved(faq);
            notify("FAQ saved");
          }}
        />
      )}
    </>
  );
}

function FaqModal({ faq, onClose, onSaved }) {
  const [form, setForm] = useState({
    question: faq.question || "",
    answer: faq.answer || "",
    category: faq.category || "General",
    displayOrder: faq.displayOrder ?? 0,
    isActive: faq.isActive ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      setError("Question and answer are required.");
      return;
    }
    if (
      !Number.isInteger(Number(form.displayOrder)) ||
      Number(form.displayOrder) < 0
    ) {
      setError("Display order must be a non-negative whole number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, displayOrder: Number(form.displayOrder) };
      const savedFaq = faq._id
        ? await updateFaq(faq._id, payload)
        : await createFaq(payload);
      onSaved(savedFaq);
    } catch (requestError) {
      setError(requestError.message || "Unable to save FAQ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} maxWidth="640px">
      <form className="admin-form admin-faq__form" onSubmit={submit}>
        <ModalHeading title={faq._id ? "Edit FAQ" : "Add FAQ"} />
        <label>
          Question
          <input
            required
            maxLength="240"
            value={form.question}
            onChange={(event) =>
              setForm({ ...form, question: event.target.value })
            }
          />
        </label>
        <label>
          Answer
          <textarea
            required
            rows={6}
            maxLength="3000"
            value={form.answer}
            onChange={(event) =>
              setForm({ ...form, answer: event.target.value })
            }
          />
        </label>
        <div className="admin-faq__form-details">
          <label>
            Category
            <select
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              {faqCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Display order
            <input
              required
              min="0"
              step="1"
              type="number"
              value={form.displayOrder}
              onChange={(event) =>
                setForm({ ...form, displayOrder: event.target.value })
              }
            />
          </label>
        </div>
        <label className="admin-faq__form-active">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm({ ...form, isActive: event.target.checked })
            }
          />
          <span>Active — show this FAQ on the public website</span>
        </label>
        <InlineFormError message={error} />
        <FormActions onClose={onClose} saving={saving} label="Save FAQ" />
      </form>
    </Modal>
  );
}

export default FaqManager;
