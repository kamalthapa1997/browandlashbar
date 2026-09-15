import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSquareBooking } from "../api/squareService";
import {
  clearBookingAttempt as clearStoredBookingAttempt,
  loadBookingAttempt,
  saveBookingAttempt,
} from "./bookingAttemptStorage";
import {
  getEasternDate,
  getEasternDateForInstant,
  getEasternMaxBookingDate,
} from "./utils/bookingFormatters";
import {
  canonicalizeVariationIds,
  isCurrentAvailabilitySlot,
} from "./utils/bookingHelpers";
import { normalizeUsPhoneNumber } from "./utils/phoneNumber";
import AppointmentSummaryView from "./components/AppointmentSummary";
import MobileBookingAction, {
  MobileCartSheet as MobileCartSheetView,
} from "./components/MobileBookingAction";
import ServiceSelector from "./components/ServiceSelector";
import DateSelector from "./components/DateSelector";
import AvailabilityTimes from "./components/AvailabilityTimes";
import CustomerDetails from "./components/CustomerDetails";
import BookingReview from "./components/BookingReview";
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

export function findFirstAvailableDate(
  availabilityByDate,
  startDate,
  maximumDate,
) {
  if (!startDate || !maximumDate || startDate > maximumDate) return "";

  const current = new Date(`${startDate}T12:00:00Z`);
  const finalDate = new Date(`${maximumDate}T12:00:00Z`);

  while (current <= finalDate) {
    const value = current.toISOString().slice(0, 10);

    if (
      Array.isArray(availabilityByDate?.[value]) &&
      availabilityByDate[value].length
    ) {
      return value;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return "";
}

export function getReviewTransition(selectedVariations) {
  if (!Array.isArray(selectedVariations) || !selectedVariations.length) {
    return {
      reviewingBooking: false,
      reviewValidationMessage: "Please select at least one service to continue.",
    };
  }

  return { reviewingBooking: true, reviewValidationMessage: "" };
}

function Booking() {
  const recoveredBookingState = useRef(loadBookingAttempt()).current;
  const recoveredAttempt = useRef(
    recoveredBookingState?.bookingAttemptId
      ? {
          bookingAttemptId: recoveredBookingState.bookingAttemptId,
          variationIds: recoveredBookingState.variationIds,
          startAt: recoveredBookingState.startAt,
          customer: recoveredBookingState.customer,
          selectedVariations: recoveredBookingState.selectedVariations,
        }
      : null,
  ).current;
  const recoveredCart = recoveredBookingState?.selectedVariations || [];
  const recoveredSlot = useRef(
    recoveredBookingState?.selectedSlot ||
      (recoveredAttempt
        ? {
            startAt: recoveredAttempt.startAt,
            availabilityDate: getEasternDateForInstant(
              recoveredAttempt.startAt,
            ),
            variationIds: recoveredAttempt.variationIds,
          }
        : null),
  ).current;
  const recoveredDate =
    recoveredBookingState?.date ||
    recoveredSlot?.availabilityDate ||
    getEasternDate();
  const recoveryRef = useRef({
    catalogReconciled: !recoveredBookingState,
    slotRevalidated: !recoveredSlot,
    reviewingBooking: Boolean(recoveredBookingState?.reviewingBooking),
  });

  const [serviceSelectorCollapsed, setServiceSelectorCollapsed] = useState(
    Boolean(recoveredAttempt),
  );

  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const [selectedVariations, setSelectedVariations] = useState(recoveredCart);

  const [date, setDate] = useState(recoveredDate);

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
  const [reviewValidationMessage, setReviewValidationMessage] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const [customer, setCustomer] = useState(
    recoveredBookingState?.customer || {
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
    },
  );
  const [reviewingBooking, setReviewingBooking] = useState(false);
  const [recoveringSlot, setRecoveringSlot] = useState(Boolean(recoveredSlot));

  const [bookingAttempt, setBookingAttempt] = useState(recoveredAttempt);

  const submittingRef = useRef(false);

  const dateSectionRef = useRef(null);
  const serviceSectionRef = useRef(null);
  const customerDetailsSectionRef = useRef(null);

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

  const clearActiveBookingAttempt = useCallback(() => {
    // The attempt ID is immutable server-side. A change to appointment or
    // customer data needs a fresh ID, but must not throw away the draft.
    setBookingAttempt(null);
  }, []);

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
    availability,
    selectedSlot,
    loadingAvailability,
    hasSearchedAvailability,
    visibleTimeCount,
    invalidateAvailability,
    resetAvailability,
    refreshAvailability,
    revalidateRecoveredSlot,
    loadAvailability,
    handleTimeSelection,
    showMoreTimes,
    showFewerTimes,
    setSelectedSlot,
    availabilityByDate,
    calendarAvailabilityStatus,
    calendarAvailabilityError,
    invalidateCalendarAvailability,
    loadCalendarAvailability,
  } = useBookingAvailability({
    date,
    selectedVariationIds,
    submitting,
    clearActiveBookingAttempt,
    setError,
    uiDelay: UI_DELAY,
    initialVisibleTimes: INITIAL_MOBILE_TIMES,
    visibleTimeIncrement: MOBILE_TIME_INCREMENT,
    initialSelectedSlot: recoveredSlot,
  });

  const selectSlot = useCallback(
    (slot) => {
      setReviewingBooking(false);
      handleTimeSelection(slot);
    },
    [handleTimeSelection],
  );

  useEffect(() => {
    if (!selectedSlot) setReviewingBooking(false);
  }, [selectedSlot]);

  useEffect(() => {
    if (!selectedVariations.length) {
      setReviewingBooking(false);
      return;
    }

    setReviewValidationMessage("");
  }, [selectedVariations.length]);

  useEffect(() => {
    if (recoveryRef.current.catalogReconciled || !recoveredBookingState) {
      return;
    }

    if (!variations.length) return;

    const recoveredVariations = recoveredBookingState.variationIds.map(
      (variationId) => variations.find((item) => item.id === variationId),
    );

    if (recoveredVariations.some((variation) => !variation)) {
      clearStoredBookingAttempt();
      setBookingAttempt(null);
      setSelectedVariations([]);
      setSelectedSlot(null);
      setServiceSelectorCollapsed(false);
      setRecoveringSlot(false);
      recoveryRef.current.catalogReconciled = true;
      return;
    }

    setSelectedVariations(recoveredVariations);
    setServiceSelectorCollapsed(Boolean(recoveredAttempt));
    setMobileCartOpen(false);
    recoveryRef.current.catalogReconciled = true;
  }, [recoveredAttempt, recoveredBookingState, setSelectedSlot, variations]);

  useEffect(() => {
    if (
      recoveryRef.current.slotRevalidated ||
      !recoveredSlot ||
      !recoveryRef.current.catalogReconciled ||
      selectedVariationIds.join(",") !== recoveredSlot.variationIds.join(",")
    ) {
      return;
    }

    if (!isCurrentAvailabilitySlot(recoveredSlot, date, selectedVariationIds)) {
      recoveryRef.current.slotRevalidated = true;
      setSelectedSlot(null);
      setBookingAttempt(null);
      setRecoveringSlot(false);
      setError(
        "Your saved appointment time is no longer valid. Please choose another time.",
      );
      return;
    }

    recoveryRef.current.slotRevalidated = true;
    void revalidateRecoveredSlot(recoveredSlot).then((isAvailable) => {
      setRecoveringSlot(false);
      if (isAvailable) {
        const hasRequiredCustomerDetails = [
          "firstName",
          "lastName",
          "phone",
        ].every((field) => customer[field]?.trim());
        setReviewingBooking(
          recoveryRef.current.reviewingBooking && hasRequiredCustomerDetails,
        );
        return;
      }

      setReviewingBooking(false);
      if (isAvailable === false) {
        setBookingAttempt(null);
        setError(
          "The selected time is no longer available. Please choose another time.",
        );
      }
    });
  }, [
    customer,
    date,
    recoveredSlot,
    revalidateRecoveredSlot,
    selectedVariationIds,
    setSelectedSlot,
  ]);

  useEffect(() => {
    if (!recoveryRef.current.catalogReconciled) return;

    if (confirmation) {
      clearStoredBookingAttempt();
      return;
    }

    if (!selectedVariationIds.length) {
      clearStoredBookingAttempt();
      return;
    }

    const currentSlot = isCurrentAvailabilitySlot(
      selectedSlot,
      date,
      selectedVariationIds,
    )
      ? selectedSlot
      : null;
    const currentAttempt =
      bookingAttempt &&
      bookingAttempt.startAt === currentSlot?.startAt &&
      canonicalizeVariationIds(bookingAttempt.variationIds).join(",") ===
        selectedVariationIds.join(",")
        ? bookingAttempt
        : null;

    saveBookingAttempt({
      variationIds: selectedVariationIds,
      selectedVariations,
      date,
      ...(currentSlot ? { selectedSlot: currentSlot } : {}),
      customer,
      reviewingBooking: Boolean(
        reviewingBooking &&
        currentSlot &&
        ["firstName", "lastName", "phone"].every((field) =>
          customer[field]?.trim(),
        ),
      ),
      ...(currentAttempt
        ? {
            bookingAttemptId: currentAttempt.bookingAttemptId,
            startAt: currentAttempt.startAt,
          }
        : {}),
    });
  }, [
    bookingAttempt,
    confirmation,
    customer,
    date,
    reviewingBooking,
    selectedSlot,
    selectedVariationIds,
    selectedVariations,
  ]);

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

  function updateCustomer(field, value) {
    if (bookingAttempt) {
      clearActiveBookingAttempt();
    }

    setReviewingBooking(false);
    setCustomer((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSelectedVariations(nextSelectedVariations) {
    invalidateAvailability();
    invalidateCalendarAvailability();
    clearActiveBookingAttempt();
    setSelectedVariations(nextSelectedVariations);
    resetAvailability();
    setReviewingBooking(false);
    if (nextSelectedVariations.length) setReviewValidationMessage("");
    setError("");
    if (!nextSelectedVariations.length) {
      setServiceSelectorCollapsed(false);
      setMobileCartOpen(false);
    }
  }

  function toggleVariation(variation) {
    if (submitting || loadingAvailability) return;
    const isSelected = selectedVariations.some(
      (item) => item.id === variation.id,
    );
    if (isSelected) {
      updateSelectedVariations(
        selectedVariations.filter((item) => item.id !== variation.id),
      );
      return;
    }
    updateSelectedVariations([...selectedVariations, variation]);
  }

  function continueToDate() {
    if (!selectedVariations.length || submitting) return;
    setServiceSelectorCollapsed(true);
    setMobileCartOpen(false);
    window.requestAnimationFrame(() => {
      dateSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function continueFromMobile() {
    if (!selectedVariations.length || submitting) return;

    if (selectedSlot) {
      setServiceSelectorCollapsed(true);
      setMobileCartOpen(false);
      window.requestAnimationFrame(() => {
        customerDetailsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    continueToDate();
  }

  function editServices() {
    setServiceSelectorCollapsed(false);
    setMobileCartOpen(true);
    window.requestAnimationFrame(() => {
      serviceSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function closeMobileCart() {
    setMobileCartOpen(false);
  }
  function removeVariation(variationId) {
    updateSelectedVariations(
      selectedVariations.filter((variation) => variation.id !== variationId),
    );
  }

  function startReview() {
    const transition = getReviewTransition(selectedVariations);
    setReviewingBooking(transition.reviewingBooking);
    setReviewValidationMessage(transition.reviewValidationMessage);
  }

  function handleDateChange(event) {
    const nextDate = event.target.value;
    if (!nextDate || nextDate === date) return;
    invalidateAvailability();
    clearActiveBookingAttempt();
    setDate(nextDate);
    resetAvailability();
    setReviewingBooking(false);
    setError("");
    if (selectedVariationIds.length)
      void refreshAvailability({
        requestedDate: nextDate,
        requestedVariationIds: selectedVariationIds,
      });
  }

  useEffect(() => {
    if (
      !selectedVariationIds.length ||
      calendarAvailabilityStatus !== "success"
    ) {
      return;
    }

    const minimumDate = getEasternDate();
    const maximumDate = getEasternMaxBookingDate();
    const selectedDateHasAvailability =
      Boolean(date) &&
      Array.isArray(availabilityByDate?.[date]) &&
      availabilityByDate[date].length > 0;

    if (selectedDateHasAvailability) return;

    const searchStart =
      date && date >= minimumDate && date <= maximumDate ? date : minimumDate;
    const nextAvailableDate = findFirstAvailableDate(
      availabilityByDate,
      searchStart,
      maximumDate,
    );

    if (!nextAvailableDate && !date && !selectedSlot) return;

    invalidateAvailability();
    clearActiveBookingAttempt();
    resetAvailability();
    setError("");

    if (!nextAvailableDate) {
      setDate("");
      return;
    }

    setDate(nextAvailableDate);
  }, [
    availabilityByDate,
    calendarAvailabilityStatus,
    clearActiveBookingAttempt,
    date,
    invalidateAvailability,
    resetAvailability,
    selectedVariationIds,
    selectedSlot,
  ]);

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
      clearActiveBookingAttempt();
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

    const activeAttempt = bookingAttempt
      ? {
          ...bookingAttempt,
          customer: {
            ...bookingAttempt.customer,
            phone: normalizeUsPhoneNumber(bookingAttempt.customer.phone),
          },
        }
      : {
          bookingAttemptId: crypto.randomUUID(),
          variationIds: selectedVariationIds,
          startAt: selectedSlot.startAt,
          customer: {
            ...customer,
            phone: normalizeUsPhoneNumber(customer.phone),
          },
          selectedVariations,
        };

    if (!bookingAttempt) {
      setBookingAttempt(activeAttempt);
      // Persist the immutable attempt before issuing the request. A refresh
      // during submission will therefore recover an ID that the server can
      // safely de-duplicate, but never auto-submit it.
      saveBookingAttempt({
        variationIds: activeAttempt.variationIds,
        selectedVariations,
        date,
        selectedSlot,
        customer: activeAttempt.customer,
        reviewingBooking: true,
        bookingAttemptId: activeAttempt.bookingAttemptId,
        startAt: activeAttempt.startAt,
      });
    }

    setError("");

    try {
      const data = await createSquareBooking({
        bookingAttemptId: activeAttempt.bookingAttemptId,
        variationIds: activeAttempt.variationIds,
        startAt: activeAttempt.startAt,
        customer: activeAttempt.customer,
      });

      clearStoredBookingAttempt();
      setBookingAttempt(null);

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
        clearActiveBookingAttempt();

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
                availabilityByDate={availabilityByDate}
                calendarAvailabilityStatus={calendarAvailabilityStatus}
                calendarAvailabilityError={calendarAvailabilityError}
                retryCalendarAvailability={() => {
                  void loadCalendarAvailability({ force: true });
                }}
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
              handleTimeSelection={selectSlot}
              hasPaginatedTimes={availability.length > INITIAL_MOBILE_TIMES}
              hasMoreTimes={hasMoreTimes}
              showMoreTimes={showMoreTimes}
              showFewerTimes={showFewerTimes}
              error={error}
              hasSearchedAvailability={hasSearchedAvailability}
            />

            {selectedSlot &&
              !recoveringSlot &&
              (reviewingBooking ? (
                <BookingReview
                  customer={customer}
                  selectedVariations={selectedVariations}
                  selectedServiceEstimate={selectedServiceEstimate}
                  date={date}
                  selectedSlot={selectedSlot}
                  submitting={submitting}
                  retryAfterRemaining={retryAfterRemaining}
                  onBack={() => setReviewingBooking(false)}
                  onConfirm={submitBooking}
                />
              ) : (
                <CustomerDetails
                  customerDetailsSectionRef={customerDetailsSectionRef}
                  customer={customer}
                  submitting={submitting}
                  retryAfterRemaining={retryAfterRemaining}
                  updateCustomer={updateCustomer}
                  hasSelectedVariations={selectedVariations.length > 0}
                  reviewValidationMessage={reviewValidationMessage}
                  onReview={startReview}
                />
              ))}
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

            <div className="booking__appointment-image" aria-hidden="true">
              <img src="/booking-decorative-art.png" alt="" />
            </div>
          </aside>
        </div>
      </section>

      {selectedVariations.length > 0 && !mobileCartOpen && (
        <MobileBookingAction
          selectedVariations={selectedVariations}
          selectedServiceEstimate={selectedServiceEstimate}
          editServices={editServices}
          continueToDate={continueFromMobile}
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
