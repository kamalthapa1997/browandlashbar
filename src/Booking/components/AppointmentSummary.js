import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  formatAppointmentDate,
  formatDuration,
  formatEstimatedDuration,
  formatPrice,
  formatServiceCount,
  formatTime,
} from "../utils/bookingFormatters";
import { getSelectedServiceIdentity } from "../utils/serviceIdentity";

function measureCardHeight(card, content) {
  const styles = window.getComputedStyle(card);
  const paddingAndBorder =
    parseFloat(styles.paddingTop) +
    parseFloat(styles.paddingBottom) +
    parseFloat(styles.borderTopWidth) +
    parseFloat(styles.borderBottomWidth);
  const minimumHeight = parseFloat(styles.minBlockSize || styles.minHeight) || 0;

  return Math.max(content.getBoundingClientRect().height + paddingAndBorder, minimumHeight);
}

function useAnimatedCardHeight(
  selectedVariations,
  selectedSlot,
  showContinue,
  date,
) {
  const cardRef = useRef(null);
  const contentRef = useRef(null);
  const previousHeightRef = useRef(null);
  const animationFrameRef = useRef(null);

  function updateHeight() {
    const card = cardRef.current;
    const content = contentRef.current;

    if (!card || !content) return;

    const nextHeight = measureCardHeight(card, content);

    if (previousHeightRef.current === null) {
      previousHeightRef.current = nextHeight;
      return;
    }

    if (Math.abs(nextHeight - previousHeightRef.current) < 0.5) {
      return;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      card.style.height = "";
      previousHeightRef.current = nextHeight;
      return;
    }

    const currentHeight = card.style.height
      ? card.getBoundingClientRect().height
      : previousHeightRef.current;

    window.cancelAnimationFrame(animationFrameRef.current);
    card.style.transition = "none";
    card.style.height = `${currentHeight}px`;
    void card.offsetHeight;
    card.style.transition = "";

    animationFrameRef.current = window.requestAnimationFrame(() => {
      card.style.height = `${nextHeight}px`;
    });
    previousHeightRef.current = nextHeight;
  }

  useLayoutEffect(() => {
    updateHeight();
  }, [selectedVariations, selectedSlot, showContinue, date]);

  useEffect(() => {
    const content = contentRef.current;

    if (!content || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);

    return () => observer.disconnect();
  }, [selectedVariations, selectedSlot, showContinue, date]);

  useEffect(() => {
    const card = cardRef.current;

    if (!card) return undefined;

    function restoreNaturalHeight(event) {
      if (event.target !== card || event.propertyName !== "height") return;

      card.style.height = "";
      previousHeightRef.current = measureCardHeight(card, contentRef.current);
    }

    card.addEventListener("transitionend", restoreNaturalHeight);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      card.removeEventListener("transitionend", restoreNaturalHeight);
    };
  }, []);

  return { cardRef, contentRef };
}

function useContentTransition(
  hasSelectedServices,
  selectedSlot,
  showContinue,
  date,
) {
  const [phase, setPhase] = useState("settled");
  const hasMountedRef = useRef(false);
  const animationFrameRef = useRef(null);

  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return undefined;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPhase("settled");
      return undefined;
    }

    setPhase("preparing");
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = window.requestAnimationFrame(() => {
      setPhase("settled");
    });

    return () => window.cancelAnimationFrame(animationFrameRef.current);
  }, [hasSelectedServices, selectedSlot, showContinue, date]);

  return phase;
}

