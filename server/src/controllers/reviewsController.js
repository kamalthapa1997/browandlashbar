const https = require("https");
const createHttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");

const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

let cache = {
  ts: 0,
  data: null,
};

function cleanGoogleResponse(payload) {
  // Payload is expected to be the Place Details result.
  const result = payload || {};

  // New Places API may return the place directly,
  // while the legacy API used a `result` wrapper.
  const place = result.result || result;

  const cleaned = {
    // Places API (New) uses displayName.text.
    // Keep fallback to the older `name` field.
    displayName:
      place.displayName?.text || place.displayName || place.name || "",

    rating: typeof place.rating === "number" ? place.rating : null,

    // Places API (New) uses userRatingCount.
    // Keep fallback to the legacy user_ratings_total.
    userRatingCount:
      typeof place.userRatingCount === "number"
        ? place.userRatingCount
        : typeof place.user_ratings_total === "number"
          ? place.user_ratings_total
          : 0,

    reviews: Array.isArray(place.reviews)
      ? place.reviews.map((r) => ({
          // Places API (New)
          authorName:
            r.authorAttribution?.displayName ||
            // Legacy API fallback
            r.author_name ||
            "",

          rating: typeof r.rating === "number" ? r.rating : null,

          // Places API (New)
          relativeTimeDescription:
            r.relativePublishTimeDescription ||
            // Legacy API fallback
            r.relative_time_description ||
            null,

          // Places API (New)
          time:
            r.publishTime ||
            // Legacy API fallback
            r.time ||
            null,

          // Places API (New) returns:
          // text: { text: "...", languageCode: "en" }
          //
          // Convert it to a plain string so React can render it.
          text: typeof r.text === "string" ? r.text : r.text?.text || "",
        }))
      : [],

    // Places API (New) can provide a Google Maps URI.
    // Keep legacy `url` as a fallback.
    googleMapsUrl: place.googleMapsUri || place.uri || place.url || "",
  };

  return cleaned;
}

async function fetchFromGoogle(apiKey, placeId) {
  // Google Places API (New) v1
  const base = "places.googleapis.com";

  // Request the values rendered by the Reviews section in one response.
  const fields = "rating,userRatingCount,reviews,googleMapsUri";

  // Correct Places API (New) resource format:
  // places/{PLACE_ID}
  const path =
    `/v1/places/${encodeURIComponent(placeId)}` +
    `?fields=${encodeURIComponent(fields)}` +
    `&key=${encodeURIComponent(apiKey)}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: base,
      path,
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";

      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        raw += chunk;
      });

      res.on("end", () => {
        try {
          const data = JSON.parse(raw || "{}");

          const extractGoogleStatus = (d) => {
            return d?.error?.status || null;
          };

          const extractGoogleMessage = (d) => {
            return d?.error?.message || null;
          };

          // Non-2xx HTTP responses
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const err = new Error("Google HTTP error");

            err.httpStatus = res.statusCode;
            err.googleStatus = extractGoogleStatus(data);
            err.googleMessage = extractGoogleMessage(data);

            return reject(err);
          }

          // Success
          return resolve(data);
        } catch (err) {
          const e = new Error("Invalid JSON from Google");

          e.httpStatus = res.statusCode || null;
          e.googleMessage = err && err.message ? err.message : null;

          return reject(e);
        }
      });
    });

    req.on("error", (err) => {
      const e = new Error("Network error contacting Google");

      e.googleMessage = err && err.message ? err.message : null;

      return reject(e);
    });

    req.setTimeout(10000, () => {
      req.destroy();

      const e = new Error("Timeout contacting Google");

      return reject(e);
    });

    req.end();
  });
}

const getReviews = asyncHandler(async (_request, response) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey) {
    throw createHttpError(
      500,
      "Google Places API key is not configured.",
      undefined,
      "INTERNAL_SERVER_ERROR",
    );
  }

  if (!placeId) {
    throw createHttpError(
      500,
      "Google Place ID is not configured.",
      undefined,
      "INTERNAL_SERVER_ERROR",
    );
  }

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return response.json({ source: "cache", ...cache.data });
  }

  let googleData;
  try {
    googleData = await fetchFromGoogle(apiKey, placeId);
  } catch (error) {
    if (cache.data) {
      console.warn(
        "Google Reviews Warning: Serving cached review data after an upstream failure.",
      );
      return response.json({ source: "stale-cache", ...cache.data });
    }

    throw createHttpError(
      502,
      "Unable to retrieve Google review data.",
      undefined,
      "UPSTREAM_SERVICE_ERROR",
    );
  }

  const cleaned = cleanGoogleResponse(googleData);

  cache = { ts: Date.now(), data: cleaned };

  return response.json({ source: "google", ...cleaned });
});

module.exports = { getReviews };
