import { formatDuration, formatPrice } from "../utils/bookingFormatters";

export default function ServiceCard({
  service,
  variation,
  isSelected,
  disabled,
  onToggle,
}) {
  const serviceLabel = variation.name || service.name || "Select service";
  return (
    <button
      type="button"
      className={`booking__service ${isSelected ? "is-selected" : ""}`}
      onClick={() => onToggle({ ...variation, serviceName: service.name })}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Remove" : "Add"} ${serviceLabel}`}
    >
      <span className="booking__service-content">
        <span className="booking__service-name">
          {variation.serviceName || service.name}
        </span>
        <span className="booking__service-meta">
          <span>{formatDuration(variation.durationMs)}</span>
          <span className="booking__service-dot" aria-hidden="true">
            ·
          </span>
          <span>{formatPrice(variation.priceMoney)}</span>
        </span>
      </span>
      <span className="booking__service-action" aria-hidden="true">
        {isSelected ? "✓" : "+"}
      </span>
    </button>
  );
}
