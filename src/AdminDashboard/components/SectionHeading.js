function SectionHeading({ title, description, action, onAction }) {
  return (
    <header className="admin-section-heading">
      <div>
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

export default SectionHeading;
