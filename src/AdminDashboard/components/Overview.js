function Overview({ stats, settings, onSelectSection }) {
  return (
    <>
      <section className="admin-overview__hero">
        <div>
          <p className="admin-overview__eyebrow">Business overview</p>
          <h2>Everything is looking polished.</h2>
          <p>
            Manage your services, gallery, FAQs, and website details from one
            place.
          </p>
        </div>
        <button
          className="button button--primary"
          onClick={() => onSelectSection("services")}
        >
          Manage services
        </button>
      </section>
      <section className="admin-overview__stats">
        {stats.map(([label, value, icon, destination]) => (
          <button
            key={label}
            className="admin-overview__stat"
            onClick={() => onSelectSection(destination)}
          >
            <span className="admin-overview__stat-icon">{icon}</span>
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
            <b>›</b>
          </button>
        ))}
      </section>
      <section className="admin-panel admin-overview__business-card">
        <div>
          <p className="admin-overview__eyebrow">Website identity</p>
          <h2>{settings?.businessName || "Mero Brow & Lash Bar"}</h2>
          <p>{settings?.contactPhone || "Add a contact number in Settings"}</p>
        </div>
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Business logo" />
        ) : (
          <div className="admin-overview__logo-placeholder">MB</div>
        )}
      </section>
    </>
  );
}

export default Overview;
