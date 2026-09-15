import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock(
  "react-router-dom",
  () => require("../../testUtils/reactRouterDomMock"),
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
    useReducedMotion: () => true,
  };
});

import { MemoryRouter } from "react-router-dom";
import Booking, {
  canonicalizeVariationIds,
  getReviewTransition,
  getBookingStatusPresentation,
  isCurrentAvailabilitySlot,
} from "../Booking";
import {
  createSquareBooking,
  getSquareAvailability,
  getSquareAvailabilityRange,
  getSquareBookingServices,
} from "../../api/squareService";
import { formatTime, getEasternDate } from "../utils/bookingFormatters";
import { wait as bookingWait } from "../utils/bookingHelpers";

jest.mock("../../api/squareService", () => ({
  createSquareBooking: jest.fn(),
  getSquareAvailability: jest.fn(),
  getSquareAvailabilityRange: jest.fn(),
  getSquareBookingServices: jest.fn(),
}));

jest.mock("../utils/bookingHelpers", () => {
  const actual = jest.requireActual("../utils/bookingHelpers");

  return {
    ...actual,
    // The production delay is presentation-only. Keeping it out of this
    // integration suite prevents every exact-day request from adding 1.2s.
    wait: jest.fn(() => Promise.resolve()),
  };
});

const bookingServices = {
  categories: [{
    id: "category-brows",
    name: "Brows",
    services: [
      {
        id: "item-brow-shape",
        name: "Brow Shape",
        variations: [{
          id: "variation-brow-shape",
          version: 1,
          name: "Standard",
          durationMs: 30 * 60 * 1000,
          priceMoney: { amount: 2000, currency: "USD" },
        }],
      },
      {
        id: "item-brow-tint",
        name: "Brow Tint",
        variations: [
          {
            id: "variation-brow-tint-standard",
            version: 1,
            name: "Standard",
            durationMs: 30 * 60 * 1000,
            priceMoney: { amount: 2500, currency: "USD" },
          },
          {
            id: "variation-brow-tint-deluxe",
            version: 2,
            name: "Deluxe",
            durationMs: 45 * 60 * 1000,
            priceMoney: { amount: 3500, currency: "USD" },
          },
        ],
      },
      {
        id: "item-lip-wax",
        name: "Lip Wax",
        variations: [{
          id: "variation-lip-wax",
          version: 1,
          name: "Standard",
          durationMs: 15 * 60 * 1000,
          priceMoney: { amount: 1500, currency: "USD" },
        }],
      },
    ],
  }],
};

function addDays(date, amount) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

function slotForDate(date, time = "13:00:00Z") {
  return { startAt: `${date}T${time}`, teamMemberName: "Staff member" };
}

const today = getEasternDate();
const dateA = addDays(today, 1);
const dateB = addDays(today, 2);
const initialAvailability = { availability: [slotForDate(today)] };
const dateAAvailability = { availability: [slotForDate(dateA)] };
const refreshedAvailability = { availability: [slotForDate(today, "14:00:00Z")] };
const nextDayAvailability = { availability: [slotForDate(dateB, "14:00:00Z")] };
const noAvailability = { availability: [] };
const initialTime = formatTime(initialAvailability.availability[0].startAt);
const dateATime = formatTime(dateAAvailability.availability[0].startAt);
const refreshedTime = formatTime(refreshedAvailability.availability[0].startAt);
const nextDayTime = formatTime(nextDayAvailability.availability[0].startAt);

