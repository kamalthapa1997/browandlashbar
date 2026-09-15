import { formatDuration, formatPrice } from "../utils/bookingFormatters";
import { formatServiceIdentity } from "../utils/serviceIdentity";

export default function ServiceCard({
  service,
  variation,
  isSelected,
  disabled,
  onToggle,
}) {
  const hasVariationChoice = (service.variations?.length || 0) > 1;
  const serviceLabel = formatServiceIdentity(
    service.name || variation.serviceName,
    variation.name,
    hasVariationChoice,
  );

  return (
    <button
      type="button"
      className={`booking__service ${isSelected ? "is-selected" : ""}`}
      onClick={() =>
        onToggle({
          ...variation,
          serviceName: service.name,
          hasVariationChoice,
          displayName: serviceLabel,
        })
      }
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`${isSelected ? "Deselect" : "Add"} ${serviceLabel}`}
    >
      <span className="booking__service-content">
        <span className="booking__service-name">
          {serviceLabel}
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
