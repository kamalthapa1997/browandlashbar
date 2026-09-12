import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock(
  "react-router-dom",
  () => require("../../testUtils/reactRouterDomMock"),
  { virtual: true },
);

import { MemoryRouter } from "react-router-dom";
import Booking, {
  canonicalizeVariationIds,
  getBookingStatusPresentation,
  isCurrentAvailabilitySlot,
} from "../Booking";
import {
  createSquareBooking,
  getSquareAvailability,
  getSquareBookingServices,
} from "../../api/squareService";

jest.mock("../../api/squareService", () => ({
  createSquareBooking: jest.fn(),
  getSquareAvailability: jest.fn(),
  getSquareBookingServices: jest.fn(),
}));

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
    ],
  }],
};

const initialAvailability = {
  availability: [{ startAt: "2026-09-14T13:00:00Z", teamMemberName: "Staff member" }],
};

const refreshedAvailability = {
  availability: [{ startAt: "2026-09-14T14:00:00Z", teamMemberName: "Staff member" }],
};

const nextDayAvailability = {
  availability: [{ startAt: "2026-09-15T14:00:00Z", teamMemberName: "Staff member" }],
};

const noAvailability = { availability: [] };

const dateA = "2026-09-14";
const dateB = "2026-09-15";

function renderBooking() {
  return render(
    <MemoryRouter initialEntries={["/booking"]}>
      <Booking />
    </MemoryRouter>,
  );
}

async function selectInitialSlot() {
  await userEvent.click(
    await screen.findByRole("button", { name: /Brow Shape/ }),
  );
  await selectDate(dateA);
  await userEvent.click(await screen.findByRole("button", { name: "9:00 AM" }));
}

async function selectDate(value) {
  await act(async () => {
    fireEvent.change(await screen.findByLabelText("Appointment date"), { target: { value } });
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
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  getSquareBookingServices.mockResolvedValue(bookingServices);
  getSquareAvailability.mockImplementation(({ date }) => {
    if (date === dateA) return Promise.resolve(initialAvailability);
    if (date === dateB) return Promise.resolve(nextDayAvailability);
    return Promise.resolve(noAvailability);
  });
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
      startAt: "2026-09-14T13:00:00Z",
      status: "ACCEPTED",
    },
  });

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));

  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
  expect(getSquareBookingServices).toHaveBeenCalledTimes(1);
  expect(getSquareAvailability).toHaveBeenLastCalledWith({
    variationIds: ["variation-brow-shape"],
    date: dateA,
  });
  expect(createSquareBooking).toHaveBeenCalledWith({
    bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e",
    variationIds: ["variation-brow-shape"],
    startAt: "2026-09-14T13:00:00Z",
    customer: {
      firstName: "Test",
      lastName: "Customer",
      phone: "2025550100",
      email: "test@example.com",
    },
  });
  expect(getSquareAvailability).toHaveBeenCalledTimes(2);
});

test("shows awaiting approval only when Square returns PENDING", async () => {
  await submitBookingResult({
    id: "booking-pending",
    service: "Brow Shape",
    startAt: "2026-09-14T13:00:00Z",
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
    startAt: "2026-09-14T13:00:00Z",
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
    startAt: "2026-09-14T13:00:00Z",
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
    startAt: "2026-09-14T13:00:00Z",
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
      startAt: "2026-09-14T14:00:00Z",
      status: "ACCEPTED",
    },
  });

  renderBooking();
  await selectInitialSlot();
  await userEvent.click(screen.getByRole("button", { name: /Deluxe.*45 min.*\$35\.00/ }));
  await userEvent.click(await screen.findByRole("button", { name: "9:00 AM" }));
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));

  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
  expect(screen.getByText(/Brow Shape \+ Brow Tint is scheduled/i)).toBeInTheDocument();
});

test("renders Square categories and requires an explicit variation choice", async () => {
  renderBooking();

  expect(await screen.findByRole("heading", { name: "Brows" })).toBeInTheDocument();
  expect(screen.getByText("Brow Tint")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Standard.*30 min.*\$25\.00/ })).toBeInTheDocument();
  const deluxe = screen.getByRole("button", { name: /Deluxe.*45 min.*\$35\.00/ });
  await userEvent.click(deluxe);

  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(1));
  expect(getSquareAvailability).toHaveBeenCalledWith(
    expect.objectContaining({ variationIds: ["variation-brow-tint-deluxe"] }),
  );
});

