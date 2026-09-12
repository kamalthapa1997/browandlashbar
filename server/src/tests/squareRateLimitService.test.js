const assert = require("node:assert/strict");
const test = require("node:test");

const {
  squareFetch,
  __testables: { parseRetryAfterSeconds },
} = require("../services/squareService");
const { errorHandler } = require("../middleware/errorMiddleware");

function squareResponse({ status, headers = {}, data = {} }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[name.toLowerCase()] || null,
    },
    json: async () => data,
  };
}

test("classifies Square 429 responses and preserves safe rate-limit metadata", async () => {
  let calls = 0;
  let rateLimitError;
  await assert.rejects(
    squareFetch("/locations", {
      accessToken: "test-access-token",
      fetchImpl: async () => {
        calls += 1;
        return squareResponse({
          status: 429,
          headers: {
            "retry-after": "7",
            "x-square-request-id": "square-request-123",
          },
          data: {
            errors: [{
              category: "RATE_LIMIT_ERROR",
              code: "RATE_LIMITED",
              detail: "Too many requests.",
            }],
          },
        });
      },
    }),
    (error) => {
      rateLimitError = error;
      assert.equal(error.statusCode, 429);
      assert.equal(error.errorCode, "SQUARE_RATE_LIMITED");
      assert.equal(error.squareCode, "RATE_LIMITED");
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterSeconds, 7);
      assert.equal(error.squareRequestId, "square-request-123");
      assert.deepEqual(error.details, {
        squareStatus: 429,
        squareErrors: [{
          category: "RATE_LIMIT_ERROR",
          code: "RATE_LIMITED",
          detail: "Too many requests.",
        }],
        retryAfterSeconds: 7,
        squareRequestId: "square-request-123",
      });
      return true;
    },
  );
  assert.equal(calls, 1, "a 429 must not trigger an automatic retry");

  const response = {
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
  errorHandler(rateLimitError, {}, response, () => {});
  assert.equal(response.statusCode, 429);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      status: 429,
      code: "SQUARE_RATE_LIMITED",
      message: "Square is temporarily rate-limiting requests. Please wait a moment and try again.",
      retryable: true,
      retryAfterSeconds: 7,
      details: {
        squareStatus: 429,
        squareErrors: [{
          category: "RATE_LIMIT_ERROR",
          code: "RATE_LIMITED",
          detail: "Too many requests.",
        }],
        retryAfterSeconds: 7,
        squareRequestId: "square-request-123",
      },
    },
  });
});

test("returns the public retryable 429 contract without a Retry-After value when invalid", async () => {
  let rateLimitError;
  await assert.rejects(
    squareFetch("/locations", {
      accessToken: "test-access-token",
      fetchImpl: async () => squareResponse({
        status: 429,
        headers: { "retry-after": "not-a-date" },
        data: { errors: [{ category: "RATE_LIMIT_ERROR", code: "RATE_LIMITED" }] },
      }),
    }),
    (error) => {
      rateLimitError = error;
      assert.equal(error.retryable, true);
      assert.equal(error.retryAfterSeconds, undefined);
      return true;
    },
  );

  const response = {
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
  errorHandler(rateLimitError, {}, response, () => {});
  assert.deepEqual(response.body, {
    success: false,
    error: {
      status: 429,
      code: "SQUARE_RATE_LIMITED",
      message: "Square is temporarily rate-limiting requests. Please wait a moment and try again.",
      retryable: true,
      details: {
        squareStatus: 429,
        squareErrors: [{ category: "RATE_LIMIT_ERROR", code: "RATE_LIMITED" }],
      },
    },
  });
});

test("parses both Retry-After formats deterministically", () => {
  const now = Date.parse("2026-09-10T12:00:00.000Z");
  assert.equal(parseRetryAfterSeconds("12", () => now), 12);
  assert.equal(parseRetryAfterSeconds("Thu, 10 Sep 2026 12:00:03 GMT", () => now), 3);
  assert.equal(parseRetryAfterSeconds("not-a-date", () => now), undefined);
});
