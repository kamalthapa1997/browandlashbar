import { useEffect, useMemo, useState } from "react";
import { getReviews } from "../api/reviewsService";
import "./Reviews.css";

function Star({ filled = true }) {
  return (
    <span
      className={`reviews-section__star ${
        filled ? "reviews-section__star--filled" : ""
      }`}
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
    <div
      className="reviews-section__card-stars"
      aria-label={`${rating} out of 5 stars`}
    >
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
    <article
      className="reviews-section__card"
      aria-hidden={isDuplicate || undefined}
    >
      <div className="reviews-section__card-meta">
        <div className="reviews-section__card-reviewer">
          <div className="reviews-section__card-avatar" aria-hidden="true">
            {getInitials(author)}
          </div>

          <div className="reviews-section__card-author">
            <strong>{author}</strong>
            <span>{review.relativeTimeDescription || "Google review"}</span>
          </div>
        </div>

        <span
          className="reviews-section__card-google"
          aria-label="Posted on Google"
        >
          <span
            className="reviews-section__card-google-icon"
            aria-hidden="true"
          >
            G
          </span>
          <span className="reviews-section__card-google-label">Google</span>
        </span>
      </div>

      <ReviewStars rating={rating} />

      <blockquote className="reviews-section__card-text">
        {review.text}
      </blockquote>

      <div className="reviews-section__card-source">
        <span className="reviews-section__card-verified" aria-hidden="true">
          ✓
        </span>
        Posted on Google
      </div>
    </article>
  );
}

export default function Reviews() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <section className="reviews-section reviews-section--loading">
        <div className="reviews-section__loading">
          <div className="reviews-section__loading-stars">★ ★ ★ ★ ★</div>

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

  const reviewsPerGroup = Math.max(4, reviews.length);
  const marqueeReviews = Array.from(
    { length: Math.ceil(reviewsPerGroup / reviews.length) },
    () => reviews,
  )
    .flat()
    .slice(0, reviewsPerGroup);

  return (
    <section className="reviews-section" aria-labelledby="reviews-heading">
      <div className="reviews-section__inner">
        <header className="reviews-section__header">
          <div className="reviews-section__heading">
            <span className="reviews-section__eyebrow">Client experiences</span>

            <h2 id="reviews-heading">What Our Clients Say</h2>

            <p>
              Thoughtful service and beautiful results, shared by our clients.
            </p>
          </div>

          <div className="reviews-section__rating">
            <div className="reviews-section__rating-score">{rating}</div>

            <div className="reviews-section__rating-details">
              <div className="reviews-section__rating-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} />
                ))}
              </div>

              <span>{reviewCount.toLocaleString()} Google reviews</span>
            </div>
          </div>
        </header>

        <div className="reviews-section__carousel">
          <div
            className="reviews-section__carousel-viewport"
            aria-label="Client reviews"
            tabIndex="0"
          >
            <div className="reviews-section__marquee">
              <div className="reviews-section__group">
                {marqueeReviews.map((review, index) => (
                  <ReviewCard
                    review={review}
                    isDuplicate={index >= reviews.length}
                    key={`original-${review.authorName || "review"}-${review.time || index}-${index}`}
                  />
                ))}
              </div>
              <div className="reviews-section__group" aria-hidden="true">
                {marqueeReviews.map((review, index) => (
                  <ReviewCard
                    review={review}
                    isDuplicate
                    key={`duplicate-${review.authorName || "review"}-${review.time || index}-${index}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {data.googleMapsUrl && (
          <div className="reviews-section__footer">
            <a
              href={data.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="reviews-section__google-link"
            >
              <span className="reviews-section__google-link-icon">G</span>

              <span>Read all reviews on Google</span>

              <span className="reviews-section__google-link-arrow">↗</span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
