import {
  formatAppointmentDate,
  formatDuration,
  formatEstimatedDuration,
  formatPrice,
  formatServiceCount,
  formatTime,
} from "../utils/bookingFormatters";

export function SelectedServiceList({
  selectedVariations,
  removeVariation,
  submitting,
  showVariationDetails = false,
}) {
  return (
    <ul className="booking__selection-list">
      {selectedVariations.map((variation) => (
        <li key={variation.id}>
          <span className="booking__selection-entry">
            <span className="booking__selection-name">
              {variation.serviceName}
              {/* {variation.name ? ` — ${variation.name}` : ""} */}
            </span>
            {showVariationDetails && (
              <span className="booking__selection-meta">
                {formatDuration(variation.durationMs)} ·{" "}
                {formatPrice(variation.priceMoney)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => removeVariation(variation.id)}
            disabled={submitting}
            aria-label={`Remove ${variation.serviceName}${variation.name ? ` — ${variation.name}` : ""}`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function AppointmentSummary({
  selectedVariations,
  selectedServiceEstimate,
  date,
  selectedSlot,
  removeVariation,
  submitting,
  onContinue,
  showContinue = true,
}) {
  const hasSelectedServices = selectedVariations.length > 0;

  return (
    <div className="booking__appointment-card">
      <div className="booking__selection-summary-heading">
        <div className="booking__summary-title">
          {hasSelectedServices && (
            <p className="booking__selection-summary-eyebrow">
              {formatServiceCount(selectedVariations.length)}
            </p>
          )}
          <h3>Your appointment</h3>
        </div>
        {hasSelectedServices && (
          <div className="booking__selection-summary-estimate">
            <strong>{formatPrice(selectedServiceEstimate.priceMoney)}</strong>
            <span>
              {formatEstimatedDuration(selectedServiceEstimate.durationMs)}
            </span>
          </div>
        )}
      </div>

      {hasSelectedServices ? (
        <>
          <SelectedServiceList
            selectedVariations={selectedVariations}
            removeVariation={removeVariation}
            submitting={submitting}
          />
          <dl className="booking__appointment-details">
            <div>
              <dt>Preferred date</dt>
              <dd>{formatAppointmentDate(date)}</dd>
            </div>
            {selectedSlot && (
              <div>
                <dt>Appointment time</dt>
                <dd>{formatTime(selectedSlot.startAt)}</dd>
              </div>
            )}
          </dl>
          {showContinue && (
            <button
              className="booking__button booking__appointment-cta"
              type="button"
              onClick={onContinue}
              disabled={submitting}
            >
              Continue to date <span aria-hidden="true">→</span>
            </button>
          )}
        </>
      ) : (
        <div className="booking__appointment-empty">
          <p className="booking__appointment-empty-message">
            Select a service to get started.
          </p>
          <p>Selected services will appear here.</p>
        </div>
      )}
    </div>
  );
}
