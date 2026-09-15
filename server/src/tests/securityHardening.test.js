const assert = require("node:assert/strict");
const test = require("node:test");
const { Readable, Writable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const galleryRoutes = require("../routes/galleryRoutes");
const Settings = require("../models/Settings");
const { getSettings } = require("../controllers/settingsController");
const { __testables: galleryTestables } = require("../controllers/galleryController");
const { errorHandler } = require("../middleware/errorMiddleware");
const {
  ImageSignatureValidator,
  detectImageMimeType,
} = require("../middleware/uploadMiddleware").__testables;
const { createUpload } = require("../middleware/uploadMiddleware");
const cloudinary = require("../config/cloudinary");
const {
  allowedOrigins,
  applySecurityHeaders,
  createCorsMiddleware,
  isAllowedOrigin,
  protectCookieAuthenticatedWrites,
} = require("../middleware/securityMiddleware");

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, values);
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function createResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) { this.headers.set(name.toLowerCase(), String(value)); },
    getHeader(name) { return this.headers.get(name.toLowerCase()); },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}

function createRequest({ method = "GET", origin, referer, cookie, path = "/api/gallery" } = {}) {
  const headers = {};
  if (origin) headers.origin = origin;
  if (referer) headers.referer = referer;
  if (cookie) headers.cookie = cookie;
  return {
    method,
    headers,
    originalUrl: path,
    get(name) { return headers[name.toLowerCase()] || ""; },
  };
}

function invoke(middleware, request) {
  let error;
  middleware(request, createResponse(), (nextError) => { error = nextError; });
  return error;
}

test("API security headers are restrictive and HSTS is production-only", () => {
  withEnvironment({ NODE_ENV: "development" }, () => {
    const response = createResponse();
    applySecurityHeaders({}, response, () => {});
    assert.equal(response.getHeader("x-content-type-options"), "nosniff");
    assert.equal(response.getHeader("x-frame-options"), "DENY");
    assert.equal(response.getHeader("referrer-policy"), "strict-origin-when-cross-origin");
    assert.match(response.getHeader("permissions-policy"), /camera=\(\)/);
    assert.match(response.getHeader("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal(response.getHeader("strict-transport-security"), undefined);
  });

  withEnvironment({ NODE_ENV: "production" }, () => {
    const response = createResponse();
    applySecurityHeaders({}, response, () => {});
    assert.equal(response.getHeader("strict-transport-security"), "max-age=31536000");
  });
});

test("CORS permits only configured and local development origins", () => {
  withEnvironment({ NODE_ENV: "production", CLIENT_URL: "https://app.example.invalid" }, () => {
    assert.equal(isAllowedOrigin("https://app.example.invalid"), true);
    assert.equal(isAllowedOrigin("https://attacker.example.invalid"), false);
    assert.deepEqual([...allowedOrigins()], ["https://app.example.invalid"]);

    const corsMiddleware = createCorsMiddleware();
    const request = createRequest({ origin: "https://attacker.example.invalid" });
    let error;
    corsMiddleware(request, createResponse(), (nextError) => { error = nextError; });
    assert.equal(error?.errorCode, "CORS_ORIGIN_FORBIDDEN");
  });

  withEnvironment({ NODE_ENV: "development", CLIENT_URL: "http://localhost:3000" }, () => {
    assert.equal(isAllowedOrigin("http://127.0.0.1:3000"), true);
  });
});

test("cookie-authenticated writes require an approved Origin or Referer while webhooks remain exempt", () => {
  withEnvironment({ NODE_ENV: "production", CLIENT_URL: "https://app.example.invalid" }, () => {
    assert.equal(
      invoke(
        protectCookieAuthenticatedWrites,
        createRequest({ method: "PUT", origin: "https://app.example.invalid", cookie: "admin_session=value" }),
      ),
      undefined,
    );
    assert.equal(
      invoke(
        protectCookieAuthenticatedWrites,
        createRequest({ method: "DELETE", referer: "https://app.example.invalid/admin", cookie: "admin_session=value" }),
      ),
      undefined,
    );
    assert.equal(
      invoke(
        protectCookieAuthenticatedWrites,
        createRequest({ method: "PATCH", origin: "https://attacker.example.invalid", cookie: "admin_session=value" }),
      ).errorCode,
      "CSRF_ORIGIN_FORBIDDEN",
    );
    assert.equal(
      invoke(
        protectCookieAuthenticatedWrites,
        createRequest({ method: "POST", cookie: "admin_session=value" }),
      ).errorCode,
      "CSRF_ORIGIN_REQUIRED",
    );
    assert.equal(
      invoke(
        protectCookieAuthenticatedWrites,
        createRequest({ method: "POST", path: "/api/square/webhooks" }),
      ),
      undefined,
    );
    assert.equal(invoke(protectCookieAuthenticatedWrites, createRequest()), undefined);
  });
});

test("Gallery likes use the existing bounded process-local rate limiter", () => {
  const likeRoute = galleryRoutes.stack.find(
    (layer) => layer.route?.path === "/:id/like",
  ).route;
  assert.equal(
    likeRoute.stack.some((handler) => handler.handle.name === "rateLimiter"),
    true,
  );
});

test("upload signatures accept supported images and reject spoofed content", async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectImageMimeType(jpeg), "image/jpeg");
  assert.equal(detectImageMimeType(png), "image/png");

  await pipeline(Readable.from([jpeg]), new ImageSignatureValidator("image/jpeg"), new Writable({ write(_chunk, _encoding, callback) { callback(); } }));
  await assert.rejects(
    pipeline(Readable.from([jpeg]), new ImageSignatureValidator("image/png"), new Writable({ write(_chunk, _encoding, callback) { callback(); } })),
    { statusCode: 400 },
  );
  await assert.rejects(
    pipeline(Readable.from([Buffer.from("not-an-image")]), new ImageSignatureValidator("image/webp"), new Writable({ write(_chunk, _encoding, callback) { callback(); } })),
    { statusCode: 400 },
  );
  assert.equal(createUpload("test").limits.fileSize, 5 * 1024 * 1024);
});

