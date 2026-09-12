const createHttpError = require("../utils/httpError");

function createRateLimiter({
  windowMs,
  maxRequests,
  now = () => Date.now(),
  setIntervalFn = setInterval,
  hitStore = new Map(),
}) {
  const hits = hitStore;

  function cleanupExpiredHits() {
    const currentTime = now();
    for (const [key, value] of hits) {
      if (value.expiresAt <= currentTime) hits.delete(key);
    }
  }

  // One unref'd interval per limiter bounds memory without creating a timer for
  // every client IP or preventing a Node process from exiting naturally.
  const cleanupTimer = setIntervalFn(cleanupExpiredHits, windowMs);
  cleanupTimer.unref?.();

  return function rateLimiter(request, _response, next) {
    const key = request.ip || "unknown";
    const currentTime = now();
    const current = hits.get(key);

    if (!current || current.expiresAt <= currentTime) {
      hits.set(key, { count: 1, expiresAt: currentTime + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((current.expiresAt - currentTime) / 1000),
      );
      _response.setHeader("Retry-After", String(retryAfterSeconds));
      next(createHttpError(429, "Too many requests. Please try again later."));
      return;
    }

    current.count += 1;
    next();
  };
}

module.exports = { createRateLimiter };
