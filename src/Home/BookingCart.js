import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { loadBookingAttempt } from "../Booking/bookingAttemptStorage";
import {
  formatDuration,
  formatEstimatedDuration,
  formatPrice,
  formatServiceCount,
} from "../Booking/utils/bookingFormatters";
import "./BookingCart.css";

function getSelectionEstimate(selectedVariations) {
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
}

export default function BookingCart() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const cartRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);

  const selectedVariations = useMemo(
    () => loadBookingAttempt()?.selectedVariations || [],
    [],
  );

  const selectedServiceEstimate = useMemo(
    () => getSelectionEstimate(selectedVariations),
    [selectedVariations],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeOnOutsideInteraction(event) {
      if (!cartRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideInteraction);
    document.addEventListener("touchstart", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideInteraction);
      document.removeEventListener("touchstart", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  if (!selectedVariations.length) {
    return null;
  }

  function continueBooking() {
    setIsOpen(false);
    navigate("/book");
  }

  const selectionCount = selectedVariations.length;

  return (
    <div className="home-booking-cart" ref={cartRef}>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.section
            id="home-booking-cart-popup"
            className="home-booking-cart__popup"
            role="dialog"
            aria-modal="false"
            aria-labelledby="home-booking-cart-heading"
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    scale: 0.94,
                    y: 14,
                  }
            }
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
            exit={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 0,
                    scale: 0.96,
                    y: 10,
                  }
            }
            transition={{
              duration: shouldReduceMotion ? 0 : 0.42,
              ease: [0.22, 0.61, 0.36, 1],
            }}
          >
            <span
              className="home-booking-cart__corner home-booking-cart__corner--tl"
              aria-hidden="true"
            />

            <span
              className="home-booking-cart__corner home-booking-cart__corner--tr"
              aria-hidden="true"
            />

            <span
              className="home-booking-cart__corner home-booking-cart__corner--bl"
              aria-hidden="true"
            />

            <span
              className="home-booking-cart__corner home-booking-cart__corner--br"
              aria-hidden="true"
            />

            <div className="home-booking-cart__inner">
              <div className="home-booking-cart__ornament" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <div className="home-booking-cart__popup-heading">
                <div>
                  <p>{formatServiceCount(selectionCount)}</p>

                  <h2 id="home-booking-cart-heading">Your selection</h2>
                </div>

                <button
                  type="button"
                  className="home-booking-cart__close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close selected services"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div className="home-booking-cart__divider" aria-hidden="true" />

              <ul className="home-booking-cart__services">
                {selectedVariations.map((variation) => (
                  <li key={variation.id}>
                    <div>
                      <strong>
                        {variation.serviceName ||
                          variation.name ||
                          "Selected service"}
                      </strong>

                      <span>{formatDuration(variation.durationMs)}</span>
                    </div>

                    <span>{formatPrice(variation.priceMoney)}</span>
                  </li>
                ))}
              </ul>

              <dl className="home-booking-cart__estimate">
                <div>
                  <dt>{formatServiceCount(selectionCount)}</dt>

                  <dd>{formatPrice(selectedServiceEstimate.priceMoney)}</dd>
                </div>

                <div>
                  <dt>Estimated duration</dt>

                  <dd>
                    {formatEstimatedDuration(
                      selectedServiceEstimate.durationMs,
                    )}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                className="home-booking-cart__continue"
                onClick={continueBooking}
              >
                <span>Continue booking</span>
                <span
                  className="home-booking-cart__continue-arrow"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className={`home-booking-cart__toggle ${isOpen ? "is-open" : ""}`}
        aria-label={`View selected services, ${formatServiceCount(
          selectionCount,
        )}`}
        aria-expanded={isOpen}
        aria-controls="home-booking-cart-popup"
        onClick={() => setIsOpen((current) => !current)}
        initial={
          shouldReduceMotion
            ? false
            : {
                opacity: 0,
                scale: 0.86,
                y: 8,
              }
        }
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        whileHover={
          shouldReduceMotion
            ? undefined
            : {
                y: -3,
                scale: 1.025,
              }
        }
        whileTap={
          shouldReduceMotion
            ? undefined
            : {
                scale: 0.97,
              }
        }
        transition={{
          duration: shouldReduceMotion ? 0 : 0.46,
          ease: [0.22, 0.61, 0.36, 1],
        }}
      >
        <span className="home-booking-cart__toggle-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M5.5 8.5h13l-1 11h-11l-1-11Z" />
            <path d="M8.5 9V6.75a3.5 3.5 0 0 1 7 0V9" />
          </svg>
        </span>

        <span className="home-booking-cart__count">{selectionCount}</span>
      </motion.button>
    </div>
  );
}