test("server errors do not return provider details, stack traces, or sensitive messages", () => {
  const secret = "never-return-this-provider-token";
  const error = Object.assign(new Error(`/private/path ${secret}`), {
    statusCode: 500,
    details: { secret },
  });
  const response = createResponse();
  errorHandler(error, {}, response, () => {});

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.error.message, "Something went wrong on the server.");
  assert.equal(response.body.error.details, undefined);
  assert.equal(JSON.stringify(response.body).includes(secret), false);
  assert.equal(JSON.stringify(response.body).includes("/private/path"), false);
});

test("public Settings and Gallery reads do not persist defaults or legacy metadata", async () => {
  const originalFindOne = Settings.findOne;
  const originalCreate = Settings.create;
  let createCalls = 0;
  try {
    Settings.findOne = async () => null;
    Settings.create = async () => {
      createCalls += 1;
      throw new Error("public GET must not create settings");
    };

    const settings = await new Promise((resolve, reject) => {
      getSettings(
        {},
        {
          set() { return this; },
          json(value) { resolve(value); },
        },
        reject,
      );
    });
    assert.equal(settings.businessName, "Mero Brow & Lash Bar");
    assert.equal(createCalls, 0);
  } finally {
    Settings.findOne = originalFindOne;
    Settings.create = originalCreate;
  }

  const originalResource = cloudinary.api.resource;
  let saves = 0;
  try {
    cloudinary.api.resource = async () => ({ width: 1200, height: 800 });
    const hydrated = await galleryTestables.hydrateLegacyDimensions({
      publicId: "legacy-image",
      toObject: () => ({ publicId: "legacy-image" }),
      async save() { saves += 1; },
    });
    assert.deepEqual(hydrated, {
      publicId: "legacy-image",
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    });
    assert.equal(saves, 0);
  } finally {
    cloudinary.api.resource = originalResource;
  }
});
