import { useState } from "react";
import Modal from "./Modal";
import "./ConfirmationModal.css";

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Unable to complete this action.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="480px">
      <section className="confirmation-modal" aria-labelledby="confirmation-title">
        <span className={`confirmation-modal__icon ${destructive ? "confirmation-modal__icon--danger" : ""}`}>
          {destructive ? "!" : "?"}
        </span>
        <h2 id="confirmation-title">{title}</h2>
        <p>{message}</p>
        {error && <p className="confirmation-modal__error" role="alert">{error}</p>}
        <div className="confirmation-modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </button>
          <button type="button" className={`button ${destructive ? "button--danger" : "button--primary"}`} onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </section>
    </Modal>
  );
}

export default ConfirmationModal;
