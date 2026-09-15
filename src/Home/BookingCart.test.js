import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock(
  "react-router-dom",
  () => require("../testUtils/reactRouterDomMock"),
  { virtual: true },
);

jest.mock("framer-motion", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get: (_, element) =>
        React.forwardRef(({ children, ...props }, ref) => {
          delete props.animate;
          delete props.exit;
          delete props.initial;
          delete props.transition;
          delete props.whileHover;
          delete props.whileTap;
          return React.createElement(element, { ...props, ref }, children);
        }),
    },
  );

  return {
    AnimatePresence: ({ children }) => children,
    motion,
    useReducedMotion: () => false,
  };
});

import { MemoryRouter, useLocation } from "react-router-dom";
import BookingCart from "./BookingCart";
import { saveBookingAttempt } from "../Booking/bookingAttemptStorage";

const cart = {
  variationIds: ["variation-brow-tint"],
  selectedVariations: [
    {
      id: "variation-brow-tint",
      version: 1,
      name: "Standard",
      serviceName: "Brow Tint",
      durationMs: 45 * 60 * 1000,
      priceMoney: { amount: 3500, currency: "USD" },
    },
  ],
};

function CurrentPath() {
  return <output data-testid="current-path">{useLocation().pathname}</output>;
}

function renderCart() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <BookingCart />
      <CurrentPath />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.matchMedia = () => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
});

test("does not render without persisted selected services", () => {
  renderCart();

  expect(
    screen.queryByRole("button", { name: /view selected services/i }),
  ).not.toBeInTheDocument();
});

test("shows the persisted selection and closes on outside interaction or Escape", async () => {
  saveBookingAttempt(cart);
  renderCart();

  await userEvent.click(
    screen.getByRole("button", { name: "View selected services, 1 service" }),
  );

  expect(screen.getByRole("dialog", { name: "Your selection" })).toBeInTheDocument();
  expect(screen.getByText("Brow Tint")).toBeInTheDocument();
  expect(screen.getAllByText("$35.00")).toHaveLength(2);
  expect(screen.getByText("45 min")).toBeInTheDocument();

  fireEvent.mouseDown(document.body);
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Your selection" })).not.toBeInTheDocument(),
  );

  await userEvent.click(
    screen.getByRole("button", { name: "View selected services, 1 service" }),
  );
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Your selection" })).not.toBeInTheDocument(),
  );
});

test("continues the existing booking flow without clearing the persisted cart", async () => {
  saveBookingAttempt(cart);
  renderCart();

  await userEvent.click(
    screen.getByRole("button", { name: "View selected services, 1 service" }),
  );
  await userEvent.click(screen.getByRole("button", { name: /continue booking/i }));

  expect(screen.getByTestId("current-path")).toHaveTextContent("/book");
  expect(JSON.parse(window.localStorage.getItem("square-booking-attempt"))).toMatchObject(
    cart,
  );
});
