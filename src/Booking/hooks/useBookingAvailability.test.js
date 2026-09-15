import { act, renderHook, waitFor } from "@testing-library/react";
import useBookingAvailability from "./useBookingAvailability";
import {
  getSquareAvailability,
  getSquareAvailabilityRange,
} from "../../api/squareService";
import {
  getEasternDate,
  getEasternMaxBookingDate,
} from "../utils/bookingFormatters";

jest.mock("../../api/squareService", () => ({
  getSquareAvailability: jest.fn(),
  getSquareAvailabilityRange: jest.fn(),
}));

function createHookProps(overrides = {}) {
  return {
    date: getEasternDate(),
    selectedVariationIds: ["variation-brow-shape"],
    submitting: false,
    clearActiveBookingAttempt: jest.fn(),
    setError: jest.fn(),
    uiDelay: 0,
    initialVisibleTimes: 10,
    visibleTimeIncrement: 5,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("loads one calendar range for the selected variations without replacing live slots", async () => {
  const today = getEasternDate();
  getSquareAvailabilityRange.mockResolvedValue({
    availabilityByDate: {
      [today]: [],
      [getEasternMaxBookingDate()]: [
        { startAt: "2026-09-14T14:00:00Z", teamMemberName: "Avery" },
      ],
    },
  });

  const { result } = renderHook(() => useBookingAvailability(createHookProps()));

  await waitFor(() =>
    expect(result.current.calendarAvailabilityStatus).toBe("success"),
  );

  expect(getSquareAvailabilityRange).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"],
    startDate: today,
    endDate: getEasternMaxBookingDate(),
  });
  expect(result.current.availability).toEqual([]);
  expect(result.current.availabilityByDate[today]).toEqual([]);
});

test("keeps a calendar request failure distinct from successful zero availability", async () => {
  getSquareAvailabilityRange.mockRejectedValue(new Error("Network unavailable"));

  const { result } = renderHook(() => useBookingAvailability(createHookProps()));

  await waitFor(() =>
    expect(result.current.calendarAvailabilityStatus).toBe("error"),
  );

  expect(result.current.availabilityByDate).toBeNull();
  expect(result.current.calendarAvailabilityError).toBe("Network unavailable");
});

test("keeps the existing selected-date availability request intact", async () => {
  getSquareAvailabilityRange.mockResolvedValue({ availabilityByDate: {} });
  getSquareAvailability.mockResolvedValue({
    availability: [{ startAt: "2026-09-14T14:00:00Z", teamMemberName: "Avery" }],
  });
  const props = createHookProps({ date: "2026-09-14" });
  const { result } = renderHook(() => useBookingAvailability(props));

  await act(async () => {
    await result.current.refreshAvailability();
  });

  expect(getSquareAvailability).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"],
    date: "2026-09-14",
  });
  expect(result.current.availability).toEqual([
    expect.objectContaining({
      availabilityDate: "2026-09-14",
      variationIds: ["variation-brow-shape"],
    }),
  ]);
});

test("revalidates a recovered slot against Square instead of trusting storage", async () => {
  const date = "2026-09-14";
  const slot = {
    startAt: "2026-09-14T14:00:00Z",
    availabilityDate: date,
    variationIds: ["variation-brow-shape"],
  };
  getSquareAvailabilityRange.mockResolvedValue({ availabilityByDate: {} });
  getSquareAvailability.mockResolvedValue({ availability: [] });

  const { result } = renderHook(() => useBookingAvailability(createHookProps({
    date,
    initialSelectedSlot: slot,
    uiDelay: 0,
  })));

  let isAvailable;
  await act(async () => {
    isAvailable = await result.current.revalidateRecoveredSlot(slot);
  });

  expect(isAvailable).toBe(false);
  expect(result.current.selectedSlot).toBeNull();
  expect(getSquareAvailability).toHaveBeenCalledWith({
    variationIds: ["variation-brow-shape"],
    date,
  });
});
