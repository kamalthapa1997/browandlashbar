import { useEffect, useState } from "react";
import {
  getEasternDate,
  getEasternMaxBookingDate,
} from "../utils/bookingFormatters";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function dateFromValue(value) {
  return new Date(`${value}T12:00:00Z`);
}

function dateValue(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + amount);
  return nextDate;
}

function startOfWeek(value) {
  const calendarDate = dateFromValue(value);
  return addDays(calendarDate, -calendarDate.getUTCDay());
}

export default function DateSelector({
  dateSectionRef,
  date,
  submitting,
  loadingAvailability,
  availabilityByDate,
  calendarAvailabilityStatus,
  calendarAvailabilityError,
  retryCalendarAvailability,
  handleDateChange,
  loadAvailability,
}) {
  const minimumDate = getEasternDate();
  const maximumDate = getEasternMaxBookingDate();
  const selectedDate = date || "";
  const dateForCalendar = selectedDate || minimumDate;
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(dateForCalendar),
  );
  const earliestWeek = startOfWeek(minimumDate);
  const latestWeek = startOfWeek(maximumDate);
  const weekDates = Array.from({ length: WEEKDAY_LABELS.length }, (_, index) =>
    addDays(weekStart, index),
  );

  useEffect(() => {
    const selectedWeek = startOfWeek(dateForCalendar);

    setWeekStart((currentWeek) =>
      dateValue(currentWeek) === dateValue(selectedWeek)
        ? currentWeek
        : selectedWeek,
    );
  }, [dateForCalendar]);

  function hasSquareAvailability(value) {
    return Array.isArray(availabilityByDate?.[value]) &&
      availabilityByDate[value].length > 0;
  }

  function isDateSelectable(value) {
    if (value < minimumDate || value > maximumDate) return false;
    if (calendarAvailabilityStatus === "loading") return false;
    if (calendarAvailabilityStatus === "success") {
      return hasSquareAvailability(value);
    }

    // If Square could not be reached, retain the prior date-selection behavior
    // rather than incorrectly presenting every date as unavailable.
    return true;
  }

  function selectDate(nextDate) {
    if (!isDateSelectable(nextDate)) {
      return;
    }

    handleDateChange({ target: { value: nextDate } });
  }

  function showWeek(offset) {
    setWeekStart((currentWeek) => {
      const nextWeek = addDays(currentWeek, offset * WEEKDAY_LABELS.length);

      return dateValue(nextWeek) < dateValue(earliestWeek)
        ? earliestWeek
        : nextWeek;
    });
  }

  const previousWeekDisabled =
    submitting ||
    loadingAvailability ||
    dateValue(weekStart) <= dateValue(earliestWeek);
  const nextWeekDisabled =
    submitting ||
    loadingAvailability ||
    dateValue(addDays(weekStart, WEEKDAY_LABELS.length)) >
      dateValue(latestWeek);

  return (
    <section
      className="booking__section"
      aria-labelledby="date-heading"
      ref={dateSectionRef}
    >
      <div className="booking__section-heading">
        <span className="booking__section-number">02</span>

        <div>
          <h2 id="date-heading">Select a date</h2>

          <p>Choose the day that works best for you.</p>
        </div>
      </div>

      <form className="booking__date-form" onSubmit={loadAvailability}>
        <input
          id="appointment-date"
          type="hidden"
          value={selectedDate}
          min={minimumDate}
          max={maximumDate}
          onChange={handleDateChange}
          aria-label="Appointment date"
        />

        <div
          className="booking__weekly-calendar"
          role="group"
          aria-labelledby="calendar-heading"
        >
          <div className="booking__calendar-navigation">
            <button
              className="booking__calendar-arrow"
              type="button"
              aria-label="Previous week"
              onClick={() => showWeek(-1)}
              disabled={previousWeekDisabled}
            >
              <span aria-hidden="true">‹</span>
            </button>

            <h3 id="calendar-heading" aria-live="polite">
              {MONTH_LABEL_FORMATTER.format(weekStart)}
            </h3>

            <button
              className="booking__calendar-arrow"
              type="button"
              aria-label="Next week"
              onClick={() => showWeek(1)}
              disabled={nextWeekDisabled}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="booking__calendar-weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="booking__calendar-days">
            {weekDates.map((calendarDate) => {
              const value = dateValue(calendarDate);
              const isPast = value < minimumDate;
              const isBeyondBookingWindow = value > maximumDate;
              const hasAvailability = hasSquareAvailability(value);
              const isSelectable = isDateSelectable(value);
              const isSelected = value === selectedDate && isSelectable;
              const isToday = value === minimumDate;
              const isUnavailable =
                !isPast &&
                !isBeyondBookingWindow &&
                calendarAvailabilityStatus === "success" &&
                !hasAvailability;
              const dayLabel = `${DAY_LABEL_FORMATTER.format(calendarDate)}${
                isUnavailable ? " — unavailable" : ""
              }`;

              return (
                <button
                  className={`booking__calendar-day${
                    isSelected ? " is-selected" : ""
                  }${isBeyondBookingWindow ? " is-outside-window" : ""}${
                    isUnavailable ? " is-unavailable" : ""
                  }`}
                  type="button"
                  key={value}
                  aria-label={`Select ${dayLabel}`}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => selectDate(value)}
                  disabled={!isSelectable || submitting || loadingAvailability}
                >
                  {calendarDate.getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>

        {calendarAvailabilityStatus === "loading" && (
          <p className="booking__hint" role="status">
            Checking available dates…
          </p>
        )}

        {calendarAvailabilityStatus === "error" && (
          <p className="booking__hint" role="alert">
            {calendarAvailabilityError || "Unable to check available dates."}{" "}
            <button
              className="booking__show-more"
              type="button"
              onClick={retryCalendarAvailability}
            >
              Try again
            </button>
          </p>
        )}

        {calendarAvailabilityStatus === "success" &&
          Object.values(availabilityByDate || {}).every(
            (slots) => !Array.isArray(slots) || slots.length === 0,
          ) && (
            <p className="booking__hint" role="status">
              No appointments are currently available for these services within
              the selected booking window.
            </p>
          )}

        <button
          className="booking__button"
          type="submit"
          disabled={
            loadingAvailability ||
            submitting ||
            !selectedDate ||
            calendarAvailabilityStatus === "loading"
          }
        >
          {loadingAvailability ? (
            <>
              <span className="booking__button-spinner" aria-hidden="true" />
              Checking availability…
            </>
          ) : (
            "View available times"
          )}
        </button>
      </form>
    </section>
  );
}
