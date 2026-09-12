const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

const app = require("../app");
const { errorHandler } = require("../middleware/errorMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");
const squareRoutes = require("../routes/squareRoutes");

function createResponse() {
  return {
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest({ environment, remoteAddress, headers = {} }) {
  const requestApp = express();
  app.configureTrustProxy(requestApp, environment);
  const request = Object.create(express.request);
  request.app = requestApp;
  request.socket = { remoteAddress };
  request.connection = request.socket;
  request.headers = headers;
  return request;
}

function createTestLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 30 } = {}) {
  let currentTime = 0;
  const hitStore = new Map();
  const timers = [];
  const limiter = createRateLimiter({
    windowMs,
    maxRequests,
    now: () => currentTime,
    hitStore,
    setIntervalFn: (callback, delay) => {
      const timer = {
        callback,
        delay,
        unrefCalled: false,
        unref() { this.unrefCalled = true; },
      };
      timers.push(timer);
      return timer;
    },
  });

  return {
    hitStore,
    limiter,
    timers,
    setTime(value) { currentTime = value; },
  };
}

function invoke(limiter, request) {
  const response = createResponse();
  let error;
  limiter(request, response, (nextError) => { error = nextError; });
  return { response, error };
}

test("allows exactly 30 requests and returns a generic 429 with Retry-After on the next request", () => {
  const { limiter, setTime } = createTestLimiter();
  const request = { ip: "203.0.113.10" };

  for (let index = 0; index < 30; index += 1) {
    assert.equal(invoke(limiter, request).error, undefined);
  }

  setTime(1_000);
  const { response, error } = invoke(limiter, request);
  assert.equal(error.statusCode, 429);
  assert.equal(error.message, "Too many requests. Please try again later.");
  assert.equal(response.headers.get("retry-after"), "899");

  errorHandler(error, {}, response, () => {});
  assert.deepEqual(response.body, {
    error: {
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
    },
  });
});

test("removes expired client entries on its single unref'd periodic cleanup", () => {
  const { limiter, hitStore, timers, setTime } = createTestLimiter();
  invoke(limiter, { ip: "203.0.113.10" });

  assert.equal(hitStore.size, 1);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 15 * 60 * 1000);
  assert.equal(timers[0].unrefCalled, true);

  setTime(15 * 60 * 1000);
  timers[0].callback();
  assert.equal(hitStore.size, 0);
});

test("allows the first request after the fixed window expires", () => {
  const { limiter, setTime } = createTestLimiter({ windowMs: 1_000, maxRequests: 1 });
  const request = { ip: "203.0.113.10" };

  assert.equal(invoke(limiter, request).error, undefined);
  assert.equal(invoke(limiter, request).error.statusCode, 429);
  setTime(1_000);
  assert.equal(invoke(limiter, request).error, undefined);
});

test("uses Express-resolved req.ip for trusted proxy and untrusted spoofed requests", () => {
  const { limiter } = createTestLimiter({ maxRequests: 1 });
  const directDevelopmentRequest = createRequest({
    environment: "development",
    remoteAddress: "127.0.0.1",
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
  const proxiedClient = createRequest({
    environment: "production",
    remoteAddress: "127.0.0.1",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const secondProxiedClient = createRequest({
    environment: "production",
    remoteAddress: "127.0.0.1",
    headers: { "x-forwarded-for": "203.0.113.11" },
  });
  const spoofedDirectRequest = createRequest({
    environment: "production",
    remoteAddress: "198.51.100.20",
    headers: { "x-forwarded-for": "203.0.113.12" },
  });
  const sameDirectPeerWithAnotherSpoof = createRequest({
    environment: "production",
    remoteAddress: "198.51.100.20",
    headers: { "x-forwarded-for": "203.0.113.13" },
  });

  assert.equal(directDevelopmentRequest.ip, "127.0.0.1");
  assert.equal(invoke(limiter, directDevelopmentRequest).error, undefined);

  assert.equal(proxiedClient.ip, "203.0.113.10");
  assert.equal(invoke(limiter, proxiedClient).error, undefined);
  assert.equal(invoke(limiter, secondProxiedClient).error, undefined);

  assert.equal(spoofedDirectRequest.ip, "198.51.100.20");
  assert.equal(invoke(limiter, spoofedDirectRequest).error, undefined);
  assert.equal(invoke(limiter, sameDirectPeerWithAnotherSpoof).error.statusCode, 429);
});

test("uses process-local state that resets with a new Node process", () => {
  const firstProcess = createTestLimiter({ maxRequests: 1 });
  const request = { ip: "203.0.113.10" };

  assert.equal(invoke(firstProcess.limiter, request).error, undefined);
  assert.equal(invoke(firstProcess.limiter, request).error.statusCode, 429);

  const restartedProcess = createTestLimiter({ maxRequests: 1 });
  assert.equal(invoke(restartedProcess.limiter, request).error, undefined);
});

test("keeps the existing Square booking routes rate-limited", () => {
  const protectedRoutes = squareRoutes.stack
    .filter((layer) => layer.route)
    .filter((layer) => layer.route.stack.some((handler) => handler.handle.name === "rateLimiter"))
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods).sort() }));

  assert.deepEqual(protectedRoutes, [
    { path: "/booking-services", methods: ["get"] },
    { path: "/availability", methods: ["post"] },
    { path: "/bookings", methods: ["post"] },
  ]);
});