function availabilityForBookingWindow(startDate, endDate, availableDates = [today, dateA, dateB]) {
  const availabilityByDate = {};
  const current = new Date(`${startDate}T12:00:00Z`);
  const finalDate = new Date(`${endDate}T12:00:00Z`);

  while (current <= finalDate) {
    const date = current.toISOString().slice(0, 10);
    availabilityByDate[date] = availableDates.includes(date)
      ? [slotForDate(date)]
      : [];
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return { availabilityByDate };
}

function mockControlledCalendarRanges(availableDates = [today, dateA, dateB]) {
  const pendingResponses = [];
  getSquareAvailabilityRange.mockImplementation(({ startDate, endDate }) =>
    new Promise((resolve) => {
      pendingResponses.push(() =>
        resolve(availabilityForBookingWindow(startDate, endDate, availableDates)),
      );
    }),
  );

  return async function resolveNextCalendarRange() {
    await waitFor(() => expect(pendingResponses.length).toBeGreaterThan(0));
    await act(async () => {
      pendingResponses.shift()();
    });
  };
}

function renderBooking() {
  return render(
    <MemoryRouter initialEntries={["/booking"]}>
      <Booking />
    </MemoryRouter>,
  );
}

async function selectInitialSlot() {
  await addService("Add Brow Shape");
  await waitForCalendarDate(today);
  await userEvent.click(screen.getByRole("button", { name: "View available times" }));
  await userEvent.click(
    await screen.findByRole("button", { name: initialTime }, { timeout: 2_000 }),
  );
}

async function addService(name, { waitForCalendar = true } = {}) {
  const calendarCallsBefore = getSquareAvailabilityRange.mock.calls.length;
  const button = await screen.findByRole("button", { name });

  await act(async () => {
    await userEvent.click(button);
    await Promise.resolve();
  });

  if (waitForCalendar) {
    await waitForCalendarRefresh(calendarCallsBefore);
  }
}

async function waitForCalendarRefresh(calendarCallsBefore) {
  await waitFor(() =>
    expect(getSquareAvailabilityRange.mock.calls.length).toBeGreaterThan(calendarCallsBefore),
  );
  const calendarRequest = getSquareAvailabilityRange.mock.results.at(-1)?.value;
  await act(async () => {
    await calendarRequest;
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "View available times" })).toBeEnabled(),
  );
}

function calendarButtonName(value) {
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
  return `Select ${label}`;
}

async function waitForCalendarDate(value) {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "View available times" })).toBeEnabled(),
  );

  const name = calendarButtonName(value);
  let button = screen.queryByRole("button", { name });

  if (!button) {
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    button = await screen.findByRole("button", { name });
  }

  return button;
}

async function selectCalendarDate(value) {
  await userEvent.click(await waitForCalendarDate(value));
  await act(async () => {
    await Promise.resolve();
  });
}

async function enterCustomerDetails() {
  await userEvent.type(screen.getByLabelText("First name"), "Test");
  await userEvent.type(screen.getByLabelText("Last name"), "Customer");
  await userEvent.type(screen.getByLabelText("Phone"), "2025550100");
  await userEvent.type(screen.getByLabelText(/Email/), "test@example.com");
}

async function submitBookingResult(booking) {
  createSquareBooking.mockResolvedValue({ booking });
  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));

  expect(createSquareBooking).not.toHaveBeenCalled();
  const review = await screen.findByRole("region", { name: "Review your appointment" });
  expect(within(review).getByText("Brow Shape")).toBeInTheDocument();
  expect(within(review).getByText(initialTime)).toBeInTheDocument();
  expect(within(review).getByText("$20.00")).toBeInTheDocument();
  expect(within(review).getByText("Test Customer")).toBeInTheDocument();
  expect(within(review).getByText("(202) 555-0100")).toBeInTheDocument();
  expect(within(review).getByText("test@example.com")).toBeInTheDocument();

  await userEvent.click(within(review).getByRole("button", { name: "Back to edit" }));
  expect(screen.getByLabelText("First name")).toHaveValue("Test");
  expect(createSquareBooking).not.toHaveBeenCalled();
  await confirmBooking();
}

