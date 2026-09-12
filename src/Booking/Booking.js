import { useEffect, useMemo, useRef, useState } from "react";
import { createSquareBooking } from "../api/squareService";
import {
  clearBookingAttempt as clearStoredBookingAttempt,
  loadBookingAttempt,
  saveBookingAttempt,
} from "./bookingAttemptStorage";
import {
  getEasternDate,
  getEasternDateForInstant,
} from "./utils/bookingFormatters";
import {
  canonicalizeVariationIds,
  isCurrentAvailabilitySlot,
} from "./utils/bookingHelpers";
import AppointmentSummaryView from "./components/AppointmentSummary";
import MobileBookingAction, {
  MobileCartSheet as MobileCartSheetView,
} from "./components/MobileBookingAction";
import ServiceSelector from "./components/ServiceSelector";
import DateSelector from "./components/DateSelector";
import AvailabilityTimes from "./components/AvailabilityTimes";
import CustomerDetails from "./components/CustomerDetails";
import BookingHeader from "./components/BookingHeader";
import BookingProgress from "./components/BookingProgress";
import BookingConfirmation from "./components/BookingConfirmation";
import useBookingCatalog from "./hooks/useBookingCatalog";
import useBookingAvailability from "./hooks/useBookingAvailability";
import "./Booking.css";

const UI_DELAY = 1200;
const INITIAL_MOBILE_TIMES = 10;
const MOBILE_TIME_INCREMENT = 5;

export {
  canonicalizeVariationIds,
  getBookingStatusPresentation,
  isCurrentAvailabilitySlot,
} from "./utils/bookingHelpers";

