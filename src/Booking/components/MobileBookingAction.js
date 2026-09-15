import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  formatDuration,
  formatEstimatedDuration,
  formatPrice,
  formatServiceCount,
} from "../utils/bookingFormatters";
import { SelectedServiceList } from "./AppointmentSummary";

export function MobileCartSheet({
  isOpen,
  selectedVariations,
  selectedServiceEstimate,
  removeVariation,
  submitting,
  onClose,
}) {
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="booking__mobile-sheet"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.46,
            ease: [0.22, 0.61, 0.36, 1],
          }}
        >
          <button
            type="button"
            className="booking__mobile-sheet-backdrop"
            aria-label="Close selected services editor"
            onClick={onClose}
          />
          <motion.section
            className="booking__mobile-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-cart-heading"
            initial={shouldReduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={shouldReduceMotion ? undefined : { y: "100%" }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.52,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            <span className="booking__mobile-sheet-handle" aria-hidden="true" />
            <header className="booking__mobile-sheet-header">
              <div>
                <p className="booking__selection-summary-eyebrow">
                  Your selection
                </p>
                <h2 id="mobile-cart-heading">Edit services</h2>
              </div>
              <div className="booking__mobile-sheet-total">
                <strong>
                  {formatPrice(selectedServiceEstimate.priceMoney)}
                </strong>
                <span>
                  {formatEstimatedDuration(selectedServiceEstimate.durationMs)}
                </span>
              </div>
            </header>
            <SelectedServiceList
              selectedVariations={selectedVariations}
              removeVariation={removeVariation}
              submitting={submitting}
              showVariationDetails
            />
            <footer className="booking__mobile-sheet-footer">
              <button
                type="button"
                className="booking__mobile-sheet-done"
                onClick={onClose}
                disabled={submitting}
              >
                Done editing
              </button>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function MobileBookingAction({
  selectedVariations,
  selectedServiceEstimate,
  editServices,
  continueToDate,
  submitting,
}) {
  return (
    <div className="booking__mobile-action" aria-label="Appointment summary">
      <div className="booking__mobile-action-info">
        <strong>{formatServiceCount(selectedVariations.length)}</strong>
        <span>
          {formatPrice(selectedServiceEstimate.priceMoney)} ·{" "}
          {formatDuration(selectedServiceEstimate.durationMs)}
        </span>
      </div>
      <div className="booking__mobile-action-buttons">
        <button
          type="button"
          className="booking__mobile-edit"
          onClick={editServices}
          disabled={submitting}
        >
          Edit
        </button>
        <button
          type="button"
          className="booking__mobile-continue"
          onClick={continueToDate}
          disabled={submitting}
        >
          Continue <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