async function confirmBooking() {
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));
  await act(async () => {
    await userEvent.click(
      await screen.findByRole("button", { name: "Confirm & Book Appointment" }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(createSquareBooking).toHaveBeenCalled());
}

beforeEach(() => {
  jest.clearAllMocks();
  bookingWait.mockImplementation(() => Promise.resolve());
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.matchMedia = () => ({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  });
  getSquareBookingServices.mockResolvedValue(bookingServices);
  getSquareAvailability.mockImplementation(({ date }) => {
    if (date === today) return Promise.resolve(initialAvailability);
    if (date === dateA) return Promise.resolve(dateAAvailability);
    if (date === dateB) return Promise.resolve(nextDayAvailability);
    return Promise.resolve(noAvailability);
  });
  getSquareAvailabilityRange.mockImplementation(({ startDate, endDate }) =>
    Promise.resolve(availabilityForBookingWindow(startDate, endDate)),
  );
  Object.defineProperty(window, "crypto", {
    configurable: true,
    value: { randomUUID: () => "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e" },
  });
});

test("keeps the existing confirmation behavior after a successful booking", async () => {
  createSquareBooking.mockResolvedValue({
    booking: {
      id: "booking-1",
      service: "Brow Shape",
      startAt: initialAvailability.availability[0].startAt,
      status: "ACCEPTED",
    },
  });

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await confirmBooking();

  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
  expect(getSquareBookingServices).toHaveBeenCalledTimes(1);
  expect(getSquareAvailability).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"],
    date: today,
  });
  expect(createSquareBooking).toHaveBeenCalledWith({
    bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e",
    variationIds: ["variation-brow-shape"],
    startAt: initialAvailability.availability[0].startAt,
    customer: {
      firstName: "Test",
      lastName: "Customer",
      phone: "2025550100",
      email: "test@example.com",
    },
  });
  expect(getSquareAvailability).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem("square-booking-attempt")).toBeNull();
});

test("shows awaiting approval only when Square returns PENDING", async () => {
  await submitBookingResult({
    id: "booking-pending",
    service: "Brow Shape",
    startAt: initialAvailability.availability[0].startAt,
    status: "PENDING",
  });

  expect(await screen.findByText("Your request is awaiting approval.")).toBeInTheDocument();
  expect(screen.getByText(/submitted and is awaiting approval/i)).toBeInTheDocument();
  expect(screen.queryByText(/appointment confirmed/i)).not.toBeInTheDocument();
});

test("shows a declined result only when Square returns DECLINED", async () => {
  await submitBookingResult({
    id: "booking-declined",
    service: "Brow Shape",
    startAt: initialAvailability.availability[0].startAt,
    status: "DECLINED",
  });

  expect(await screen.findByText("Your request was declined.")).toBeInTheDocument();
  expect(screen.getByText(/select another time or service/i)).toBeInTheDocument();
  expect(screen.queryByText(/appointment confirmed/i)).not.toBeInTheDocument();
});

test("uses a neutral result for unknown and missing Square statuses", async () => {
  await submitBookingResult({
    id: "booking-future-status",
    service: "Brow Shape",
    startAt: initialAvailability.availability[0].startAt,
    status: "WAITLISTED",
  });

  expect(await screen.findByText("We received your request.")).toBeInTheDocument();
  expect(screen.getByText(/status needs to be verified/i)).toBeInTheDocument();
  expect(screen.queryByText(/appointment confirmed/i)).not.toBeInTheDocument();
});

test("uses a neutral result when Square omits booking.status", async () => {
  await submitBookingResult({
    id: "booking-missing-status",
    service: "Brow Shape",
    startAt: initialAvailability.availability[0].startAt,
  });

  expect(await screen.findByText("We received your request.")).toBeInTheDocument();
  expect(screen.getByText(/status needs to be verified/i)).toBeInTheDocument();
  expect(screen.queryByText(/appointment confirmed/i)).not.toBeInTheDocument();
});

test("does not crash when the booking or status is absent from a successful response", async () => {
  await submitBookingResult(undefined);

  expect(await screen.findByText("We received your request.")).toBeInTheDocument();
  expect(screen.getByText(/status needs to be verified/i)).toBeInTheDocument();
  expect(screen.queryByText(/appointment confirmed/i)).not.toBeInTheDocument();
});

test("bases confirmation on booking.status, never booking policy", () => {
  expect(
    getBookingStatusPresentation({
      status: "ACCEPTED",
      booking_policy: "REQUIRES_ACCEPTANCE",
    }),
  ).toMatchObject({ tone: "accepted", title: "We’ll see you soon." });
  expect(
    getBookingStatusPresentation({
      status: "PENDING",
      booking_policy: "ACCEPT_ALL",
    }),
  ).toMatchObject({ tone: "pending", title: "Your request is awaiting approval." });
});

