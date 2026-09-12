import { useRef, useState } from "react";
import { getSquareAvailability } from "../../api/squareService";
import { canonicalizeVariationIds, wait } from "../utils/bookingHelpers";

export default function useBookingAvailability({
  date,
  selectedVariationIds,
  submitting,
  clearActiveBookingAttempt,
  setError,
  uiDelay,
  initialVisibleTimes,
  visibleTimeIncrement,
}) {
  const [availability, setAvailability] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [hasSearchedAvailability, setHasSearchedAvailability] = useState(false);
  const [visibleTimeCount, setVisibleTimeCount] = useState(initialVisibleTimes);
  const availabilityGenerationRef = useRef(0);

  function invalidateAvailability() {
    availabilityGenerationRef.current += 1;
    setLoadingAvailability(false);
  }

  function resetAvailability() {
    setAvailability([]);
    setSelectedSlot(null);
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

  return { availability, selectedSlot, loadingAvailability, hasSearchedAvailability, visibleTimeCount, invalidateAvailability, resetAvailability, refreshAvailability, loadAvailability, handleTimeSelection, showMoreTimes, showFewerTimes, setSelectedSlot };
}
