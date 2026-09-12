import { apiRequest } from "../client";

describe("API rate-limit errors", () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.restoreAllMocks();
  });

  test("preserves the safe Square retry contract for booking UI recovery", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => "application/json" },
      json: async () => ({
        success: false,
        error: {
          code: "SQUARE_RATE_LIMITED",
          message: "Square is temporarily rate-limiting requests. Please wait a moment and try again.",
          retryable: true,
          retryAfterSeconds: 5,
        },
      }),
    });

    await expect(apiRequest("/api/square/bookings")).rejects.toMatchObject({
      status: 429,
      code: "SQUARE_RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 5,
    });
  });
});