test("displays Square's combined service confirmation result", async () => {
  createSquareBooking.mockResolvedValue({
    booking: {
      id: "booking-combined",
      service: "Brow Shape + Brow Tint",
      startAt: initialAvailability.availability[0].startAt,
      status: "ACCEPTED",
    },
  });

  renderBooking();
  await selectInitialSlot();
  await addService("Add Brow Tint — Deluxe");
  await waitForCalendarDate(today);
  await userEvent.click(screen.getByRole("button", { name: "View available times" }));
  await userEvent.click(await screen.findByRole("button", { name: initialTime }, { timeout: 2_000 }));
  await enterCustomerDetails();
  await confirmBooking();

  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
  expect(screen.getByText(/Brow Shape \+ Brow Tint is scheduled/i)).toBeInTheDocument();
});

test("uses catalog item names to distinguish services with generic variations", async () => {
  renderBooking();

  expect(await screen.findByRole("heading", { name: "Brows" })).toBeInTheDocument();
  expect(screen.getByText("Brow Tint")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Brow Shape" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Brow Tint — Standard" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Lip Wax" })).toBeInTheDocument();
  await addService("Add Brow Shape");

  await waitFor(() => expect(getSquareAvailabilityRange).toHaveBeenCalledTimes(1));
  expect(getSquareAvailabilityRange).toHaveBeenCalledWith(
    expect.objectContaining({ variationIds: ["variation-brow-shape"] }),
  );
});

test("automatically selects the first range-available date without loading its times", async () => {
  let resolveRange;
  getSquareAvailabilityRange.mockImplementationOnce(
    () => new Promise((resolve) => { resolveRange = resolve; }),
  );

  renderBooking();
  await addService("Add Brow Shape", { waitForCalendar: false });

  await waitFor(() => expect(resolveRange).toEqual(expect.any(Function)));
  await act(async () => {
    resolveRange(availabilityForBookingWindow(today, addDays(today, 30), [dateB]));
  });

  expect(await screen.findByRole("button", { name: calendarButtonName(dateB) })).toHaveAttribute("aria-pressed", "true");
  expect(getSquareAvailability).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: nextDayTime })).not.toBeInTheDocument();
});

test("keeps an available current date selected without loading times automatically", async () => {
  renderBooking();
  await addService("Add Brow Shape");

  expect(await waitForCalendarDate(today)).toHaveAttribute("aria-pressed", "true");
  expect(getSquareAvailability).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: initialTime })).not.toBeInTheDocument();
});

test("loads exact-day availability after an explicit calendar date click", async () => {
  renderBooking();
  await addService("Add Brow Shape");
  await waitForCalendarDate(today);

  await selectCalendarDate(dateA);

  expect(getSquareAvailability).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"], date: dateA,
  });
  expect(await screen.findByRole("button", { name: dateATime }, { timeout: 2_000 })).toBeInTheDocument();
});

test("loads exact-day availability after View available times", async () => {
  renderBooking();
  await addService("Add Brow Shape");
  await waitForCalendarDate(today);

  await userEvent.click(screen.getByRole("button", { name: "View available times" }));

  expect(getSquareAvailability).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"], date: today,
  });
  expect(await screen.findByRole("button", { name: initialTime }, { timeout: 2_000 })).toBeInTheDocument();
});