test("restores a selected Square cart after the booking page is remounted", async () => {
  const firstRender = renderBooking();
  const service = (await screen.findAllByRole("button", {
    name: "Add Standard",
  }))[0];

  await userEvent.click(service);

  expect(JSON.parse(window.sessionStorage.getItem("square-booking-attempt"))).toMatchObject({
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

  expect(
    await screen.findByRole("button", { name: "Remove Standard" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("clears persisted cart state after its final service is removed", async () => {
  renderBooking();

  await userEvent.click(
    (await screen.findAllByRole("button", { name: "Add Standard" }))[0],
  );
  await selectDate(dateA);
  await screen.findByRole("button", { name: "9:00 AM" }, { timeout: 2_000 });
  await userEvent.click(
    await screen.findByRole("button", { name: "Remove Standard" }),
  );

  expect(window.sessionStorage.getItem("square-booking-attempt")).toBeNull();
});

test("opens and closes the selected-services editor from the mobile action", async () => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  renderBooking();

  await userEvent.click(
    (await screen.findAllByRole("button", { name: "Add Standard" }))[0],
  );
  await userEvent.click(screen.getByRole("button", { name: "Edit" }));

  const editor = await screen.findByRole("dialog", {
    name: "Edit services",
  });

  expect(within(editor).getByText("Brow Shape — Standard")).toBeInTheDocument();
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
  expect(screen.getByRole("button", { name: /Brow Shape/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Lash Lift/ })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: "Lashes" }));

  expect(screen.getByRole("tab", { name: "Lashes", selected: true })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Lash Lift/ })).toBeInTheDocument();
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
  const submitButton = screen.getByRole("button", { name: "Confirm appointment" });

  const firstSubmit = userEvent.click(submitButton);
  const secondSubmit = userEvent.click(submitButton);
  await Promise.all([firstSubmit, secondSubmit]);

  expect(createSquareBooking).toHaveBeenCalledTimes(1);
  expect(submitButton).toBeDisabled();

  resolveBooking({
    booking: {
      id: "booking-1",
      service: "Brow Shape",
      startAt: "2026-09-14T13:00:00Z",
      status: "ACCEPTED",
    },
  });
  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
});

test("refreshes Square availability and clears a stale slot after a booking conflict", async () => {
  getSquareAvailability.mockImplementation(({ date }) => {
    if (date === dateA && getSquareAvailability.mock.calls.length > 2) {
      return Promise.resolve(refreshedAvailability);
    }
    if (date === dateA) return Promise.resolve(initialAvailability);
    return Promise.resolve(noAvailability);
  });
  createSquareBooking.mockRejectedValueOnce({
    code: "SLOT_UNAVAILABLE",
    message: "The selected time is no longer available. Please choose another time.",
  });

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The selected time is no longer available. Please choose another time.",
  );
  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(3));
  expect(getSquareAvailability.mock.calls[2][0]).toEqual(
    getSquareAvailability.mock.calls[1][0],
  );
  expect(screen.queryByRole("button", { name: "9:00 AM" })).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "4. Your information" })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "10:00 AM" }));
  expect(screen.getByLabelText("First name")).toHaveValue("Test");
  expect(screen.getByLabelText("Last name")).toHaveValue("Customer");
  expect(screen.getByLabelText("Phone")).toHaveValue("2025550100");
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
        startAt: "2026-09-14T13:00:00Z",
        status: "ACCEPTED",
      },
    });

  renderBooking();
  await selectInitialSlot();
  await enterCustomerDetails();
  jest.useFakeTimers();
  await userEvent.click(screen.getByRole("button", { name: "Confirm appointment" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "We're temporarily experiencing high demand. Please wait about 1 second and try again.",
  );
  expect(createSquareBooking).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Please wait (1s)" })).toBeDisabled();

  act(() => {
    jest.advanceTimersByTime(1_000);
  });
  await userEvent.click(await screen.findByRole("button", { name: "Confirm appointment" }));

  expect(createSquareBooking).toHaveBeenCalledTimes(2);
  expect(createSquareBooking.mock.calls[1][0].bookingAttemptId).toBe(
    createSquareBooking.mock.calls[0][0].bookingAttemptId,
  );
  expect(await screen.findByText("We’ll see you soon.")).toBeInTheDocument();
  jest.useRealTimers();
});

test("clears a selected slot and replaces availability when the business date changes", async () => {
  renderBooking();
  await selectInitialSlot();

  await selectDate(dateB);

  expect(screen.queryByRole("heading", { name: "4. Your information" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "9:00 AM" })).not.toBeInTheDocument();
  expect(createSquareBooking).not.toHaveBeenCalled();
  expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
  expect(getSquareAvailability.mock.calls[2][0]).toEqual({
    variationIds: ["variation-brow-shape"],
    date: dateB,
  });
});

