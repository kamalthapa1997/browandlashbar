const assert = require("node:assert/strict");
const test = require("node:test");

const {
  __testables: { fetchWithTimeout },
} = require("../services/squareService");

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("aborts a pending Square request at its configured timeout and preserves AbortError details", async () => {
  let signal;
  const abortError = new Error("transport aborted after timeout");
  abortError.name = "AbortError";

  await assert.rejects(
    fetchWithTimeout(
      "https://example.test/v2/bookings",
      { method: "POST" },
      {
        timeoutMs: 10,
        operation: "CreateBooking",
        fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
          signal = options.signal;
          signal.addEventListener("abort", () => reject(abortError), { once: true });
        }),
      },
    ),
    (error) => {
      assert.equal(error.errorCode, "SQUARE_TIMEOUT");
      assert.equal(error.operation, "CreateBooking");
      assert.equal(error.timeoutMs, 10);
      assert.equal(error.cause, abortError);
      return true;
    },
  );

  assert.equal(signal.aborted, true);
});

test("keeps the timeout active while a Square response body is still pending", async () => {
  let signal;
  const abortError = new Error("response body aborted after timeout");
  abortError.name = "AbortError";

  await assert.rejects(
    fetchWithTimeout(
      "https://example.test/v2/catalog",
      { method: "GET" },
      {
        timeoutMs: 10,
        operation: "API",
        fetchImpl: async (_url, options) => {
          signal = options.signal;
          return {
            json: () => new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => reject(abortError), { once: true });
            }),
          };
        },
        responseHandler: async (response) => response.json(),
      },
    ),
    (error) => {
      assert.equal(error.errorCode, "SQUARE_TIMEOUT");
      assert.equal(error.cause, abortError);
      return true;
    },
  );

  assert.equal(signal.aborted, true);
});

test("clears timeout timers after completed Square requests", async () => {
  const signals = [];
  const response = { ok: true, json: async () => ({}) };

  await Promise.all(
    Array.from({ length: 3 }, () => fetchWithTimeout(
      "https://example.test/v2/catalog",
      { method: "GET" },
      {
        timeoutMs: 10,
        operation: "API",
        fetchImpl: async (_url, options) => {
          signals.push(options.signal);
          return response;
        },
      },
    )),
  );

  await wait(25);
  assert.equal(signals.length, 3);
  assert.equal(signals.every((signal) => !signal.aborted), true);
});
