import { fireEvent, render, screen } from "@testing-library/react";
import DateSelector from "./DateSelector";
import {
  getEasternDate,
  getEasternMaxBookingDate,
} from "../utils/bookingFormatters";

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function addDays(value, amount) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dateButtonName(value) {
  return `Select ${DAY_LABEL_FORMATTER.format(
    new Date(`${value}T12:00:00Z`),
  )}`;
}

test("limits weekly calendar selection to the next 30 Eastern calendar days", () => {
  const today = getEasternDate();
  const maximumDate = getEasternMaxBookingDate();
  const firstUnavailableDate = addDays(today, 31);
  const handleDateChange = jest.fn();
  const initialWeekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const weeksToMaximumDate = Math.floor((30 + initialWeekday) / 7);

  const { container } = render(
    <DateSelector
      date={today}
      submitting={false}
      loadingAvailability={false}
      handleDateChange={handleDateChange}
      loadAvailability={jest.fn()}
    />,
  );

  const hiddenDateInput = container.querySelector("#appointment-date");
  expect(hiddenDateInput).toHaveAttribute("min", today);
  expect(hiddenDateInput).toHaveAttribute("max", maximumDate);

  fireEvent.click(screen.getByRole("button", { name: dateButtonName(today) }));
  expect(handleDateChange).toHaveBeenCalledWith({ target: { value: today } });

  for (let week = 0; week < weeksToMaximumDate; week += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  }

  expect(
    screen.getByRole("button", { name: dateButtonName(maximumDate) }),
  ).not.toBeDisabled();

  const unavailableDateButton = screen.getByRole("button", {
    name: dateButtonName(firstUnavailableDate),
  });
  expect(unavailableDateButton).toBeDisabled();

  fireEvent.click(unavailableDateButton);
  expect(handleDateChange).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
});
