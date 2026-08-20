function FormActions({ onClose, saving, label }) {
  return (
    <div className="admin-form__actions">
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

export default FormActions;
