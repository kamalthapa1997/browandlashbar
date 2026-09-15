import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CustomerDetails, { validateCustomerDetails } from "./CustomerDetails";
import {
  formatUsPhoneNumber,
  normalizeUsPhoneNumber,
} from "../utils/phoneNumber";

const completeCustomer = {
  firstName: "Mary",
  lastName: "O'Connor",
  phone: "(301) 555-1234",
  email: "",
};

function renderDetails(overrides = {}) {
  const props = {
    customerDetailsSectionRef: null,
    customer: { firstName: "", lastName: "", phone: "", email: "" },
    submitting: false,
    retryAfterRemaining: 0,
    updateCustomer: jest.fn(),
    onReview: jest.fn(),
    submitBooking: jest.fn(),
    ...overrides,
  };
  return { ...render(<CustomerDetails {...props} />), props };
}

function confirmButton() {
  return screen.getByRole("button", { name: "Confirm appointment" });
}

function CustomerDetailsHarness({
  initialCustomer = { firstName: "Mary", lastName: "Smith", phone: "", email: "" },
  onReview = jest.fn(),
}) {
  const [customer, setCustomer] = useState(initialCustomer);

  return (
    <CustomerDetails
      customerDetailsSectionRef={null}
      customer={customer}
      submitting={false}
      retryAfterRemaining={0}
      updateCustomer={(field, value) => setCustomer((current) => ({ ...current, [field]: value }))}
      onReview={onReview}
    />
  );
}

test("keeps confirmation disabled until every non-whitespace required field is supplied", () => {
  const { rerender, props } = renderDetails();
  expect(confirmButton()).toBeDisabled();

  rerender(<CustomerDetails {...props} customer={{ ...props.customer, firstName: "Mary" }} />);
  expect(confirmButton()).toBeDisabled();

  rerender(<CustomerDetails {...props} customer={{ ...props.customer, firstName: "Mary", lastName: "Smith" }} />);
  expect(confirmButton()).toBeDisabled();

  rerender(<CustomerDetails {...props} customer={{ ...props.customer, firstName: "Mary", lastName: "Smith", phone: "3015551234" }} />);
  expect(confirmButton()).toBeEnabled();

  rerender(<CustomerDetails {...props} customer={{ ...props.customer, firstName: "   ", lastName: "Smith", phone: "3015551234" }} />);
  expect(confirmButton()).toBeDisabled();
});

test.each(["Mary", "Mary-Jane", "O'Connor", "José"])(
  "allows legitimate required names such as %s",
  (firstName) => {
    renderDetails({ customer: { ...completeCustomer, firstName } });
    expect(confirmButton()).toBeEnabled();
  },
);

test("preserves submit-time phone and optional-email validation", () => {
  const { props, rerender } = renderDetails({
    customer: { ...completeCustomer, phone: "not a phone", email: "wrong-email" },
  });

  fireEvent.click(confirmButton());
  expect(props.onReview).not.toHaveBeenCalled();
  expect(screen.getByText("Please enter a valid 10-digit phone number.")).toBeInTheDocument();
  expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /phone/i })).toHaveAttribute("aria-invalid", "true");

  rerender(<CustomerDetails {...props} customer={completeCustomer} />);
  fireEvent.click(confirmButton());
  expect(props.onReview).toHaveBeenCalledTimes(1);
});

test("shows a parent review-validation message beside the confirm action", () => {
  renderDetails({
    customer: completeCustomer,
    reviewValidationMessage: "Please select at least one service to continue.",
  });

  expect(
    screen.getByText("Please select at least one service to continue."),
  ).toHaveAttribute("role", "alert");
  expect(confirmButton()).toBeEnabled();
});

test("allows a valid customer to attempt review with no services and explains the block", () => {
  const { props, rerender } = renderDetails({
    customer: completeCustomer,
    hasSelectedVariations: false,
  });

  expect(confirmButton()).toBeEnabled();
  fireEvent.click(confirmButton());

  expect(props.onReview).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText("Please select at least one service to continue."),
  ).toBeInTheDocument();

  rerender(
    <CustomerDetails {...props} hasSelectedVariations customer={completeCustomer} />,
  );
  expect(
    screen.queryByText("Please select at least one service to continue."),
  ).not.toBeInTheDocument();
});

test("accepts common U.S. phone formats, permits empty email, and preserves wait states", () => {
  [
    "3015551234",
    "301-555-1234",
    "(301) 555-1234",
    "301 555 1234",
    "+1 301 555 1234",
    "+13015551234",
    "13015551234",
  ].forEach((phone) => {
    expect(validateCustomerDetails({ ...completeCustomer, phone })).toEqual({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    });
  });

  const { rerender, props } = renderDetails({ customer: completeCustomer, submitting: true });
  expect(screen.getByRole("button", { name: "Confirming appointment…" })).toBeDisabled();

  rerender(<CustomerDetails {...props} customer={completeCustomer} submitting={false} retryAfterRemaining={12} />);
  expect(screen.getByRole("button", { name: "Please wait (12s)" })).toBeDisabled();
});

test("formats local and country-code input without treating the country code as an area code", () => {
  expect(formatUsPhoneNumber("3015551234")).toBe("(301) 555-1234");
  expect(formatUsPhoneNumber("+13015551234")).toBe("(301) 555-1234");
  expect(formatUsPhoneNumber("13015551234")).toBe("(301) 555-1234");

  render(<CustomerDetailsHarness />);
  const phone = screen.getByRole("textbox", { name: "Phone" });

  fireEvent.change(phone, { target: { value: "3015551234" } });
  expect(phone).toHaveValue("(301) 555-1234");

  fireEvent.change(phone, { target: { value: "+13015551234" } });
  expect(phone).toHaveValue("(301) 555-1234");
});

test("keeps incomplete phones quiet until review is attempted, then clears the inline error once valid", () => {
  const onReview = jest.fn();
  render(<CustomerDetailsHarness onReview={onReview} />);
  const phone = screen.getByRole("textbox", { name: "Phone" });

  expect(screen.queryByText("Please enter a valid 10-digit phone number.")).not.toBeInTheDocument();
  fireEvent.change(phone, { target: { value: "301555123" } });
  expect(screen.queryByText("Please enter a valid 10-digit phone number.")).not.toBeInTheDocument();

  fireEvent.click(confirmButton());
  expect(onReview).not.toHaveBeenCalled();
  expect(screen.getByText("Please enter a valid 10-digit phone number.")).toBeInTheDocument();
  expect(phone).toHaveAttribute("aria-invalid", "true");
  expect(phone).toHaveAttribute("aria-describedby", "phone-error");

  fireEvent.change(phone, { target: { value: "3015551234" } });
  expect(phone).toHaveValue("(301) 555-1234");
  expect(screen.queryByText("Please enter a valid 10-digit phone number.")).not.toBeInTheDocument();

  fireEvent.click(confirmButton());
  expect(onReview).toHaveBeenCalledTimes(1);
});

test.each(["301555123", "30155512345", "123", "abc", "abc3015551234"])(
  "rejects invalid U.S. phone input %s without truncating it into a valid number",
  (phone) => {
    expect(normalizeUsPhoneNumber(phone)).toBe("");
    expect(validateCustomerDetails({ ...completeCustomer, phone }).phone).toBe(
      "Please enter a valid 10-digit phone number.",
    );
  },
);
