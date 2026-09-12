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
  handleDateChange,
  loadAvailability,
}) {
  const minimumDate = getEasternDate();
  const maximumDate = getEasternMaxBookingDate();
  const selectedDate = date || minimumDate;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selectedDate));
  const earliestWeek = startOfWeek(minimumDate);
  const latestWeek = startOfWeek(maximumDate);
  const weekDates = Array.from(
    { length: WEEKDAY_LABELS.length },
    (_, index) => addDays(weekStart, index),
  );

  useEffect(() => {
    const selectedWeek = startOfWeek(selectedDate);

    setWeekStart((currentWeek) =>
      dateValue(currentWeek) === dateValue(selectedWeek)
        ? currentWeek
        : selectedWeek,
    );
  }, [selectedDate]);

  function selectDate(nextDate) {
    if (nextDate < minimumDate || nextDate > maximumDate) {
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
    dateValue(addDays(weekStart, WEEKDAY_LABELS.length)) > dateValue(latestWeek);

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
              const isSelectable = !isPast && !isBeyondBookingWindow;
              const isSelected = value === selectedDate && isSelectable;
              const isToday = value === minimumDate;

              return (
                <button
                  className={`booking__calendar-day${
                    isSelected ? " is-selected" : ""
                  }${isBeyondBookingWindow ? " is-outside-window" : ""}`}
                  type="button"
                  key={value}
                  aria-label={`Select ${DAY_LABEL_FORMATTER.format(calendarDate)}`}
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

        <button
          className="booking__button"
          type="submit"
          disabled={loadingAvailability || submitting}
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
