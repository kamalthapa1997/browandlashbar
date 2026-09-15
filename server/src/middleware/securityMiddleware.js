const cors = require("cors");
const createHttpError = require("../utils/httpError");

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WEBHOOK_PATH = "/api/square/webhooks";

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function allowedOrigins(environment = process.env.NODE_ENV) {
  const configuredOrigin = originFromUrl(
    process.env.CLIENT_URL || "http://localhost:3000",
  );
  const origins = new Set(configuredOrigin ? [configuredOrigin] : []);

  if (environment !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

function isAllowedOrigin(origin, environment) {
  return allowedOrigins(environment).has(originFromUrl(origin));
}

function createCorsMiddleware() {
  return cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(
        createHttpError(
          403,
          "Origin is not allowed.",
          undefined,
          "CORS_ORIGIN_FORBIDDEN",
        ),
      );
    },
    credentials: true,
  });
}

function applySecurityHeaders(request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
  );
  // Express serves API responses only. This restrictive policy protects those
  // responses without imposing fragile script/style rules on nginx's React app.
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  );

  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000");
  }

  next();
}

function hasAdminSessionCookie(request) {
  return (request.headers.cookie || "")
    .split(";")
    .some((entry) => entry.trim().startsWith("admin_session="));
}

function requestOrigin(request) {
  const origin = request.get("origin");
  if (origin) return originFromUrl(origin);
  return originFromUrl(request.get("referer"));
}

function protectCookieAuthenticatedWrites(request, _response, next) {
  if (
    !UNSAFE_METHODS.has(request.method) ||
    request.originalUrl === WEBHOOK_PATH
  ) {
    next();
    return;
  }

  const origin = requestOrigin(request);
  if (origin && !isAllowedOrigin(origin)) {
    next(
      createHttpError(
        403,
        "Origin is not allowed.",
        undefined,
        "CSRF_ORIGIN_FORBIDDEN",
      ),
    );
    return;
  }

  // Browsers send Origin for cross-site unsafe requests. Requiring an approved
  // Origin/Referer when an admin cookie is present also protects same-site
  // cookie authentication when an older browser omits Origin.
  if (!origin && hasAdminSessionCookie(request)) {
    next(
      createHttpError(
        403,
        "A valid request origin is required.",
        undefined,
        "CSRF_ORIGIN_REQUIRED",
      ),
    );
    return;
  }

  next();
}

module.exports = {
  allowedOrigins,
  applySecurityHeaders,
  createCorsMiddleware,
  isAllowedOrigin,
  protectCookieAuthenticatedWrites,
  __testables: { hasAdminSessionCookie, requestOrigin },
};