test("clears a selected slot and replaces availability when a service is added", async () => {
  getSquareAvailability.mockImplementation(({ variationIds, date }) => {
    if (date !== dateA) return Promise.resolve(noAvailability);
    if (variationIds.includes("variation-brow-tint-deluxe")) {
      return Promise.resolve(refreshedAvailability);
    }
    return Promise.resolve(initialAvailability);
  });

  renderBooking();
  await selectInitialSlot();

  await userEvent.click(screen.getByRole("button", { name: /Deluxe.*45 min.*\$35\.00/ }));

  expect(screen.queryByRole("heading", { name: "4. Your information" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "9:00 AM" })).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
  expect(getSquareAvailability.mock.calls[2][0]).toEqual({
    variationIds: ["variation-brow-shape", "variation-brow-tint-deluxe"],
    date: dateA,
  });
});

test("ignores an older availability response after the customer changes dates", async () => {
  let resolveFirstRequest;
  let resolveSecondRequest;
  getSquareAvailability
    .mockResolvedValueOnce(noAvailability)
    .mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirstRequest = resolve; }),
    )
    .mockImplementationOnce(
      () => new Promise((resolve) => { resolveSecondRequest = resolve; }),
    );

  renderBooking();
  await userEvent.click(await screen.findByRole("button", { name: /Brow Shape/ }));
  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(1));

  await selectDate(dateA);
  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(2));
  await selectDate(dateB);
  await waitFor(() => expect(getSquareAvailability).toHaveBeenCalledTimes(3));

  await act(async () => {
    resolveSecondRequest(nextDayAvailability);
  });
  expect(await screen.findByRole("button", { name: "10:00 AM" })).toBeInTheDocument();

  await act(async () => {
    resolveFirstRequest(initialAvailability);
  });
  await waitFor(() => expect(screen.queryByRole("button", { name: "9:00 AM" })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "10:00 AM" })).toBeInTheDocument();
});

test("rejects a stale slot context before a booking request can be made", () => {
  const slot = {
    startAt: "2026-09-14T13:00:00Z",
    availabilityDate: dateA,
    variationIds: ["variation-brow-shape", "variation-brow-tint-deluxe"],
  };

  expect(isCurrentAvailabilitySlot(slot, dateB, ["variation-brow-shape", "variation-brow-tint-deluxe"])).toBe(false);
  expect(isCurrentAvailabilitySlot(slot, dateA, ["variation-brow-shape", "variation-brow-tint-standard"])).toBe(false);
  expect(isCurrentAvailabilitySlot(slot, dateA, ["variation-brow-tint-deluxe", "variation-brow-shape"])).toBe(true);
  expect(createSquareBooking).not.toHaveBeenCalled();
});

test("adds multiple services once, shows an estimate, and sends canonical availability IDs", async () => {
  renderBooking();

  await userEvent.click(await screen.findByRole("button", { name: /Deluxe.*45 min.*\$35\.00/ }));
  await userEvent.click(screen.getByRole("button", { name: "Brow Shape 30 min · $20.00" }));

  expect(await screen.findByText("2 selected")).toBeInTheDocument();
  expect(screen.getByText("Estimated total: $55.00")).toBeInTheDocument();
  expect(screen.getByText("Estimated 75 min")).toBeInTheDocument();
  expect(getSquareAvailability).toHaveBeenLastCalledWith({
    variationIds: ["variation-brow-shape", "variation-brow-tint-deluxe"],
    date: getSquareAvailability.mock.calls.at(-1)[0].date,
  });

  await userEvent.click(screen.getByRole("button", { name: "Brow Shape 30 min · $20.00" }));
  expect(screen.getByText("2 selected")).toBeInTheDocument();
  expect(getSquareAvailability).toHaveBeenCalledTimes(2);
});

test("removes an individual selected service and prevents an empty selection from continuing", async () => {
  renderBooking();

  await userEvent.click(await screen.findByRole("button", { name: /Brow Shape/ }));
  await userEvent.click(screen.getByRole("button", { name: /Deluxe.*45 min.*\$35\.00/ }));
  await userEvent.click(screen.getByRole("button", { name: "Remove Brow Shape — Standard" }));

  expect(screen.getByText("1 selected")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "9:00 AM" })).not.toBeInTheDocument();
  expect(getSquareAvailability).toHaveBeenLastCalledWith(
    expect.objectContaining({ variationIds: ["variation-brow-tint-deluxe"] }),
  );

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
