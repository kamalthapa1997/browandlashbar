import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getReviews } from "../api/reviewsService";
import "./Reviews.css";

function Star({ filled = true }) {
  return (
    <span
      className={`review-star ${filled ? "review-star--filled" : ""}`}
      aria-hidden="true"
    >
      ★
    </span>
  );
}

function getInitials(name) {
  if (!name || name === "Anonymous") return "A";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function ReviewStars({ rating = 5 }) {
  return (
    <div className="review-card__stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} filled={star <= Math.round(rating)} />
      ))}
    </div>
  );
}

function ReviewCard({ review, isDuplicate = false }) {
  const author = review.authorName || "Anonymous";
  const rating = Number(review.rating) || 5;

  return (
    <article className="review-card" aria-hidden={isDuplicate || undefined}>
      <div className="review-card__meta">
        <div className="review-card__reviewer">
          <div className="review-card__avatar" aria-hidden="true">
            {getInitials(author)}
          </div>

          <div className="review-card__author">
            <strong>{author}</strong>
            <span>{review.relativeTimeDescription || "Google review"}</span>
          </div>
        </div>

        <span className="review-card__google" aria-label="Posted on Google">
          <span className="review-card__google-icon" aria-hidden="true">G</span>
          <span className="review-card__google-label">Google</span>
        </span>
      </div>

      <ReviewStars rating={rating} />

      <blockquote className="review-card__text">{review.text}</blockquote>

      <div className="review-card__source">
        <span className="review-card__verified" aria-hidden="true">✓</span>
        Posted on Google
      </div>
    </article>
  );
}

export default function Reviews() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const carouselRef = useRef(null);
  const animationFrameRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const isPausedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    getReviews()
      .then((res) => {
        if (!mounted) return;
        setData(res);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || "Unable to load reviews");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const reviews = useMemo(() => {
    if (!data?.reviews?.length) return [];

    return data.reviews.filter((review) => {
      const rating = Number(review?.rating);

      return review?.text && (rating === 4.9 || rating === 5);
    });
  }, [data]);

  const pauseAutoplay = useCallback(() => {
    isPausedRef.current = true;
    window.clearTimeout(resumeTimerRef.current);
  }, []);

  const resumeAutoplay = useCallback((delay = 1200) => {
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      isPausedRef.current = false;
    }, delay);
  }, []);

  useEffect(() => {
    const carousel = carouselRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastTimestamp = null;

    const animate = (timestamp) => {
      if (!reducedMotion.matches && !isPausedRef.current && carousel) {
        const duplicateStart = carousel.querySelector(
          '.review-card[aria-hidden="true"]',
        );
        const loopPoint = duplicateStart?.offsetLeft || 0;

        if (loopPoint > carousel.clientWidth) {
          const elapsed = lastTimestamp ? timestamp - lastTimestamp : 0;
          carousel.scrollLeft += elapsed * 0.018;

          if (carousel.scrollLeft >= loopPoint) {
            carousel.scrollLeft -= loopPoint;
          }
        }
      }

      lastTimestamp = timestamp;
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
      window.clearTimeout(resumeTimerRef.current);
    };
  }, [reviews]);

  if (loading) {
    return (
      <section className="reviews-section reviews-section--loading">
        <div className="reviews-loading">
          <div className="reviews-loading__stars">★ ★ ★ ★ ★</div>

          <span>Loading client reviews...</span>
        </div>
      </section>
    );
  }

  if (error || !reviews.length) {
    return null;
  }

  const rating = data.rating ? Number(data.rating).toFixed(1) : "5.0";
  const reviewCount = data.userRatingCount || reviews.length;

  const marqueeReviews = [...reviews, ...reviews];

  return (
    <section className="reviews-section" aria-labelledby="reviews-heading">
      <div className="reviews-inner">
        <header className="reviews-header">
          <div className="reviews-heading">
            <span className="reviews-eyebrow">Client experiences</span>

            <h2 id="reviews-heading">What Our Clients Say</h2>

            <p>
              Thoughtful service and beautiful results, shared by our clients.
            </p>
          </div>

          <div className="reviews-rating">
            <div className="reviews-rating__score">{rating}</div>

            <div className="reviews-rating__details">
              <div className="reviews-rating__stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} />
                ))}
              </div>

              <span>{reviewCount.toLocaleString()} Google reviews</span>
            </div>
          </div>
        </header>

        <div className="reviews-carousel">
          <div
            className="reviews-carousel__viewport"
            ref={carouselRef}
            aria-label="Client reviews"
            tabIndex="0"
            onMouseEnter={pauseAutoplay}
            onMouseLeave={() => resumeAutoplay(300)}
            onFocus={pauseAutoplay}
            onBlur={() => resumeAutoplay()}
            onPointerDown={pauseAutoplay}
            onPointerUp={() => resumeAutoplay()}
            onPointerCancel={() => resumeAutoplay()}
            onWheel={() => {
              pauseAutoplay();
              resumeAutoplay(1800);
            }}
          >
            {marqueeReviews.map((review, index) => (
              <ReviewCard
                review={review}
                isDuplicate={index >= reviews.length}
                key={`${review.authorName || "review"}-${review.time || index}-${index}`}
              />
            ))}
          </div>
        </div>

        {data.googleMapsUrl && (
          <div className="reviews-footer">
            <a
              href={data.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="reviews-google-link"
            >
              <span className="reviews-google-link__icon">G</span>

              <span>Read all reviews on Google</span>

              <span className="reviews-google-link__arrow">↗</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