function AnimatedSelectedServiceList({
  selectedVariations,
  removeVariation,
  submitting,
}) {
  const [displayedVariations, setDisplayedVariations] = useState(() =>
    selectedVariations.map((variation) => ({ variation, phase: "entered" })),
  );
  const entryAnimationFrameRef = useRef(null);

  useEffect(() => {
    setDisplayedVariations((current) => {
      const currentById = new Map(
        current.map((entry) => [entry.variation.id, entry]),
      );
      const selectedIds = new Set(
        selectedVariations.map((variation) => variation.id),
      );
      const activeVariations = selectedVariations.map((variation) => {
        const currentEntry = currentById.get(variation.id);

        return currentEntry
          ? {
              ...currentEntry,
              variation,
              phase:
                currentEntry.phase === "exiting" ? "entering" : currentEntry.phase,
            }
          : { variation, phase: "entering" };
      });
      const exitingVariations = current
        .filter((entry) => !selectedIds.has(entry.variation.id))
        .map((entry) => ({ ...entry, phase: "exiting" }));

      return [...activeVariations, ...exitingVariations];
    });
  }, [selectedVariations]);

  useEffect(() => {
    if (!displayedVariations.some((entry) => entry.phase === "entering")) {
      return undefined;
    }

    entryAnimationFrameRef.current = window.requestAnimationFrame(() => {
      setDisplayedVariations((current) =>
        current.map((entry) =>
          entry.phase === "entering" ? { ...entry, phase: "entered" } : entry,
        ),
      );
    });

    return () => window.cancelAnimationFrame(entryAnimationFrameRef.current);
  }, [displayedVariations]);

  function removeExitedVariation(variationId, event) {
    if (event.propertyName !== "max-height") return;

    setDisplayedVariations((current) =>
      current.filter(
        (entry) =>
          entry.variation.id !== variationId || entry.phase !== "exiting",
      ),
    );
  }

  return (
    <ul className="booking__selection-list">
      {displayedVariations.map(({ variation, phase }) => (
        <li
          key={variation.id}
          className={`booking__selection-list-item booking__selection-list-item--${phase}`}
          onTransitionEnd={(event) => removeExitedVariation(variation.id, event)}
        >
          <span className="booking__selection-entry">
            <span className="booking__selection-name">
              {getSelectedServiceIdentity(variation)}
            </span>
          </span>
          <button
            type="button"
            onClick={() => removeVariation(variation.id)}
            disabled={submitting || phase === "exiting"}
            aria-label={`Remove ${getSelectedServiceIdentity(variation)}`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SelectedServiceList({
  selectedVariations,
  removeVariation,
  submitting,
  showVariationDetails = false,
}) {
  return (
    <ul className="booking__selection-list">
      {selectedVariations.map((variation) => (
        <li key={variation.id}>
          <span className="booking__selection-entry">
            <span className="booking__selection-name">
              {getSelectedServiceIdentity(variation)}
            </span>
            {showVariationDetails && (
              <span className="booking__selection-meta">
                {formatDuration(variation.durationMs)} ·{" "}
                {formatPrice(variation.priceMoney)}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => removeVariation(variation.id)}
            disabled={submitting}
            aria-label={`Remove ${getSelectedServiceIdentity(variation)}`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function AppointmentSummary({
  selectedVariations,
  selectedServiceEstimate,
  date,
  selectedSlot,
  removeVariation,
  submitting,
  onContinue,
  showContinue = true,
}) {
  const hasSelectedServices = selectedVariations.length > 0;
  const { cardRef, contentRef } = useAnimatedCardHeight(
    selectedVariations,
    selectedSlot,
    showContinue,
    date,
  );
  const contentTransitionPhase = useContentTransition(
    hasSelectedServices,
    selectedSlot,
    showContinue,
    date,
  );

  return (
    <div className="booking__appointment-card" ref={cardRef}>
      <div
        className={`booking__appointment-card-content booking__appointment-card-content--${contentTransitionPhase}`}
        ref={contentRef}
      >
        <div className="booking__selection-summary-heading">
          <div className="booking__summary-title">
            {hasSelectedServices && (
              <p className="booking__selection-summary-eyebrow">
                {formatServiceCount(selectedVariations.length)}
              </p>
            )}
            <h3>Your appointment</h3>
          </div>
          {hasSelectedServices && (
            <div className="booking__selection-summary-estimate">
              <strong>{formatPrice(selectedServiceEstimate.priceMoney)}</strong>
              <span>
                {formatEstimatedDuration(selectedServiceEstimate.durationMs)}
              </span>
            </div>
          )}
        </div>

        {hasSelectedServices ? (
          <>
            <AnimatedSelectedServiceList
              selectedVariations={selectedVariations}
              removeVariation={removeVariation}
              submitting={submitting}
            />
            <dl className="booking__appointment-details">
              <div>
                <dt>Preferred date</dt>
                <dd>{formatAppointmentDate(date)}</dd>
              </div>
              {selectedSlot && (
                <div>
                  <dt>Appointment time</dt>
                  <dd>{formatTime(selectedSlot.startAt)}</dd>
                </div>
              )}
            </dl>
            {showContinue && (
              <button
                className="booking__button booking__appointment-cta"
                type="button"
                onClick={onContinue}
                disabled={submitting}
              >
                Continue to date <span aria-hidden="true">→</span>
              </button>
            )}
          </>
        ) : (
          <div className="booking__appointment-empty">
            <p className="booking__appointment-empty-message">
              Select a service to get started.
            </p>
            <p>Selected services will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