test("restores a selected Square cart after the booking page is remounted", async () => {
  const firstRender = renderBooking();
  await addService("Add Brow Shape");

  expect(JSON.parse(window.localStorage.getItem("square-booking-attempt"))).toMatchObject({
    variationIds: ["variation-brow-shape"],
    selectedVariations: [
      expect.objectContaining({
        id: "variation-brow-shape",
        serviceName: "Brow Shape",
        durationMs: 30 * 60 * 1000,
        priceMoney: { amount: 2000, currency: "USD" },
      }),
    ],
  });

  firstRender.unmount();
  renderBooking();
  await waitForCalendarDate(today);

  expect(
    await screen.findByRole("button", { name: "Deselect Brow Shape" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("recovers customer details, selected time, and review after a refresh", async () => {
  const firstRender = renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));
  expect(await screen.findByRole("region", { name: "Review your appointment" })).toBeInTheDocument();

  const storedDraft = JSON.parse(
    window.localStorage.getItem("square-booking-attempt"),
  );
  expect(storedDraft).toMatchObject({
    date: today,
    reviewingBooking: true,
    selectedSlot: { startAt: initialAvailability.availability[0].startAt },
    customer: {
      firstName: "Test",
      lastName: "Customer",
      phone: "(202) 555-0100",
      email: "test@example.com",
    },
  });

  firstRender.unmount();
  getSquareAvailability.mockClear();
  renderBooking();

  const recoveredReview = await screen.findByRole("region", {
    name: "Review your appointment",
  }, { timeout: 2_000 });
  expect(within(recoveredReview).getByText("Test Customer")).toBeInTheDocument();
  expect(getSquareAvailability).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"],
    date: today,
  });
  expect(screen.queryByRole("dialog", { name: "Edit services" })).not.toBeInTheDocument();
  expect(createSquareBooking).not.toHaveBeenCalled();

  await userEvent.click(
    within(recoveredReview).getByRole("button", { name: "Back to edit" }),
  );
  await userEvent.clear(screen.getByLabelText("First name"));
  await userEvent.type(screen.getByLabelText("First name"), "Updated");
  expect(JSON.parse(window.localStorage.getItem("square-booking-attempt"))).toMatchObject({
    reviewingBooking: false,
    customer: expect.objectContaining({ firstName: "Updated" }),
  });
});

test("does not restore a review when Square no longer offers its saved slot", async () => {
  window.localStorage.setItem("square-booking-attempt", JSON.stringify({
    version: 2,
    updatedAt: Date.now(),
    variationIds: ["variation-brow-shape"],
    selectedVariations: [{
      id: "variation-brow-shape",
      version: 1,
      name: "Standard",
      serviceName: "Brow Shape",
      durationMs: 30 * 60 * 1000,
      priceMoney: { amount: 2000, currency: "USD" },
    }],
    date: today,
    selectedSlot: {
      startAt: initialAvailability.availability[0].startAt,
      availabilityDate: today,
      variationIds: ["variation-brow-shape"],
    },
    customer: {
      firstName: "Test",
      lastName: "Customer",
      phone: "(202) 555-0100",
      email: "test@example.com",
    },
    reviewingBooking: true,
  }));
  getSquareAvailability.mockResolvedValue(noAvailability);

  renderBooking();

  expect(await screen.findByRole("alert", {}, { timeout: 2_000 })).toHaveTextContent(
    "The selected time is no longer available.",
  );
  expect(screen.queryByRole("region", { name: "Review your appointment" })).not.toBeInTheDocument();
  expect(createSquareBooking).not.toHaveBeenCalled();
});

test("never auto-submits a recovered in-progress booking attempt", async () => {
  window.localStorage.setItem("square-booking-attempt", JSON.stringify({
    version: 2,
    updatedAt: Date.now(),
    bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e",
    variationIds: ["variation-brow-shape"],
    selectedVariations: [{
      id: "variation-brow-shape",
      version: 1,
      name: "Standard",
      serviceName: "Brow Shape",
      durationMs: 30 * 60 * 1000,
      priceMoney: { amount: 2000, currency: "USD" },
    }],
    date: today,
    selectedSlot: {
      startAt: initialAvailability.availability[0].startAt,
      availabilityDate: today,
      variationIds: ["variation-brow-shape"],
    },
    startAt: initialAvailability.availability[0].startAt,
    customer: {
      firstName: "Test",
      lastName: "Customer",
      phone: "(202) 555-0100",
      email: "test@example.com",
    },
    reviewingBooking: true,
  }));
  createSquareBooking.mockResolvedValue({ booking: { status: "ACCEPTED" } });

  renderBooking();

  const review = await screen.findByRole("region", {
    name: "Review your appointment",
  }, { timeout: 2_000 });
  expect(createSquareBooking).not.toHaveBeenCalled();

  await act(async () => {
    await userEvent.click(
      within(review).getByRole("button", { name: "Confirm & Book Appointment" }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(createSquareBooking).toHaveBeenCalledWith(expect.objectContaining({
    bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e",
  }));
});

test("clears persisted cart state after its final service is removed", async () => {
  renderBooking();

  await addService("Add Brow Shape");
  await waitForCalendarDate(today);
  await userEvent.click(screen.getByRole("button", { name: "View available times" }));
  await screen.findByRole("button", { name: initialTime }, { timeout: 2_000 });
  await userEvent.click(
    await screen.findByRole("button", { name: "Deselect Brow Shape" }),
  );

  expect(window.localStorage.getItem("square-booking-attempt")).toBeNull();
});

test("opens and closes the selected-services editor from the mobile action", async () => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  renderBooking();

  await addService("Add Brow Shape");
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));

  const editor = await screen.findByRole("dialog", {
    name: "Edit services",
  });

  expect(within(editor).getByText("Brow Shape")).toBeInTheDocument();
  expect(
    within(editor).getByRole("button", { name: "Done editing" }),
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: "Close selected services editor" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Edit services" })).not.toBeInTheDocument(),
  );

  await userEvent.click(screen.getByRole("button", { name: "Edit" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Done editing" }),
  );

  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Edit services" })).not.toBeInTheDocument(),
  );
});

test("shows only the active Square category and lets customers switch categories", async () => {
  getSquareBookingServices.mockResolvedValue({
    categories: [
      ...bookingServices.categories,
      {
        id: "category-lashes",
        name: "Lashes",
        services: [
          {
            id: "item-lash-lift",
            name: "Lash Lift",
            variations: [{
              id: "variation-lash-lift",
              version: 1,
              name: "Standard",
              durationMs: 45 * 60 * 1000,
              priceMoney: { amount: 6500, currency: "USD" },
            }],
          },
        ],
      },
    ],
  });

  renderBooking();

  expect(await screen.findByRole("tab", { name: "Brows", selected: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Brow Shape" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Lash Lift/ })).not.toBeInTheDocument();

  await act(async () => {
    await userEvent.click(screen.getByRole("tab", { name: "Lashes" }));
    await Promise.resolve();
  });

  expect(await screen.findByRole("tab", { name: "Lashes", selected: true }, { timeout: 2_000 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Lash Lift" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Brow Shape/ })).not.toBeInTheDocument();
});

test("disables a pending booking submission and prevents a second request", async () => {
  getSquareAvailability.mockResolvedValue(initialAvailability);
  let resolveBooking;
  createSquareBooking.mockImplementation(
    () => new Promise((resolve) => { resolveBooking = resolve; }),
  );

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));
  expect(createSquareBooking).not.toHaveBeenCalled();
  const submitButton = await screen.findByRole("button", { name: "Confirm & Book Appointment" });

  const firstSubmit = userEvent.click(submitButton);
  const secondSubmit = userEvent.click(submitButton);
  await Promise.all([firstSubmit, secondSubmit]);

  expect(createSquareBooking).toHaveBeenCalledTimes(1);
  expect(submitButton).toBeDisabled();

  await act(async () => {
    resolveBooking({
      booking: {
        id: "booking-1",
        service: "Brow Shape",
        startAt: initialAvailability.availability[0].startAt,
        status: "ACCEPTED",
      },
    });
  });
  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
});

test("refreshes Square availability and clears a stale slot after a booking conflict", async () => {
  getSquareAvailability.mockImplementation(({ date }) => {
    if (date === today && getSquareAvailability.mock.calls.length > 1) {
      return Promise.resolve(refreshedAvailability);
    }
    if (date === today) return Promise.resolve(initialAvailability);
    return Promise.resolve(noAvailability);
  });
  createSquareBooking.mockRejectedValueOnce({
    code: "SLOT_UNAVAILABLE",
    message: "The selected time is no longer available. Please choose another time.",
  });

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await confirmBooking();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The selected time is no longer available. Please choose another time.",
  );
  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(2));
  expect(getSquareAvailability.mock.calls.at(-1)[0]).toEqual({
    variationIds: ["variation-brow-shape"], date: today,
  });
  expect(screen.queryByRole("button", { name: initialTime })).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: refreshedTime }, { timeout: 2_000 })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "4. Your information" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: refreshedTime }));
  expect(screen.getByLabelText("First name")).toHaveValue("Test");
  expect(screen.getByLabelText("Last name")).toHaveValue("Customer");
  expect(screen.getByLabelText("Phone")).toHaveValue("(202) 555-0100");
  expect(screen.getByLabelText(/Email/)).toHaveValue("test@example.com");
  expect(createSquareBooking).toHaveBeenCalledTimes(1);
});

