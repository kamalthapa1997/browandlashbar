import {
  formatAppointmentDate,
  formatDuration,
  formatPrice,
  formatTime,
} from "../utils/bookingFormatters";
import { getSelectedServiceIdentity } from "../utils/serviceIdentity";
import { formatUsPhoneNumber } from "../utils/phoneNumber";

export default function BookingReview({
  customer,
  selectedVariations,
  selectedServiceEstimate,
  date,
  selectedSlot,
  submitting,
  retryAfterRemaining,
  onBack,
  onConfirm,
}) {
  const isWaiting = submitting || retryAfterRemaining > 0;
  const fullName =
    `${customer.firstName.trim()} ${customer.lastName.trim()}`.trim();
  const email = customer.email.trim();

  return (
    <section
      className="booking__section booking__review"
      aria-labelledby="review-heading"
    >
      <div className="booking__section-heading">
        <span className="booking__section-number">04</span>
        <div>
          <h2 id="review-heading">Review your appointment</h2>
          <p>Please review your details before we confirm your booking.</p>
        </div>
      </div>

      <div className="booking__review-card">
        <section
          className="booking__review-section"
          aria-labelledby="review-appointment-heading"
        >
          <p
            className="booking__review-eyebrow"
            id="review-appointment-heading"
          >
            Your appointment
          </p>
          <ul className="booking__review-services">
            {selectedVariations.map((variation) => (
              <li key={variation.id}>
                <strong>{getSelectedServiceIdentity(variation)}</strong>
                <span>
                  {formatDuration(variation.durationMs)} ·{" "}
                  {formatPrice(variation.priceMoney)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="booking__review-details">
            <div>
              <dt>Date</dt>
              <dd>{formatAppointmentDate(date)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(selectedSlot.startAt)}</dd>
            </div>
            <div>
              <dt>Estimated duration</dt>
              <dd>{formatDuration(selectedServiceEstimate.durationMs)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatPrice(selectedServiceEstimate.priceMoney)}</dd>
            </div>
          </dl>
        </section>

        <section
          className="booking__review-section"
          aria-labelledby="review-customer-heading"
        >
          <p className="booking__review-eyebrow" id="review-customer-heading">
            Your information
          </p>
          <dl className="booking__review-details booking__review-details--customer">
            <div>
              <dt>Name</dt>
              <dd>{fullName}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{formatUsPhoneNumber(customer.phone)}</dd>
            </div>
            {email && (
              <div>
                <dt>Email</dt>
                <dd>{email}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className="booking__review-actions">
          <button
            type="button"
            className="booking__review-back"
            onClick={onBack}
            disabled={submitting}
          >
            Back to edit
          </button>
          <button
            type="button"
            className="booking__button booking__button--confirm"
            onClick={onConfirm}
            disabled={isWaiting}
            data-waiting={isWaiting || undefined}
          >
            {submitting ? (
              <>
                <span className="booking__button-spinner" aria-hidden="true" />
                Confirming appointment…
              </>
            ) : retryAfterRemaining > 0 ? (
              `Please wait (${retryAfterRemaining}s)`
            ) : (
              "Confirm & Book Appointment"
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
