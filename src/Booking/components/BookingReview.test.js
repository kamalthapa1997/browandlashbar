import { fireEvent, render, screen } from "@testing-library/react";
import BookingReview from "./BookingReview";

const baseProps = {
  customer: {
    firstName: "Kamal",
    lastName: "Thapa",
    phone: "301-555-1234",
    email: "",
  },
  selectedVariations: [{
    id: "brow-shape",
    serviceName: "Eyebrow Shaping",
    durationMs: 30 * 60 * 1000,
    priceMoney: { amount: 2500, currency: "USD" },
  }],
  selectedServiceEstimate: {
    durationMs: 30 * 60 * 1000,
    priceMoney: { amount: 2500, currency: "USD" },
  },
  date: "2026-09-15",
  selectedSlot: { startAt: "2026-09-15T14:00:00Z" },
  submitting: false,
  retryAfterRemaining: 0,
  onBack: jest.fn(),
  onConfirm: jest.fn(),
};

test("reviews existing appointment data and omits an empty email", () => {
  render(<BookingReview {...baseProps} />);

  expect(screen.getByRole("heading", { name: "Review your appointment" })).toBeInTheDocument();
  expect(screen.getByText("Eyebrow Shaping")).toBeInTheDocument();
  expect(screen.getByText("Kamal Thapa")).toBeInTheDocument();
  expect(screen.getByText("(301) 555-1234")).toBeInTheDocument();
  expect(screen.queryByText("Email")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm & Book Appointment" })).toBeEnabled();
});

test("preserves review actions and final-submission protection", () => {
  const onBack = jest.fn();
  const onConfirm = jest.fn();
  const { rerender } = render(<BookingReview {...baseProps} onBack={onBack} onConfirm={onConfirm} />);

  fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm & Book Appointment" }));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledTimes(1);

  rerender(<BookingReview {...baseProps} submitting />);
  expect(screen.getByRole("button", { name: "Back to edit" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Confirming appointment…" })).toBeDisabled();
});