test("keeps the durable booking attempt for a customer-controlled retry after Square rate limiting", async () => {
  createSquareBooking
    .mockRejectedValueOnce({
      code: "SQUARE_RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 1,
      message: "Square is temporarily rate-limiting requests.",
    })
    .mockResolvedValueOnce({
      booking: {
        id: "booking-after-rate-limit",
        service: "Brow Shape",
        startAt: initialAvailability.availability[0].startAt,
        status: "ACCEPTED",
      },
    });

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await confirmBooking();

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "We're temporarily experiencing high demand. Please wait about 1 second and try again.",
  );
  expect(createSquareBooking).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Please wait (1s)" })).toBeDisabled();

  await waitFor(
    () =>
      expect(
        screen.getByRole("button", { name: "Confirm & Book Appointment" }),
      ).toBeEnabled(),
    { timeout: 2_000 },
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Confirm & Book Appointment" }),
  );

  expect(createSquareBooking).toHaveBeenCalledTimes(2);
  expect(createSquareBooking.mock.calls[1][0].bookingAttemptId).toBe(
    createSquareBooking.mock.calls[0][0].bookingAttemptId,
  );
  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
});

test("clears a selected slot and replaces availability when the business date changes", async () => {
  renderBooking();
  await selectInitialSlot();

  await selectCalendarDate(dateB);

  expect(screen.queryByRole("heading", { name: "4. Your information" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: initialTime })).not.toBeInTheDocument();
  expect(createSquareBooking).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: nextDayTime }, { timeout: 2_000 })).toBeInTheDocument();
  expect(getSquareAvailability.mock.calls.at(-1)[0]).toEqual({
    variationIds: ["variation-brow-shape"],
    date: dateB,
  });
});

