import React, { useEffect, useMemo, useRef, useState } from "react";
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

function ReviewCard({ review }) {
  const author = review.authorName || "Anonymous";
  const rating = Number(review.rating) || 5;

  return (
    <article className="review-card">
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

    return data.reviews.filter((review) => review && review.text);
  }, [data]);

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

  const scrollReviews = (direction) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const firstCard = carousel.querySelector(".review-card");
    const gap = Number.parseFloat(getComputedStyle(carousel).gap) || 0;
    const amount = firstCard
      ? firstCard.offsetWidth + gap
      : carousel.clientWidth * 0.85;

    carousel.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

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
            className="reviews-carousel__controls"
            aria-label="Review carousel controls"
          >
            <button
              type="button"
              className="reviews-nav reviews-nav--left"
              onClick={() => scrollReviews(-1)}
              aria-label="Previous reviews"
            >
              <span aria-hidden="true">←</span>
            </button>

            <button
              type="button"
              className="reviews-nav reviews-nav--right"
              onClick={() => scrollReviews(1)}
              aria-label="Next reviews"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div
            className="reviews-carousel__viewport"
            ref={carouselRef}
            aria-label="Client reviews"
            tabIndex="0"
          >
            {reviews.map((review, index) => (
              <ReviewCard
                review={review}
                key={`${review.authorName || "review"}-${review.time || index}`}
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
