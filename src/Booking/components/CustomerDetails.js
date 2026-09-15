import { useEffect, useRef, useState } from "react";

import {
  formatUsPhoneNumber,
  getFormattedPhoneCaretPosition,
  normalizeUsPhoneNumber,
} from "../utils/phoneNumber";

const requiredCustomerFields = ["firstName", "lastName", "phone"];

function requiredValueError(value, label) {
  return typeof value === "string" && value.trim()
    ? ""
    : `${label} is required.`;
}

function phoneError(value) {
  const requiredError = requiredValueError(value, "Phone");

  if (requiredError) return requiredError;

  return normalizeUsPhoneNumber(value)
    ? ""
    : "Please enter a valid 10-digit phone number.";
}

function emailError(value) {
  if (!value || !value.trim()) return "";

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? ""
    : "Please enter a valid email address.";
}

export function validateCustomerDetails(customer) {
  return {
    firstName: requiredValueError(customer.firstName, "First name"),
    lastName: requiredValueError(customer.lastName, "Last name"),
    phone: phoneError(customer.phone),
    email: emailError(customer.email),
  };
}

function hasErrors(errors) {
  return Object.values(errors).some(Boolean);
}

export default function CustomerDetails({
  customerDetailsSectionRef,
  customer,
  submitting,
  retryAfterRemaining,
  updateCustomer,
  hasSelectedVariations = true,
  reviewValidationMessage,
  onReview,
}) {
  const [errors, setErrors] = useState({});
  const [serviceError, setServiceError] = useState("");
  const phoneInputRef = useRef(null);

  const hasRequiredCustomerDetails = requiredCustomerFields.every((field) =>
    customer[field]?.trim(),
  );

  const isWaiting = submitting || retryAfterRemaining > 0;

  const confirmDisabled = isWaiting || !hasRequiredCustomerDetails;

  useEffect(() => {
    if (hasSelectedVariations) setServiceError("");
  }, [hasSelectedVariations]);

  function updateField(field, value) {
    updateCustomer(field, value);

    if (!errors[field]) return;

    const nextErrors = validateCustomerDetails({
      ...customer,
      [field]: value,
    });

    setErrors((current) => ({
      ...current,
      [field]: nextErrors[field],
    }));
  }

  function updatePhone(value, selectionStart) {
    const formattedValue = formatUsPhoneNumber(value);

    updateField("phone", formattedValue);

    requestAnimationFrame(() => {
      const input = phoneInputRef.current;

      if (!input || document.activeElement !== input) return;

      const caretPosition = getFormattedPhoneCaretPosition(
        value,
        selectionStart,
      );

      input.setSelectionRange(caretPosition, caretPosition);
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateCustomerDetails(customer);

    setErrors(nextErrors);

    if (hasErrors(nextErrors)) return;

    if (!hasSelectedVariations) {
      setServiceError("Please select at least one service to continue.");
      onReview();
      return;
    }

    setServiceError("");
    onReview();
  }

  function inputProps(field) {
    const error = errors[field];

    return {
      "aria-describedby": error ? `${field}-error` : undefined,
      "aria-invalid": error ? "true" : undefined,
    };
  }

  return (
    <section
      ref={customerDetailsSectionRef}
      className="booking__section"
      aria-labelledby="details-heading"
    >
      <div className="booking__section-heading">
        <span className="booking__section-number">04</span>

        <div>
          <h2 id="details-heading">Your information</h2>
          <p>Enter your details to confirm your appointment.</p>
        </div>
      </div>

      <form
        className="booking__customer-form"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="booking__customer-field">
          <label htmlFor="customer-first-name">
            <span className="booking__customer-field-label">First name</span>

            <input
              id="customer-first-name"
              required
              autoComplete="given-name"
              value={customer.firstName}
              disabled={submitting}
              onChange={(event) => updateField("firstName", event.target.value)}
              {...inputProps("firstName")}
            />
          </label>

          {errors.firstName && (
            <p id="firstName-error" className="booking__field-error">
              {errors.firstName}
            </p>
          )}
        </div>

        <div className="booking__customer-field">
          <label htmlFor="customer-last-name">
            <span className="booking__customer-field-label">Last name</span>

            <input
              id="customer-last-name"
              required
              autoComplete="family-name"
              value={customer.lastName}
              disabled={submitting}
              onChange={(event) => updateField("lastName", event.target.value)}
              {...inputProps("lastName")}
            />
          </label>

          {errors.lastName && (
            <p id="lastName-error" className="booking__field-error">
              {errors.lastName}
            </p>
          )}
        </div>

        <div className="booking__customer-field">
          <label htmlFor="customer-phone">
            <span className="booking__customer-field-label">Phone</span>

            <input
              id="customer-phone"
              required
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={customer.phone}
              disabled={submitting}
              ref={phoneInputRef}
              onChange={(event) =>
                updatePhone(event.target.value, event.target.selectionStart)
              }
              {...inputProps("phone")}
            />
          </label>

          {errors.phone && (
            <p id="phone-error" className="booking__field-error">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="booking__customer-field">
          <label htmlFor="customer-email">
            <span className="booking__customer-field-label">
              Email <small>(optional)</small>
            </span>

            <input
              id="customer-email"
              type="email"
              autoComplete="email"
              value={customer.email}
              disabled={submitting}
              onChange={(event) => updateField("email", event.target.value)}
              {...inputProps("email")}
            />
          </label>

          {errors.email && (
            <p id="email-error" className="booking__field-error">
              {errors.email}
            </p>
          )}
        </div>

        <button
          className="booking__button booking__button--confirm"
          type="submit"
          disabled={confirmDisabled}
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
            "Confirm appointment"
          )}
        </button>

        {(serviceError || reviewValidationMessage) && (
          <p className="booking__field-error" role="alert">
            {serviceError || reviewValidationMessage}
          </p>
        )}
      </form>
    </section>
  );
}
