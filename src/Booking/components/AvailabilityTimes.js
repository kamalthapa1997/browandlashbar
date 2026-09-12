import { formatTime } from "../utils/bookingFormatters";

export default function AvailabilityTimes({
  hasSelectedVariations,
  loadingAvailability,
  availability,
  visibleAvailability,
  selectedSlot,
  submitting,
  handleTimeSelection,
  hasPaginatedTimes,
  hasMoreTimes,
  showMoreTimes,
  showFewerTimes,
  error,
  hasSearchedAvailability,
}) {
  return (
    <div
      className={`booking__availability-region${
        hasSelectedVariations ? "" : " booking__availability-region--empty"
      }`}
    >
    {hasSelectedVariations && loadingAvailability && (
                  <section
                    className="booking__section booking__availability-loading"
                    aria-live="polite"
                    aria-label="Checking available appointment times"
                  >
                    <div className="booking__section-heading">
                      <span className="booking__section-number">03</span>
    
                      <div>
                        <h2>Finding available times</h2>
    
                        <p>
                          Checking live availability for your selected services.
                        </p>
                      </div>
                    </div>
    
                    <div className="booking__time-loading">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <span key={index} />
                      ))}
                    </div>
                  </section>
                )}
    
                {hasSelectedVariations &&
                  !loadingAvailability &&
                  availability.length > 0 && (
                    <section
                      className="booking__section"
                      aria-labelledby="time-heading"
                    >
                      <div className="booking__section-heading">
                        <span className="booking__section-number">03</span>
    
                        <div>
                          <h2 id="time-heading">Select an available time</h2>
    
                          <p>These times are live and available to book.</p>
                        </div>
                      </div>
    
                      <div className="booking__times" aria-live="polite">
                        {visibleAvailability.map((slot) => {
                          const isSelected = selectedSlot?.startAt === slot.startAt;
    
                          return (
                            <button
                              type="button"
                              key={`${slot.startAt}-${slot.variationIds.join("-")}`}
                              onClick={() => handleTimeSelection(slot)}
                              disabled={submitting}
                              className={`booking__time ${
                                isSelected ? "is-selected" : ""
                              }`}
                              aria-pressed={isSelected}
                            >
                              {isSelected && (
                                <span
                                  className="booking__time-check"
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              )}
    
                              {formatTime(slot.startAt)}
                            </button>
                          );
                        })}
                      </div>
    
                      {hasPaginatedTimes && (
                        <div className="booking__time-more">
                          {hasMoreTimes ? (
                            <button
                              type="button"
                              onClick={showMoreTimes}
                              disabled={submitting}
                              className="booking__show-more"
                            >
                              Show more
                              <span
                                className="booking__show-more-arrow"
                                aria-hidden="true"
                              >
                                ↓
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={showFewerTimes}
                              disabled={submitting}
                              className="booking__show-more booking__show-more--less"
                            >
                              Show less
                              <span
                                className="booking__show-more-arrow"
                                aria-hidden="true"
                              >
                                ↑
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </section>
                  )}
    
                {hasSelectedVariations &&
                  !loadingAvailability &&
                  availability.length === 0 &&
                  !error && (
                    <p className="booking__hint">
                      {hasSearchedAvailability
                        ? "No online appointments are available on this date. Please choose another date."
                        : "Choose a date to view live availability."}
                    </p>
                )}
    </div>
  );
}