function Booking() {
  const recoveredBookingState = useRef(loadBookingAttempt()).current;
  const recoveredAttempt = recoveredBookingState?.bookingAttemptId
    ? recoveredBookingState
    : null;
  const recoveredCart = recoveredBookingState?.selectedVariations || [];


  const [serviceSelectorCollapsed, setServiceSelectorCollapsed] = useState(
    Boolean(recoveredAttempt),
  );

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [selectedVariations, setSelectedVariations] = useState(recoveredCart);

  const [date, setDate] = useState(
    recoveredAttempt?.startAt
      ? getEasternDateForInstant(recoveredAttempt.startAt)
      : getEasternDate(),
  );




  const [submitting, setSubmitting] = useState(false);

  const {
    variations,
    availableCategories,
    activeCategory,
    loadingServices,
    catalogError,
    loadingCategory,
    loadingCategoryId,
    handleCategoryChange,
    retryCatalog,
  } = useBookingCatalog({ submitting, uiDelay: UI_DELAY });

  const [retryAfterUntil, setRetryAfterUntil] = useState(0);
  const [retryAfterRemaining, setRetryAfterRemaining] = useState(0);

  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const [customer, setCustomer] = useState(
    recoveredAttempt?.customer || {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    },
  );

  const [bookingAttempt, setBookingAttempt] = useState(recoveredAttempt);

  const submittingRef = useRef(false);

  const dateSectionRef = useRef(null);
  const serviceSectionRef = useRef(null);

  useEffect(() => {
    if (!retryAfterUntil) {
      return undefined;
    }

    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((retryAfterUntil - Date.now()) / 1000),
      );

      setRetryAfterRemaining(remaining);

      if (remaining === 0) {
        setRetryAfterUntil(0);
      }
    };

    updateRemaining();

    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [retryAfterUntil]);

  const selectedVariationIds = useMemo(
    () =>
      canonicalizeVariationIds(
        selectedVariations.map((variation) => variation.id),
      ),
    [selectedVariations],
  );

  const selectedServiceEstimate = useMemo(() => {
    const currencies = new Set(
      selectedVariations
        .map((variation) => variation.priceMoney?.currency)
        .filter(Boolean),
    );

    const hasKnownPrices = selectedVariations.every((variation) =>
      Number.isFinite(variation.priceMoney?.amount),
    );

    const hasKnownDuration = selectedVariations.every(
      (variation) =>
        Number.isFinite(variation.durationMs) && variation.durationMs > 0,
    );

    return {
      priceMoney:
        hasKnownPrices && currencies.size === 1
          ? {
              amount: selectedVariations.reduce(
                (total, variation) => total + variation.priceMoney.amount,
                0,
              ),
              currency: selectedVariations[0]?.priceMoney.currency,
            }
          : null,

      durationMs: hasKnownDuration
        ? selectedVariations.reduce(
            (total, variation) => total + variation.durationMs,
            0,
          )
        : null,
    };
  }, [selectedVariations]);

  const {
    availability, selectedSlot, loadingAvailability, hasSearchedAvailability,
    visibleTimeCount, invalidateAvailability, resetAvailability,
    refreshAvailability, loadAvailability, handleTimeSelection,
    showMoreTimes, showFewerTimes, setSelectedSlot,
  } = useBookingAvailability({
    date, selectedVariationIds, submitting, clearActiveBookingAttempt, setError,
    uiDelay: UI_DELAY, initialVisibleTimes: INITIAL_MOBILE_TIMES,
    visibleTimeIncrement: MOBILE_TIME_INCREMENT,
  });


  useEffect(() => {
    if (!bookingAttempt || !variations.length) {
      return;
    }

    if (
      !Array.isArray(bookingAttempt.variationIds) ||
      !bookingAttempt.variationIds.length ||
      !bookingAttempt.startAt
    ) {
      clearStoredBookingAttempt();
      setBookingAttempt(null);
      setServiceSelectorCollapsed(false);
      return;
    }

    const recoveredVariations = bookingAttempt.variationIds.map((variationId) =>
      variations.find((item) => item.id === variationId),
    );

    if (recoveredVariations.some((variation) => !variation)) {
      if (!selectedVariations.length) {
        clearStoredBookingAttempt();
        setBookingAttempt(null);
        setServiceSelectorCollapsed(false);
        return;
      }
    } else {
      setSelectedVariations((current) =>
        current.length
          ? current.map(
              (variation) =>
                recoveredVariations.find((item) => item.id === variation.id) ||
                variation,
            )
          : recoveredVariations,
      );
    }

    const availabilityDate = getEasternDateForInstant(bookingAttempt.startAt);

    setDate(availabilityDate);
    setSelectedSlot({
      startAt: bookingAttempt.startAt,
      availabilityDate,
      variationIds: canonicalizeVariationIds(bookingAttempt.variationIds),
    });

    setServiceSelectorCollapsed(true);
    setMobileCartOpen(false);
  }, [bookingAttempt, selectedVariations.length, setSelectedSlot, variations]);

  const step = useMemo(() => {
    if (confirmation) {
      return 5;
    }

    if (selectedSlot) {
      return 4;
    }

    if (availability.length) {
      return 3;
    }

    if (selectedVariations.length) {
      return 2;
    }

    return 1;
  }, [
    availability.length,
    confirmation,
    selectedSlot,
    selectedVariations.length,
  ]);

  function saveCartSelection(nextSelectedVariations) {
    if (!nextSelectedVariations.length) {
      clearStoredBookingAttempt();
      return;
    }

    saveBookingAttempt({
      variationIds: canonicalizeVariationIds(
        nextSelectedVariations.map((variation) => variation.id),
      ),
      selectedVariations: nextSelectedVariations,
    });
  }

  function clearActiveBookingAttempt({ preserveCart = false } = {}) {
    clearStoredBookingAttempt();
    setBookingAttempt(null);

    if (preserveCart) {
      saveCartSelection(selectedVariations);
    }
  }

  function updateCustomer(field, value) {
    if (bookingAttempt) {
      clearActiveBookingAttempt({ preserveCart: true });
    }

    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSelectedVariations(nextSelectedVariations) {
    invalidateAvailability();
    clearActiveBookingAttempt();
    setSelectedVariations(nextSelectedVariations);
    saveCartSelection(nextSelectedVariations);
    resetAvailability();
    setError("");
    if (!nextSelectedVariations.length) { setServiceSelectorCollapsed(false); setMobileCartOpen(false); }
  }

  function toggleVariation(variation) {
    if (submitting || loadingAvailability) return;
    const isSelected = selectedVariations.some((item) => item.id === variation.id);
    if (isSelected) { updateSelectedVariations(selectedVariations.filter((item) => item.id !== variation.id)); return; }
    updateSelectedVariations([...selectedVariations, variation]);
  }

  function continueToDate() {
    if (!selectedVariations.length || submitting) return;
    setServiceSelectorCollapsed(true); setMobileCartOpen(false);
    window.requestAnimationFrame(() => { dateSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  function editServices() {
    setServiceSelectorCollapsed(false); setMobileCartOpen(true);
    window.requestAnimationFrame(() => { serviceSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }

  function closeMobileCart() { setMobileCartOpen(false); }
  function removeVariation(variationId) { updateSelectedVariations(selectedVariations.filter((variation) => variation.id !== variationId)); }

  function handleDateChange(event) {
    const nextDate = event.target.value;
    if (!nextDate || nextDate === date) return;
    invalidateAvailability();
    clearActiveBookingAttempt({ preserveCart: true });
    setDate(nextDate);
    resetAvailability();
    setError("");
    if (selectedVariationIds.length) void refreshAvailability({ requestedDate: nextDate, requestedVariationIds: selectedVariationIds });
  }

  async function submitBooking(event) {
    event.preventDefault();

    if (
      !selectedVariationIds.length ||
      !selectedSlot ||
      submittingRef.current ||
      retryAfterRemaining > 0
    ) {
      return;
    }

    if (!isCurrentAvailabilitySlot(selectedSlot, date, selectedVariationIds)) {
      clearActiveBookingAttempt({ preserveCart: true });
      setSelectedSlot(null);

      setError(
        "The selected time is no longer available. Please choose another time.",
      );

      await refreshAvailability({
        preserveError: true,
      });

      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    const activeAttempt = bookingAttempt || {
      bookingAttemptId: crypto.randomUUID(),
      variationIds: selectedVariationIds,
      startAt: selectedSlot.startAt,
      customer: {
        ...customer,
      },
      selectedVariations,
    };

    if (!bookingAttempt) {
      setBookingAttempt(activeAttempt);
      saveBookingAttempt(activeAttempt);
    }

    setError("");

    try {
      const data = await createSquareBooking({
        bookingAttemptId: activeAttempt.bookingAttemptId,
        variationIds: activeAttempt.variationIds,
        startAt: activeAttempt.startAt,
        customer: activeAttempt.customer,
      });

      clearActiveBookingAttempt();

      setConfirmation(data?.booking || {});
    } catch (requestError) {
      if (
        requestError.code === "SQUARE_RATE_LIMITED" &&
        requestError.retryable
      ) {
        const seconds = requestError.retryAfterSeconds;

        if (Number.isInteger(seconds) && seconds > 0) {
          setRetryAfterUntil(Date.now() + seconds * 1000);

          setError(
            `We're temporarily experiencing high demand. Please wait about ${seconds} second${
              seconds === 1 ? "" : "s"
            } and try again.`,
          );
        } else {
          setError(
            "We're temporarily experiencing high demand. Please wait a moment and try again.",
          );
        }
      } else {
        setError(requestError.message || "Unable to book this appointment.");
      }

      if (requestError.code === "SLOT_UNAVAILABLE") {
        clearActiveBookingAttempt({ preserveCart: true });

        await refreshAvailability({
          preserveError: true,
        });
      }

      if (requestError.code === "BOOKING_ATTEMPT_MISMATCH") {
        clearActiveBookingAttempt();
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return <BookingConfirmation confirmation={confirmation} />;
  }

  const visibleAvailability = availability.slice(0, visibleTimeCount);

  const hasMoreTimes = availability.length > visibleTimeCount;

  return (
    <main className="booking" aria-labelledby="booking-title">
      <section className="booking__panel booking__panel--flow">
        <BookingHeader />
        <BookingProgress step={step} />

        {error && (
          <p className="booking__error" role="alert">
            {error}
          </p>
        )}

        <div className="booking__content-layout booking__booking-grid">
          <div className="booking__flow">
            <ServiceSelector
              serviceSectionRef={serviceSectionRef}
              serviceSelectorCollapsed={serviceSelectorCollapsed}
              selectedVariations={selectedVariations}
              selectedServiceEstimate={selectedServiceEstimate}
              submitting={submitting}
              editServices={editServices}
              loadingServices={loadingServices}
              catalogError={catalogError}
              retryCatalog={retryCatalog}
              availableCategories={availableCategories}
              activeCategory={activeCategory}
              loadingCategory={loadingCategory}
              loadingCategoryId={loadingCategoryId}
              handleCategoryChange={handleCategoryChange}
              toggleVariation={toggleVariation}
            />
            {selectedVariations.length > 0 && (
              <DateSelector
                dateSectionRef={dateSectionRef}
                date={date}
                submitting={submitting}
                loadingAvailability={loadingAvailability}
                handleDateChange={handleDateChange}
                loadAvailability={loadAvailability}
              />
            )}

            <AvailabilityTimes
              hasSelectedVariations={selectedVariations.length > 0}
              loadingAvailability={loadingAvailability}
              availability={availability}
              visibleAvailability={visibleAvailability}
              selectedSlot={selectedSlot}
              submitting={submitting}
              handleTimeSelection={handleTimeSelection}
              hasPaginatedTimes={availability.length > INITIAL_MOBILE_TIMES}
              hasMoreTimes={hasMoreTimes}
              showMoreTimes={showMoreTimes}
              showFewerTimes={showFewerTimes}
              error={error}
              hasSearchedAvailability={hasSearchedAvailability}
            />

            {selectedSlot && (
              <CustomerDetails
                customer={customer}
                submitting={submitting}
                retryAfterRemaining={retryAfterRemaining}
                updateCustomer={updateCustomer}
                submitBooking={submitBooking}
              />
            )}
          </div>

          <aside
            className="booking__appointment booking__appointment--desktop"
            aria-label="Your appointment"
          >
            <AppointmentSummaryView
              selectedVariations={selectedVariations}
              selectedServiceEstimate={selectedServiceEstimate}
              date={date}
              selectedSlot={selectedSlot}
              removeVariation={removeVariation}
              submitting={submitting}
              onContinue={continueToDate}
              showContinue={!serviceSelectorCollapsed}
            />
          </aside>
        </div>
      </section>

      {selectedVariations.length > 0 && !mobileCartOpen && (
        <MobileBookingAction
          selectedVariations={selectedVariations}
          selectedServiceEstimate={selectedServiceEstimate}
          editServices={editServices}
          continueToDate={continueToDate}
          submitting={submitting}
        />
      )}

      <MobileCartSheetView
        isOpen={selectedVariations.length > 0 && mobileCartOpen}
        selectedVariations={selectedVariations}
        selectedServiceEstimate={selectedServiceEstimate}
        removeVariation={removeVariation}
        submitting={submitting}
        onClose={closeMobileCart}
      />
    </main>
  );
}

export default Booking;