test("clears a selected slot and replaces availability when a service is added", async () => {
  getSquareAvailability.mockImplementation(({ variationIds, date }) => {
    if (date !== today) return Promise.resolve(noAvailability);
    if (variationIds.includes("variation-brow-tint-deluxe")) {
      return Promise.resolve(refreshedAvailability);
    }
    return Promise.resolve(initialAvailability);
  });

  renderBooking();
  await selectInitialSlot();

  await addService("Add Brow Tint — Deluxe");

  expect(screen.queryByRole("heading", { name: "4. Your information" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: initialTime })).not.toBeInTheDocument();
  expect(getSquareAvailability).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "View available times" }));
  expect(await screen.findByRole("button", { name: refreshedTime }, { timeout: 2_000 })).toBeInTheDocument();
  expect(getSquareAvailability.mock.calls.at(-1)[0]).toEqual({
    variationIds: ["variation-brow-shape", "variation-brow-tint-deluxe"], date: today,
  });
});

test("prevents a second exact-day request while the first date selection is loading", async () => {
  let resolveFirstRequest;
  getSquareAvailability.mockImplementationOnce(
    () => new Promise((resolve) => { resolveFirstRequest = resolve; }),
  );

  renderBooking();
  await addService("Add Brow Shape");
  await waitForCalendarDate(today);

  await selectCalendarDate(dateA);
  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(1));

  expect(screen.getByRole("button", { name: calendarButtonName(dateB) })).toBeDisabled();
  expect(getSquareAvailability).toHaveBeenLastCalledWith({
    variationIds: ["variation-brow-shape"],
    date: dateA,
  });

  await act(async () => {
    resolveFirstRequest(dateAAvailability);
  });
  expect(await screen.findByRole("button", { name: dateATime }, { timeout: 2_000 })).toBeInTheDocument();
});

test("rejects a stale slot context before a booking request can be made", () => {
  const slot = {
    startAt: dateAAvailability.availability[0].startAt,
    availabilityDate: dateA,
    variationIds: ["variation-brow-shape", "variation-brow-tint-deluxe"],
  };

  expect(isCurrentAvailabilitySlot(slot, dateB, ["variation-brow-shape", "variation-brow-tint-deluxe"])).toBe(false);
  expect(isCurrentAvailabilitySlot(slot, dateA, ["variation-brow-shape", "variation-brow-tint-standard"])).toBe(false);
  expect(isCurrentAvailabilitySlot(slot, dateA, ["variation-brow-tint-deluxe", "variation-brow-shape"])).toBe(true);
  expect(createSquareBooking).not.toHaveBeenCalled();
});

