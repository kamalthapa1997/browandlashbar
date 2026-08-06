const createHttpError = require("../utils/httpError");

function createRateLimiter({ windowMs, maxRequests }) {
  const hits = new Map();

  return function rateLimiter(request, _response, next) {
    const key = request.ip || "unknown";
    const now = Date.now();
    const current = hits.get(key);

    if (!current || current.expiresAt <= now) {
      hits.set(key, { count: 1, expiresAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      next(createHttpError(429, "Too many login attempts. Please try again later."));
      return;
    }

    current.count += 1;
    next();
  };
}

module.exports = { createRateLimiter };
