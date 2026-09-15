import { useEffect, useRef, useState } from "react";
import {
  getSquareAvailability,
  getSquareAvailabilityRange,
} from "../../api/squareService";
import { canonicalizeVariationIds, wait } from "../utils/bookingHelpers";
import {
  getEasternDate,
  getEasternMaxBookingDate,
} from "../utils/bookingFormatters";

export default function useBookingAvailability({
  date,
  selectedVariationIds,
  submitting,
  clearActiveBookingAttempt,
  setError,
  uiDelay,
  initialVisibleTimes,
  visibleTimeIncrement,
  initialSelectedSlot = null,
}) {
  const [availability, setAvailability] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(initialSelectedSlot);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [hasSearchedAvailability, setHasSearchedAvailability] = useState(false);
  const [visibleTimeCount, setVisibleTimeCount] = useState(initialVisibleTimes);
  const [availabilityByDate, setAvailabilityByDate] = useState(null);
  const [calendarAvailabilityStatus, setCalendarAvailabilityStatus] = useState("idle");
  const [calendarAvailabilityError, setCalendarAvailabilityError] = useState("");
  const availabilityGenerationRef = useRef(0);
  const calendarGenerationRef = useRef(0);
  const calendarRequestRef = useRef(null);

  function invalidateAvailability() {
    availabilityGenerationRef.current += 1;
    setLoadingAvailability(false);
  }

  function invalidateCalendarAvailability() {
    calendarGenerationRef.current += 1;
    calendarRequestRef.current = null;
    setAvailabilityByDate(null);
    setCalendarAvailabilityStatus("idle");
    setCalendarAvailabilityError("");
  }

  async function loadCalendarAvailability({ force = false } = {}) {
    if (!selectedVariationIds.length) {
      invalidateCalendarAvailability();
      return;
    }

    const startDate = getEasternDate();
    const endDate = getEasternMaxBookingDate();
    const variationIds = canonicalizeVariationIds(selectedVariationIds);
    const requestKey = `${variationIds.join(",")}:${startDate}:${endDate}`;

    if (!force && calendarRequestRef.current === requestKey) return;

    const requestGeneration = calendarGenerationRef.current + 1;
    calendarGenerationRef.current = requestGeneration;
    calendarRequestRef.current = requestKey;
    setAvailabilityByDate(null);
    setCalendarAvailabilityStatus("loading");
    setCalendarAvailabilityError("");

    try {
      const data = await getSquareAvailabilityRange({
        variationIds,
        startDate,
        endDate,
      });

      if (requestGeneration !== calendarGenerationRef.current) return;

      setAvailabilityByDate(data?.availabilityByDate || {});
      setCalendarAvailabilityStatus("success");
    } catch (requestError) {
      if (requestGeneration !== calendarGenerationRef.current) return;

      setAvailabilityByDate(null);
      setCalendarAvailabilityStatus("error");
      setCalendarAvailabilityError(
        requestError.message || "Unable to check available dates.",
      );
    }
  }

  useEffect(() => {
    void loadCalendarAvailability();
    // The selected service IDs are the sole cache key. Changing dates must not
    // re-query the full booking window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariationIds.join(",")]);

  function resetAvailability() {
    setAvailability([]);
    setHasSearchedAvailability(false);
    setVisibleTimeCount(initialVisibleTimes);
  }

  async function refreshAvailability({
    preserveError = false,
    requestedDate = date,
    requestedVariationIds = selectedVariationIds,
  } = {}) {
    if (!requestedVariationIds.length) return;
    const canonicalVariationIds = canonicalizeVariationIds(requestedVariationIds);
    const requestGeneration = availabilityGenerationRef.current + 1;
    availabilityGenerationRef.current = requestGeneration;
    setLoadingAvailability(true);
    setHasSearchedAvailability(true);
    setAvailability([]);
    setSelectedSlot(null);
    setVisibleTimeCount(initialVisibleTimes);
    if (!preserveError) setError("");
    const requestStartedAt = Date.now();

    try {
      const data = await getSquareAvailability({ variationIds: canonicalVariationIds, date: requestedDate });
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed < uiDelay) await wait(uiDelay - elapsed);
      if (requestGeneration !== availabilityGenerationRef.current) return;
      setAvailability((data?.availability || []).map((slot) => ({ ...slot, availabilityDate: requestedDate, variationIds: canonicalVariationIds })));
    } catch (requestError) {
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed < uiDelay) await wait(uiDelay - elapsed);
      if (requestGeneration === availabilityGenerationRef.current && !preserveError) {
        setError(requestError.message || "Unable to find available times.");
      }
    } finally {
      if (requestGeneration === availabilityGenerationRef.current) setLoadingAvailability(false);
    }
  }

  // A recovered slot is only a customer preference, never availability proof.
  // Re-fetch its date from Square before putting it back into selected state.
  async function revalidateRecoveredSlot(slot, {
    requestedDate = date,
    requestedVariationIds = selectedVariationIds,
  } = {}) {
    if (!slot || !requestedDate || !requestedVariationIds.length) return false;

    const canonicalVariationIds = canonicalizeVariationIds(requestedVariationIds);
    const requestGeneration = availabilityGenerationRef.current + 1;
    availabilityGenerationRef.current = requestGeneration;
    setLoadingAvailability(true);
    setHasSearchedAvailability(true);
    setAvailability([]);
    setVisibleTimeCount(initialVisibleTimes);
    const requestStartedAt = Date.now();

    try {
      const data = await getSquareAvailability({
        variationIds: canonicalVariationIds,
        date: requestedDate,
      });
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed < uiDelay) await wait(uiDelay - elapsed);
      if (requestGeneration !== availabilityGenerationRef.current) return null;

      const currentAvailability = (data?.availability || []).map((item) => ({
        ...item,
        availabilityDate: requestedDate,
        variationIds: canonicalVariationIds,
      }));
      setAvailability(currentAvailability);

      const currentSlot = currentAvailability.find(
        (item) => item.startAt === slot.startAt,
      );
      if (!currentSlot) {
        setSelectedSlot(null);
        return false;
      }

      setSelectedSlot(currentSlot);
      return true;
    } catch (requestError) {
      const elapsed = Date.now() - requestStartedAt;
      if (elapsed < uiDelay) await wait(uiDelay - elapsed);
      if (requestGeneration === availabilityGenerationRef.current) {
        setSelectedSlot(null);
        setError(requestError.message || "Unable to verify your selected time.");
      }
      return null;
    } finally {
      if (requestGeneration === availabilityGenerationRef.current) {
        setLoadingAvailability(false);
      }
    }
  }

  async function loadAvailability(event) {
    event.preventDefault();
    if (!selectedVariationIds.length || !date) return;
    clearActiveBookingAttempt({ preserveCart: true });
    await refreshAvailability();
  }

  function handleTimeSelection(slot) {
    if (submitting || loadingAvailability) return;
    if (selectedSlot?.startAt !== slot.startAt) clearActiveBookingAttempt({ preserveCart: true });
    setSelectedSlot(slot);
    setError("");
  }

  function showMoreTimes() {
    setVisibleTimeCount((current) => Math.min(current + visibleTimeIncrement, availability.length));
  }

  function showFewerTimes() { setVisibleTimeCount(initialVisibleTimes); }

  return {
    availability,
    selectedSlot,
    loadingAvailability,
    hasSearchedAvailability,
    visibleTimeCount,
    availabilityByDate,
    calendarAvailabilityStatus,
    calendarAvailabilityError,
    invalidateAvailability,
    invalidateCalendarAvailability,
    loadCalendarAvailability,
    resetAvailability,
    refreshAvailability,
    revalidateRecoveredSlot,
    loadAvailability,
    handleTimeSelection,
    showMoreTimes,
    showFewerTimes,
    setSelectedSlot,
  };
}
