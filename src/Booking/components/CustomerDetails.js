export default function CustomerDetails({
  customer,
  submitting,
  retryAfterRemaining,
  updateCustomer,
  submitBooking,
}) {
  return (
        <section
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
                      onSubmit={submitBooking}
                    >
                      <label>
                        First name
                        <input
                          required
                          autoComplete="given-name"
                          value={customer.firstName}
                          disabled={submitting}
                          onChange={(event) =>
                            updateCustomer("firstName", event.target.value)
                          }
                        />
                      </label>
    
                      <label>
                        Last name
                        <input
                          required
                          autoComplete="family-name"
                          value={customer.lastName}
                          disabled={submitting}
                          onChange={(event) =>
                            updateCustomer("lastName", event.target.value)
                          }
                        />
                      </label>
    
                      <label>
                        Phone
                        <input
                          required
                          type="tel"
                          autoComplete="tel"
                          value={customer.phone}
                          disabled={submitting}
                          onChange={(event) =>
                            updateCustomer("phone", event.target.value)
                          }
                        />
                      </label>
    
                      <label>
                        Email <small>(optional)</small>
                        <input
                          type="email"
                          autoComplete="email"
                          value={customer.email}
                          disabled={submitting}
                          onChange={(event) =>
                            updateCustomer("email", event.target.value)
                          }
                        />
                      </label>
    
                      <button
                        className="booking__button booking__button--confirm"
                        type="submit"
                        disabled={submitting || retryAfterRemaining > 0}
                      >
                        {submitting ? (
                          <>
                            <span
                              className="booking__button-spinner"
                              aria-hidden="true"
                            />
                            Confirming appointment…
                          </>
                        ) : retryAfterRemaining > 0 ? (
                          `Please wait (${retryAfterRemaining}s)`
                        ) : (
                          "Confirm appointment"
                        )}
                      </button>
                    </form>
                  </section>
  );
}