test("blocks the review transition with no selected services and permits it once valid", () => {
  expect(getReviewTransition([])).toEqual({
    reviewingBooking: false,
    reviewValidationMessage: "Please select at least one service to continue.",
  });
  expect(getReviewTransition([{ id: "variation-brow-shape" }])).toEqual({
    reviewingBooking: true,
    reviewValidationMessage: "",
  });
});

test("removing the final service exits review", async () => {
  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));
  expect(await screen.findByRole("region", { name: "Review your appointment" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Remove Brow Shape" }));

  expect(screen.queryByRole("region", { name: "Review your appointment" })).not.toBeInTheDocument();
  expect(window.localStorage.getItem("square-booking-attempt")).toBeNull();
});

test("adds multiple services once, shows an estimate, and sends canonical availability IDs", async () => {
  const resolveNextCalendarRange = mockControlledCalendarRanges();
  renderBooking();

  await addService("Add Brow Tint — Deluxe", { waitForCalendar: false });
  await resolveNextCalendarRange();
  await waitForCalendarDate(today);
  await addService("Add Brow Shape", { waitForCalendar: false });
  await resolveNextCalendarRange();
  await waitForCalendarDate(today);

  const appointment = screen.getByLabelText("Your appointment");
  expect(within(appointment).getByText("2 services")).toBeInTheDocument();
  expect(within(appointment).getByText("$55.00")).toBeInTheDocument();
  expect(within(appointment).getByText("Estimated 75 min")).toBeInTheDocument();
  expect(getSquareAvailability).not.toHaveBeenCalled();

  const calendarCallsBeforeRemoval = getSquareAvailabilityRange.mock.calls.length;
  await userEvent.click(screen.getByRole("button", { name: "Remove Brow Shape" }));
  await resolveNextCalendarRange();
  await waitFor(() =>
    expect(getSquareAvailabilityRange.mock.calls.length).toBeGreaterThan(calendarCallsBeforeRemoval),
  );
  await waitForCalendarDate(today);
  expect(within(appointment).getByText("1 service")).toBeInTheDocument();
  expect(getSquareAvailability).not.toHaveBeenCalled();
});

test("removes an individual selected service and prevents an empty selection from continuing", async () => {
  const resolveNextCalendarRange = mockControlledCalendarRanges();
  renderBooking();

  await addService("Add Brow Shape", { waitForCalendar: false });
  await resolveNextCalendarRange();
  await waitForCalendarDate(today);
  await addService("Add Brow Tint — Deluxe", { waitForCalendar: false });
  await resolveNextCalendarRange();
  await waitForCalendarDate(today);
  const calendarCallsBeforeRemoval = getSquareAvailabilityRange.mock.calls.length;
  await userEvent.click(screen.getByRole("button", { name: "Remove Brow Shape" }));
  await resolveNextCalendarRange();
  await waitFor(() =>
    expect(getSquareAvailabilityRange.mock.calls.length).toBeGreaterThan(calendarCallsBeforeRemoval),
  );
  await waitForCalendarDate(today);

  expect(within(screen.getByLabelText("Your appointment")).getByText("1 service")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: initialTime })).not.toBeInTheDocument();
  expect(getSquareAvailability).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: "Remove Brow Tint — Deluxe" }));

  expect(screen.queryByText("Selected services")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Appointment date")).not.toBeInTheDocument();
});

test("canonicalizes variation IDs for request and slot identity", () => {
  expect(canonicalizeVariationIds(["variation-b", "variation-a", "variation-b"])).toEqual([
    "variation-a",
    "variation-b",
  ]);
});

test("finds the next Square-available date without selecting an unavailable date", () => {
  expect(
    require("../Booking").findFirstAvailableDate(
      {
        "2026-09-12": [],
        "2026-09-13": [],
        "2026-09-14": [{ startAt: "2026-09-14T14:00:00Z" }],
      },
      "2026-09-12",
      "2026-09-15",
    ),
  ).toBe("2026-09-14");
  expect(
    require("../Booking").findFirstAvailableDate(
      { "2026-09-12": [], "2026-09-13": [] },
      "2026-09-12",
      "2026-09-13",
    ),
  ).toBe("");
});
