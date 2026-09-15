const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BookingAttemptStore,
  createRequestFingerprint,
} = require("../services/bookingAttemptService");
const BookingAttempt = require("../models/BookingAttempt");
const {
  __testables: { fetchWithTimeout },
} = require("../services/squareService");
const {
  __testables: {
    createSquareBookingRequest,
    executeStoredSquareBooking,
    getAvailabilityData,
    prepareAuthoritativeBooking,
    selectAuthoritativeAvailability,
    shouldReleasePrePersistenceAttempt,
  },
} = require("../controllers/squareController");
const { validateAvailabilityPayload, validateBookingPayload } = require("../utils/validators");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, path, value) {
  const parts = path.split(".");
  const key = parts.pop();
  const parent = parts.reduce((current, part) => {
    current[part] ||= {};
    return current[part];
  }, target);
  parent[key] = value;
}

function unsetPath(target, path) {
  const parts = path.split(".");
  const key = parts.pop();
  const parent = parts.reduce((current, part) => current?.[part], target);
  if (parent) delete parent[key];
}

function matches(record, query) {
  return Object.entries(query).every(([key, expected]) => {
    const actual = record[key];
    if (expected && typeof expected === "object" && "$lte" in expected) {
      return new Date(actual).getTime() <= new Date(expected.$lte).getTime();
    }
    if (expected && typeof expected === "object" && "$exists" in expected) {
      return expected.$exists ? actual !== undefined : actual === undefined;
    }
    return actual === expected;
  });
}

function queryResult(record) {
  return { select: async () => (record ? clone(record) : null) };
}

class FakeBookingAttemptModel {
  constructor() {
    this.records = [];
  }

  async create(values) {
    if (
      this.records.some(
        (record) =>
          record.bookingAttemptId === values.bookingAttemptId ||
          record.requestFingerprint === values.requestFingerprint,
      )
    ) {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    }
    const record = { _id: String(this.records.length + 1), ...clone(values) };
    this.records.push(record);
    return clone(record);
  }

  findOne(query) {
    return queryResult(this.records.find((record) => matches(record, query)));
  }

  findOneAndUpdate(query, update) {
    const record = this.records.find((item) => matches(item, query));
    if (record) {
      for (const [path, value] of Object.entries(update.$set || {})) setPath(record, path, clone(value));
      for (const path of Object.keys(update.$unset || {})) unsetPath(record, path);
    }
    return queryResult(record);
  }
}

const payload = {
  variationIds: ["square-variation-1"],
  startAt: "2026-09-14T13:00:00.000Z",
  customer: { firstName: "Luma", lastName: "Sinjali", phone: "12024926354", email: "luma@example.com" },
  phoneNumber: "+12024926354",
};

const storedSquareRequest = {
  booking: {
    start_at: "2026-09-14T13:00:00Z",
    location_id: "location-1",
    customer_id: "customer-1",
    appointment_segments: [{ duration_minutes: 30, service_variation_id: "variation-1", service_variation_version: 1, team_member_id: "team-1" }],
  },
};

function makeStore(options = {}) {
  return new BookingAttemptStore(new FakeBookingAttemptModel(), {
    attemptTtlMs: 60 * 1000,
    processingLeaseMs: 10,
    ...options,
  });
}

test("BookingAttempt declares only its idempotency and expiration indexes", () => {
  assert.deepEqual(BookingAttempt.schema.indexes(), [
    [{ bookingAttemptId: 1 }, { unique: true, background: true }],
    [{ requestFingerprint: 1 }, { unique: true, background: true }],
    [{ expiresAt: 1 }, { expireAfterSeconds: 0, background: true }],
  ]);
});

test("booking requests require a valid browser booking attempt UUID", () => {
  const futureStartAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { today } = require("../utils/bookingWindow").getBookingWindow();
  assert.throws(
    () => validateBookingPayload({ ...payload, startAt: futureStartAt, bookingAttemptId: "not-a-uuid" }),
    { statusCode: 400 },
  );

  const validated = validateBookingPayload({
    ...payload,
    startAt: futureStartAt,
    bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e",
  });
  assert.equal(validated.bookingAttemptId, "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e");
  assert.deepEqual(validated.variationIds, ["square-variation-1"]);
  assert.deepEqual(
    validateAvailabilityPayload({ variationIds: ["variation-b", "variation-a"], date: today }),
    { variationIds: ["variation-a", "variation-b"], date: today },
  );
  assert.throws(
    () => validateAvailabilityPayload({ variationIds: [], date: today }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateAvailabilityPayload({ variationIds: ["variation-a", "variation-a"], date: today }),
    { statusCode: 400 },
  );
});

test("canonicalizes variation order for booking request identity", () => {
  const first = createRequestFingerprint(
    { ...payload, variationIds: ["variation-c", "variation-a", "variation-b"] },
    "test-secret",
  );
  const reordered = createRequestFingerprint(
    { ...payload, variationIds: ["variation-b", "variation-c", "variation-a"] },
    "test-secret",
  );
  const changed = createRequestFingerprint(
    { ...payload, variationIds: ["variation-a", "variation-d"] },
    "test-secret",
  );

  assert.equal(first, reordered);
  assert.notEqual(first, changed);
});

test("the active lease owner can renew only its pre-persistence lease", async () => {
  let now = 1_000;
  const store = makeStore({ now: () => now });
  const first = await store.createOrGet({
    bookingAttemptId: "a1c3f5d7-1234-4cde-8f12-1234567890ab",
    requestFingerprint: createRequestFingerprint(payload, "test-secret"),
  });
  const originalExpiry = first.attempt.processingLeaseExpiresAt;

  now += 8;
  const renewed = await store.renewLease(first.attempt, first.leaseToken);

  assert.equal(renewed.processingLeaseToken, first.leaseToken);
  assert.ok(
    new Date(renewed.processingLeaseExpiresAt).getTime() > new Date(originalExpiry).getTime(),
  );
});

test("a different owner cannot renew or persist another request's lease", async () => {
  const store = makeStore();
  const first = await store.createOrGet({
    bookingAttemptId: "b2d4f6a8-1234-4cde-8f12-1234567890ab",
    requestFingerprint: createRequestFingerprint(payload, "test-secret"),
  });

  await assert.rejects(
    store.renewLease(first.attempt, "another-owner-token"),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );
  await assert.rejects(
    store.storeSquareRequest(first.attempt, "another-owner-token", storedSquareRequest, {
      location: "Main location",
      service: "Brow shaping",
    }),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );
  assert.equal(store.model.records[0].squareBookingRequest, undefined);
});

test("ownership loss aborts the old validation path before it can persist or create a booking", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "b3e5a7c9-1234-4cde-8f12-1234567890ab",
    requestFingerprint: fingerprint,
  });
  await store.releaseForRetry(first.attempt, first.leaseToken);
  const retry = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });
  const newOwner = await store.claimExpiredAttempt(retry.attempt);
  let variationCalls = 0;

  await assert.rejects(
    prepareAuthoritativeBooking(
      {
        variationIds: ["variation-a"],
        startAt: "2026-09-14T13:00:00Z",
        customer: payload.customer,
      },
      {
        beforeSquareOperation: () => store.renewLease(first.attempt, first.leaseToken),
        resolveBookableVariation: async () => {
          variationCalls += 1;
          return { variation: { id: "variation-a", item_variation_data: {} } };
        },
      },
    ),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );

  assert.equal(variationCalls, 0);
  assert.equal(store.model.records[0].processingLeaseToken, newOwner.leaseToken);
  assert.equal(store.model.records[0].squareBookingRequest, undefined);
});

test("terminal attempts and persisted requests cannot renew a processing lease", async () => {
  const store = makeStore();
  const succeeded = await store.createOrGet({
    bookingAttemptId: "c3e5a7b9-1234-4cde-8f12-1234567890ab",
    requestFingerprint: createRequestFingerprint(payload, "test-secret"),
  });
  await store.markSucceeded(succeeded.attempt, {
    id: "booking-1",
    status: "ACCEPTED",
    startAt: payload.startAt,
    location: "Main location",
    service: "Brow shaping",
  });
  await assert.rejects(
    store.renewLease(succeeded.attempt, succeeded.leaseToken),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );

  const persisted = await store.createOrGet({
    bookingAttemptId: "d4f6b8c0-1234-4cde-8f12-1234567890ab",
    requestFingerprint: createRequestFingerprint(
      { ...payload, startAt: "2026-09-14T14:00:00.000Z" },
      "test-secret",
    ),
  });
  const durable = await store.storeSquareRequest(
    persisted.attempt,
    persisted.leaseToken,
    storedSquareRequest,
    { location: "Main location", service: "Brow shaping" },
  );
  await assert.rejects(
    store.renewLease(durable, persisted.leaseToken),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );
});

test("bounded stage renewals preserve ownership through long pre-persistence validation", async () => {
  let now = 0;
  const store = makeStore({ now: () => now });
  const first = await store.createOrGet({
    bookingAttemptId: "e5a7c9d1-1234-4cde-8f12-1234567890ab",
    requestFingerprint: createRequestFingerprint(payload, "test-secret"),
  });
  let attempt = first.attempt;
  let renewals = 0;
  const beforeSquareOperation = async () => {
    renewals += 1;
    attempt = await store.renewLease(attempt, first.leaseToken);
  };
  const slot = {
    start_at: "2026-09-14T13:00:00Z",
    appointment_segments: [{
      duration_minutes: 30,
      service_variation_id: "variation-a",
      service_variation_version: 1,
      team_member_id: "team-1",
    }],
  };

  const prepared = await prepareAuthoritativeBooking(
    {
      variationIds: ["variation-a"],
      startAt: "2026-09-14T13:00:00Z",
      customer: payload.customer,
    },
    {
      beforeSquareOperation,
      resolveBookableVariation: async () => ({
        variation: { id: "variation-a", item_variation_data: {} },
        serviceName: "Brow shaping",
      }),
      resolveLocation: async () => {
        now += 9;
        return { id: "location-1", name: "Main location" };
      },
      listBookableTeamMembers: async () => [{ team_member_id: "team-1" }],
      searchAvailability: async () => {
        now += 9;
        return [slot];
      },
      findOrCreateCustomer: async (_customer, hooks) => {
        await hooks.beforeSquareOperation();
        now += 9;
        return "customer-1";
      },
    },
  );

  assert.ok(now > 10, "validation exceeds the original lease window without sleeping");
  assert.equal(renewals, 4, "renewal occurs only at bounded Square-operation boundaries");
  assert.ok(new Date(attempt.processingLeaseExpiresAt).getTime() > now);
  const durable = await store.storeSquareRequest(
    attempt,
    first.leaseToken,
    prepared.squareBookingRequest,
    prepared.confirmation,
  );
  await assert.rejects(
    store.renewLease(durable, first.leaseToken),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );
});

test("a pre-persistence Square 429 is retryable without a CreateBooking request", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "f6b8d0e2-1234-4cde-8f12-1234567890ab",
    requestFingerprint: fingerprint,
  });
  const rateLimitError = new Error("Square is temporarily rate limited.");
  rateLimitError.statusCode = 429;
  rateLimitError.errorCode = "SQUARE_RATE_LIMITED";
  rateLimitError.retryable = true;
  let customerCalls = 0;

  await assert.rejects(
    prepareAuthoritativeBooking(
      {
        variationIds: ["variation-a"],
        startAt: "2026-09-14T13:00:00Z",
        customer: payload.customer,
      },
      {
        resolveBookableVariation: async () => { throw rateLimitError; },
        findOrCreateCustomer: async () => { customerCalls += 1; },
      },
    ),
    (error) => error === rateLimitError,
  );
  assert.equal(shouldReleasePrePersistenceAttempt(rateLimitError), true);
  assert.equal(customerCalls, 0, "customer creation and CreateBooking are not reached");

  await store.releaseForRetry(first.attempt, first.leaseToken);
  const retry = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });
  const claimed = await store.claimExpiredAttempt(retry.attempt);
  assert.equal(claimed.attempt.squareBookingRequest, undefined);
  assert.equal(claimed.attempt.status, "processing");
});

test("builds CreateBooking from the authoritative Square segment", () => {
  const request = createSquareBookingRequest({
    selected: {
      start_at: "2026-09-14T13:00:00Z",
      appointment_segments: [{
        duration_minutes: 30,
        service_variation_id: "square-variation-1",
        service_variation_version: 7,
        team_member_id: "team-1",
      }],
    },
    location: { id: "location-1" },
    customerId: "customer-1",
  });

  assert.deepEqual(request, {
    booking: {
      start_at: "2026-09-14T13:00:00Z",
      location_id: "location-1",
      customer_id: "customer-1",
      appointment_segments: [{
        duration_minutes: 30,
        service_variation_id: "square-variation-1",
        service_variation_version: 7,
        team_member_id: "team-1",
      }],
    },
  });
});

test("persists and submits one authoritative multi-segment booking after initial and final availability", async () => {
  const variationIds = ["variation-a", "variation-b", "variation-c"];
  const slots = [{
    start_at: "2026-09-14T13:00:00Z",
    appointment_segments: [
      { duration_minutes: 15, service_variation_id: "variation-b", service_variation_version: 12, team_member_id: "team-1" },
      { duration_minutes: 30, service_variation_id: "variation-a", service_variation_version: 14, team_member_id: "team-1" },
      { duration_minutes: 45, service_variation_id: "variation-c", service_variation_version: 18, team_member_id: "team-2" },
    ],
  }];
  const profiles = [
    { team_member_id: "team-1", display_name: "Avery", is_bookable: true },
    { team_member_id: "team-2", display_name: "Blair", is_bookable: true },
  ];
  let availabilityCalls = 0;
  const dependencies = {
    resolveBookableVariation: async (id) => ({
      variation: {
        id,
        item_variation_data: { available_for_booking: true },
      },
      serviceName: `Service ${id}`,
    }),
    resolveLocation: async () => ({ id: "location-1", name: "Main location" }),
    listBookableTeamMembers: async () => profiles,
    searchAvailability: async () => {
      availabilityCalls += 1;
      return clone(slots);
    },
    findOrCreateCustomer: async () => "customer-1",
  };

  await getAvailabilityData(
    { variationIds, date: "2026-09-14" },
    dependencies,
  );
  const prepared = await prepareAuthoritativeBooking(
    {
      variationIds,
      startAt: "2026-09-14T13:00:00Z",
      customer: payload.customer,
    },
    dependencies,
  );

  assert.equal(availabilityCalls, 2);
  assert.deepEqual(prepared.squareBookingRequest.booking.appointment_segments, slots[0].appointment_segments);
  assert.deepEqual(prepared.confirmation, {
    location: "Main location",
    service: "Service variation-a + Service variation-b + Service variation-c",
  });

  const store = makeStore();
  const fingerprint = createRequestFingerprint(
    { ...payload, variationIds },
    "test-secret",
  );
  const first = await store.createOrGet({
    bookingAttemptId: "a7a3d80a-f9e0-4d6e-80d5-6c74e9257ef5",
    requestFingerprint: fingerprint,
  });
  const persisted = await store.storeSquareRequest(
    first.attempt,
    first.leaseToken,
    prepared.squareBookingRequest,
    prepared.confirmation,
  );
  assert.deepEqual(persisted.squareBookingRequest, prepared.squareBookingRequest);

  let createBookingCalls = 0;
  const confirmation = await executeStoredSquareBooking(
    new BookingAttempt({
      bookingAttemptId: persisted.bookingAttemptId,
      squareIdempotencyKey: persisted.squareIdempotencyKey,
      status: "processing",
      requestFingerprint: persisted.requestFingerprint,
      squareBookingRequest: persisted.squareBookingRequest,
      confirmation: persisted.confirmation,
      expiresAt: persisted.expiresAt,
    }),
    first.leaseToken,
    {
      squareFetch: async (path, options) => {
        createBookingCalls += 1;
        assert.equal(path, "/bookings");
        assert.equal(options.body.idempotency_key, persisted.squareIdempotencyKey);
        assert.deepEqual(options.body.booking, prepared.squareBookingRequest.booking);
        return { booking: { id: "booking-1", status: "ACCEPTED", start_at: "2026-09-14T13:00:00Z" } };
      },
      bookingAttemptStore: { markSucceeded: async () => {} },
    },
  );

  assert.equal(createBookingCalls, 1);
  assert.equal(confirmation.service, prepared.confirmation.service);
});

test("rejects wrong or incomplete authoritative segments before CreateBooking", () => {
  const requestedVariationIds = ["variation-a", "variation-b", "variation-c"];
  const validSegment = (serviceVariationId) => ({
    duration_minutes: 30,
    service_variation_id: serviceVariationId,
    service_variation_version: 1,
    team_member_id: "team-1",
  });
  const invalidSlots = [
    [{ start_at: "2026-09-14T14:00:00Z", appointment_segments: requestedVariationIds.map(validSegment) }],
    [{ start_at: "2026-09-14T13:00:00Z", appointment_segments: [validSegment("variation-a"), validSegment("variation-b")] }],
    [{ start_at: "2026-09-14T13:00:00Z", appointment_segments: [validSegment("variation-a"), validSegment("variation-b"), validSegment("variation-d")] }],
    [{ start_at: "2026-09-14T13:00:00Z", appointment_segments: [validSegment("variation-a"), validSegment("variation-b"), validSegment("variation-b")] }],
    [{ start_at: "2026-09-14T13:00:00Z", appointment_segments: [{ ...validSegment("variation-a"), service_variation_version: undefined }, validSegment("variation-b"), validSegment("variation-c")] }],
    [
      { start_at: "2026-09-14T13:00:00Z", appointment_segments: requestedVariationIds.map(validSegment) },
      { start_at: "2026-09-14T13:00:00Z", appointment_segments: requestedVariationIds.map(validSegment) },
    ],
  ];

  for (const slotsForCase of invalidSlots) {
    assert.throws(
      () => selectAuthoritativeAvailability(slotsForCase, "2026-09-14T13:00:00Z", requestedVariationIds),
    );
  }
});

test("does not prepare a booking when a re-resolved service is no longer bookable", async () => {
  let availabilityCalls = 0;
  let customerCalls = 0;

  await assert.rejects(
    prepareAuthoritativeBooking(
      {
        variationIds: ["variation-a", "variation-unbookable"],
        startAt: "2026-09-14T13:00:00Z",
        customer: payload.customer,
      },
      {
        resolveBookableVariation: async (id) => {
          if (id === "variation-unbookable") {
            const error = new Error("This service is not available for online booking.");
            error.statusCode = 422;
            error.errorCode = "SERVICE_NOT_BOOKABLE";
            throw error;
          }
          return { variation: { id, item_variation_data: {} }, serviceName: "Service A" };
        },
        resolveLocation: async () => ({ id: "location-1", name: "Main location" }),
        listBookableTeamMembers: async () => [],
        searchAvailability: async () => {
          availabilityCalls += 1;
          return [];
        },
        findOrCreateCustomer: async () => {
          customerCalls += 1;
          return "customer-1";
        },
      },
    ),
    { errorCode: "SERVICE_NOT_BOOKABLE" },
  );

  assert.equal(availabilityCalls, 0);
  assert.equal(customerCalls, 0);
});

test("a new booking attempt gets one durable Square key and replays its stored success", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({ bookingAttemptId: "c571d5ab-06dd-4f79-9127-4d6cb8e57d7e", requestFingerprint: fingerprint });
  const key = first.attempt.squareIdempotencyKey;
  assert.equal(first.created, true);
  assert.match(key, /^[0-9a-f-]{36}$/i);

  const finalized = await store.storeSquareRequest(first.attempt, first.leaseToken, storedSquareRequest, {
    location: "Main location",
    service: "Brow shaping",
  });
  const confirmation = { id: "booking-1", status: "ACCEPTED", startAt: payload.startAt, location: "Main location", service: "Brow shaping" };
  await store.markSucceeded(finalized, confirmation);

  const replay = await store.createOrGet({ bookingAttemptId: first.attempt.bookingAttemptId, requestFingerprint: fingerprint });
  assert.equal(replay.created, false);
  assert.equal(replay.attempt.status, "succeeded");
  assert.equal(replay.attempt.squareIdempotencyKey, key);
  assert.deepEqual(replay.attempt.confirmation, confirmation);
});

test("a changed payload cannot reuse an existing booking attempt", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  await store.createOrGet({ bookingAttemptId: "9d2d4603-d2a6-42f9-9b7f-65a002255a8c", requestFingerprint: fingerprint });

  await assert.rejects(
    store.createOrGet({
      bookingAttemptId: "9d2d4603-d2a6-42f9-9b7f-65a002255a8c",
      requestFingerprint: createRequestFingerprint({ ...payload, startAt: "2026-09-14T14:00:00.000Z" }, "test-secret"),
    }),
    { errorCode: "BOOKING_ATTEMPT_MISMATCH" },
  );
});

test("an uncertain response reuses the identical Square request and Square key", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({ bookingAttemptId: "50cae359-50ce-4a41-91f2-050f20c681e7", requestFingerprint: fingerprint });
  const key = first.attempt.squareIdempotencyKey;
  const finalized = await store.storeSquareRequest(first.attempt, first.leaseToken, storedSquareRequest, {
    location: "Main location",
    service: "Brow shaping",
  });

  await store.releaseForRetry(finalized, first.leaseToken);
  const retry = await store.createOrGet({ bookingAttemptId: first.attempt.bookingAttemptId, requestFingerprint: fingerprint });
  const claimed = await store.claimExpiredAttempt(retry.attempt);
  assert.equal(claimed.attempt.squareIdempotencyKey, key);
  assert.deepEqual(claimed.attempt.squareBookingRequest, storedSquareRequest);
});

test("recovers a booking created before a lost Square response without creating a second appointment", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "7d13ca36-7fae-4ab6-8a7e-fbd275d88c0c",
    requestFingerprint: fingerprint,
  });
  const persisted = await store.storeSquareRequest(
    first.attempt,
    first.leaseToken,
    storedSquareRequest,
    { location: "Main location", service: "Brow shaping" },
  );

  const calls = [];
  const createdBookings = new Map();
  const squareFetch = async (path, options) => {
    assert.equal(path, "/bookings");
    assert.equal(options.method, "POST");
    calls.push(clone(options.body));

    const existing = createdBookings.get(options.body.idempotency_key);
    if (existing) {
      assert.deepEqual(options.body, existing.request);
      return { booking: existing.booking };
    }

    const booking = {
      id: "booking-created-before-timeout",
      status: "ACCEPTED",
      start_at: storedSquareRequest.booking.start_at,
    };
    createdBookings.set(options.body.idempotency_key, {
      booking,
      request: clone(options.body),
    });
    const timeoutError = new Error("Simulated response loss after Square created the booking");
    timeoutError.code = "ECONNRESET";
    throw timeoutError;
  };
  const attemptStore = {
    releaseForRetry: async (_attempt, leaseToken) =>
      store.releaseForRetry(persisted, leaseToken),
    markSucceeded: async (_attempt, confirmation) =>
      store.markSucceeded(retryAttempt, confirmation),
    markFailed: async () => assert.fail("A response-loss error must remain retryable"),
  };
  const makeMongooseAttempt = (attempt) => new BookingAttempt({
    bookingAttemptId: attempt.bookingAttemptId,
    squareIdempotencyKey: attempt.squareIdempotencyKey,
    status: attempt.status,
    requestFingerprint: attempt.requestFingerprint,
    squareBookingRequest: attempt.squareBookingRequest,
    confirmation: attempt.confirmation,
    expiresAt: attempt.expiresAt,
  });

  await assert.rejects(
    executeStoredSquareBooking(makeMongooseAttempt(persisted), first.leaseToken, {
      squareFetch,
      bookingAttemptStore: attemptStore,
    }),
    /Simulated response loss/,
  );

  const retry = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });
  const { attempt: retryAttempt, leaseToken } = await store.claimExpiredAttempt(retry.attempt);
  const confirmation = await executeStoredSquareBooking(
    makeMongooseAttempt(retryAttempt),
    leaseToken,
    { squareFetch, bookingAttemptStore: attemptStore },
  );
  const finalAttempt = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].idempotency_key, first.attempt.squareIdempotencyKey);
  assert.equal(calls[1].idempotency_key, first.attempt.squareIdempotencyKey);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(createdBookings.size, 1);
  assert.deepEqual(confirmation, {
    id: "booking-created-before-timeout",
    status: "ACCEPTED",
    startAt: storedSquareRequest.booking.start_at,
    location: "Main location",
    service: "Brow shaping",
  });
  assert.equal(finalAttempt.attempt.status, "succeeded");
  assert.deepEqual(finalAttempt.attempt.confirmation, confirmation);
});

test("a CreateBooking timeout remains retryable and replays the same Square key and payload", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "0b4c95fd-cd1e-4af5-bf4c-aea0c3a83309",
    requestFingerprint: fingerprint,
  });
  const persisted = await store.storeSquareRequest(
    first.attempt,
    first.leaseToken,
    storedSquareRequest,
    { location: "Main location", service: "Brow shaping" },
  );
  const calls = [];
  const createdBookings = new Map();
  let retryAttempt;
  const makeMongooseAttempt = (attempt) => new BookingAttempt({
    bookingAttemptId: attempt.bookingAttemptId,
    squareIdempotencyKey: attempt.squareIdempotencyKey,
    status: attempt.status,
    requestFingerprint: attempt.requestFingerprint,
    squareBookingRequest: attempt.squareBookingRequest,
    confirmation: attempt.confirmation,
    expiresAt: attempt.expiresAt,
  });
  const squareFetch = async (path, options) => {
    assert.equal(path, "/bookings");
    assert.equal(options.method, "POST");
    calls.push(clone(options.body));
    const existing = createdBookings.get(options.body.idempotency_key);
    if (existing) {
      assert.deepEqual(options.body, existing.request);
      return { booking: existing.booking };
    }

    const booking = {
      id: "booking-created-before-timeout",
      status: "ACCEPTED",
      start_at: storedSquareRequest.booking.start_at,
    };
    createdBookings.set(options.body.idempotency_key, {
      booking,
      request: clone(options.body),
    });
    return fetchWithTimeout(
      "https://example.test/v2/bookings",
      { method: "POST" },
      {
        timeoutMs: 10,
        operation: "CreateBooking",
        fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            const abortError = new Error("response lost after Square accepted the booking");
            abortError.name = "AbortError";
            reject(abortError);
          }, { once: true });
        }),
      },
    );
  };
  const attemptStore = {
    releaseForRetry: async (_attempt, leaseToken) =>
      store.releaseForRetry(persisted, leaseToken),
    markSucceeded: async (_attempt, confirmation) =>
      store.markSucceeded(retryAttempt, confirmation),
    markFailed: async () => assert.fail("A CreateBooking timeout must remain retryable"),
  };

  await assert.rejects(
    executeStoredSquareBooking(makeMongooseAttempt(persisted), first.leaseToken, {
      squareFetch,
      bookingAttemptStore: attemptStore,
    }),
    { errorCode: "SQUARE_TIMEOUT" },
  );

  const retry = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });
  const claimed = await store.claimExpiredAttempt(retry.attempt);
  retryAttempt = claimed.attempt;
  const confirmation = await executeStoredSquareBooking(
    makeMongooseAttempt(retryAttempt),
    claimed.leaseToken,
    { squareFetch, bookingAttemptStore: attemptStore },
  );
  const finalAttempt = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].idempotency_key, first.attempt.squareIdempotencyKey);
  assert.equal(calls[1].idempotency_key, first.attempt.squareIdempotencyKey);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(createdBookings.size, 1);
  assert.equal(finalAttempt.attempt.status, "succeeded");
  assert.deepEqual(finalAttempt.attempt.confirmation, confirmation);
});

test("concurrent requests for one attempt share one record and one Square key", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const id = "f95220d9-cf50-4816-b07a-b26f61b1fde4";
  const [first, second] = await Promise.all([
    store.createOrGet({ bookingAttemptId: id, requestFingerprint: fingerprint }),
    store.createOrGet({ bookingAttemptId: id, requestFingerprint: fingerprint }),
  ]);
  assert.equal([first.created, second.created].filter(Boolean).length, 1);
  assert.equal(first.attempt.squareIdempotencyKey, second.attempt.squareIdempotencyKey);
});

test("concurrent duplicate browser attempts share one durable Square key and one owner", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const [first, second] = await Promise.all([
    store.createOrGet({ bookingAttemptId: "cd9ea00b-7ca2-4f6e-a0bd-f33f1d78e4f3", requestFingerprint: fingerprint }),
    store.createOrGet({ bookingAttemptId: "c7d3d9d5-f53b-4e1e-936c-1a9f351122cb", requestFingerprint: fingerprint }),
  ]);
  const owner = first.created ? first : second;
  const duplicate = first.created ? second : first;

  assert.equal(owner.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(store.model.records.length, 1);
  assert.equal(duplicate.attempt.squareIdempotencyKey, owner.attempt.squareIdempotencyKey);
  await assert.rejects(
    store.claimExpiredAttempt(duplicate.attempt),
    { errorCode: "BOOKING_IN_PROGRESS" },
  );

  const persistedAttempt = new BookingAttempt({
    bookingAttemptId: owner.attempt.bookingAttemptId,
    squareIdempotencyKey: owner.attempt.squareIdempotencyKey,
    status: "processing",
    requestFingerprint: fingerprint,
    squareBookingRequest: storedSquareRequest,
    confirmation: { location: "Main location", service: "Brow shaping" },
    expiresAt: new Date("2026-09-15T00:00:00.000Z"),
  });
  let squareCreateCalls = 0;
  await executeStoredSquareBooking(persistedAttempt, owner.leaseToken, {
    squareFetch: async () => {
      squareCreateCalls += 1;
      return {
        booking: {
          id: "booking-1",
          status: "ACCEPTED",
          start_at: "2026-09-14T13:00:00Z",
        },
      };
    },
    bookingAttemptStore: {
      markSucceeded: async () => {},
      markFailed: async () => assert.fail("Only the lease owner should submit"),
      releaseForRetry: async () => assert.fail("Only the lease owner should submit"),
    },
  });
  assert.equal(squareCreateCalls, 1);
});

test("different logical bookings receive independent Square keys", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const differentFingerprint = createRequestFingerprint(
    { ...payload, startAt: "2026-09-14T14:00:00.000Z" },
    "test-secret",
  );
  const [first, second] = await Promise.all([
    store.createOrGet({ bookingAttemptId: "aa848022-7546-4e2d-a0aa-8a25c38e8ad5", requestFingerprint: fingerprint }),
    store.createOrGet({ bookingAttemptId: "e86c6368-a684-4f8b-ad41-7f85abf68beb", requestFingerprint: differentFingerprint }),
  ]);
  assert.notEqual(first.attempt.squareIdempotencyKey, second.attempt.squareIdempotencyKey);
});

test("a second browser attempt replays a completed logical booking without another Square key", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "c5212958-c28e-4f5d-a401-ca780474da6c",
    requestFingerprint: fingerprint,
  });
  const confirmation = {
    id: "booking-1",
    status: "ACCEPTED",
    startAt: payload.startAt,
    location: "Main location",
    service: "Brow shaping",
  };
  await store.markSucceeded(first.attempt, confirmation);

  const replay = await store.createOrGet({
    bookingAttemptId: "8b81c7d7-f3e4-4cc9-bb2c-0d69f2f60b91",
    requestFingerprint: fingerprint,
  });
  assert.equal(replay.created, false);
  assert.equal(replay.attempt.status, "succeeded");
  assert.equal(replay.attempt.squareIdempotencyKey, first.attempt.squareIdempotencyKey);
  assert.deepEqual(replay.attempt.confirmation, confirmation);
});

test("a duplicate browser attempt can claim a retry after a failure before Square", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "2e6249ab-2d24-4cf5-a3c0-e9f252dd7c6f",
    requestFingerprint: fingerprint,
  });
  await store.releaseForRetry(first.attempt, first.leaseToken);

  const retry = await store.createOrGet({
    bookingAttemptId: "998e1aea-6865-4d6f-88d8-2f3ffcf49bdf",
    requestFingerprint: fingerprint,
  });
  const claimed = await store.claimExpiredAttempt(retry.attempt);
  assert.equal(claimed.attempt.squareIdempotencyKey, first.attempt.squareIdempotencyKey);
});

test("maps Square's narrow stale-slot BAD_REQUEST to SLOT_UNAVAILABLE", async () => {
  const attempt = new BookingAttempt({
    bookingAttemptId: "1aab0744-8233-4c40-a10c-60d311728d85",
    squareIdempotencyKey: "a4aa6b4d-1044-4e7b-a19f-30b1009f3233",
    status: "processing",
    requestFingerprint: "test-fingerprint",
    squareBookingRequest: storedSquareRequest,
    confirmation: { location: "Main location", service: "Brow shaping" },
    expiresAt: new Date("2026-09-15T00:00:00.000Z"),
  });
  const squareError = new Error("Square request failed");
  squareError.squareCode = "BAD_REQUEST";
  squareError.details = {
    squareStatus: 400,
    squareErrors: [{
      category: "INVALID_REQUEST_ERROR",
      code: "BAD_REQUEST",
      field: "start_at",
      detail: "That time slot is no longer available.",
    }],
  };
  const failedErrors = [];

  await assert.rejects(
    executeStoredSquareBooking(attempt, "lease-token", {
      squareFetch: async () => { throw squareError; },
      bookingAttemptStore: {
        markSucceeded: async () => assert.fail("Stale slots must not succeed"),
        markFailed: async (_attempt, error) => failedErrors.push(error),
        releaseForRetry: async () => assert.fail("Stale slots are definitive failures"),
      },
    }),
    (error) => {
      assert.equal(error.errorCode, "SLOT_UNAVAILABLE");
      assert.equal(
        error.message,
        "The selected time is no longer available. Please choose another time.",
      );
      return true;
    },
  );
  assert.equal(failedErrors[0]?.errorCode, "SLOT_UNAVAILABLE");
});

test("does not map unrelated Square BAD_REQUEST errors to SLOT_UNAVAILABLE", async () => {
  const attempt = new BookingAttempt({
    bookingAttemptId: "80e5fb46-ea80-4869-8a8c-6f220853351f",
    squareIdempotencyKey: "0e8a1bbd-56b2-4f92-994b-273c54b39c3b",
    status: "processing",
    requestFingerprint: "different-test-fingerprint",
    squareBookingRequest: storedSquareRequest,
    confirmation: { location: "Main location", service: "Brow shaping" },
    expiresAt: new Date("2026-09-15T00:00:00.000Z"),
  });
  const squareError = new Error("Square request failed");
  squareError.squareCode = "BAD_REQUEST";
  squareError.details = {
    squareStatus: 400,
    squareErrors: [{
      category: "INVALID_REQUEST_ERROR",
      code: "BAD_REQUEST",
      field: "location_id",
      detail: "The location is unavailable.",
    }],
  };
  const failedErrors = [];

  await assert.rejects(
    executeStoredSquareBooking(attempt, "lease-token", {
      squareFetch: async () => { throw squareError; },
      bookingAttemptStore: {
        markSucceeded: async () => assert.fail("The request must fail"),
        markFailed: async (_attempt, error) => failedErrors.push(error),
        releaseForRetry: async () => assert.fail("A 400 is definitive"),
      },
    }),
    (error) => error === squareError,
  );
  assert.equal(failedErrors[0], squareError);
});

test("a Square CreateBooking 429 releases the same attempt for a customer-controlled retry", async () => {
  const store = makeStore();
  const fingerprint = createRequestFingerprint(payload, "test-secret");
  const first = await store.createOrGet({
    bookingAttemptId: "f7d7f1af-4df0-4b84-8e53-3f8595e99d1a",
    requestFingerprint: fingerprint,
  });
  const persisted = await store.storeSquareRequest(first.attempt, first.leaseToken, storedSquareRequest, {
    location: "Main location",
    service: "Brow shaping",
  });
  const makeMongooseAttempt = (attempt) => new BookingAttempt({
    bookingAttemptId: attempt.bookingAttemptId,
    squareIdempotencyKey: attempt.squareIdempotencyKey,
    status: attempt.status,
    requestFingerprint: attempt.requestFingerprint,
    squareBookingRequest: attempt.squareBookingRequest,
    confirmation: attempt.confirmation,
    expiresAt: attempt.expiresAt,
  });
  const rateLimitError = new Error("Square is temporarily rate limited.");
  rateLimitError.statusCode = 429;
  rateLimitError.errorCode = "SQUARE_RATE_LIMITED";
  rateLimitError.retryable = true;
  rateLimitError.details = { squareStatus: 429, retryAfterSeconds: 7 };
  let squareCalls = 0;
  const submittedBodies = [];
  let retryAttempt;
  const attemptStore = {
    releaseForRetry: async (_attempt, leaseToken) => store.releaseForRetry(persisted, leaseToken),
    markFailed: async () => assert.fail("A Square 429 must remain recoverable"),
    markSucceeded: async (_attempt, confirmation) => store.markSucceeded(retryAttempt, confirmation),
  };

  await assert.rejects(
    executeStoredSquareBooking(makeMongooseAttempt(persisted), first.leaseToken, {
      squareFetch: async (_path, options) => {
        squareCalls += 1;
        submittedBodies.push(clone(options.body));
        throw rateLimitError;
      },
      bookingAttemptStore: attemptStore,
    }),
    (error) => error === rateLimitError,
  );

  assert.equal(squareCalls, 1);
  const retry = await store.createOrGet({
    bookingAttemptId: first.attempt.bookingAttemptId,
    requestFingerprint: fingerprint,
  });
  const duplicate = await store.createOrGet({
    bookingAttemptId: "c8338661-e3b3-4aa2-9b4d-2b8bff782d6f",
    requestFingerprint: fingerprint,
  });
  const claims = await Promise.allSettled([
    store.claimExpiredAttempt(retry.attempt),
    store.claimExpiredAttempt(duplicate.attempt),
  ]);
  assert.equal(claims.filter((claim) => claim.status === "fulfilled").length, 1);
  assert.equal(claims.filter((claim) => claim.status === "rejected").length, 1);
  const claimed = claims.find((claim) => claim.status === "fulfilled").value;
  retryAttempt = claimed.attempt;
  const confirmation = await executeStoredSquareBooking(makeMongooseAttempt(retryAttempt), claimed.leaseToken, {
    squareFetch: async (_path, options) => {
      squareCalls += 1;
      submittedBodies.push(clone(options.body));
      return { booking: { id: "booking-after-429", status: "ACCEPTED", start_at: storedSquareRequest.booking.start_at } };
    },
    bookingAttemptStore: attemptStore,
  });

  assert.equal(squareCalls, 2, "the second call occurs only after the customer-controlled retry");
  assert.deepEqual(submittedBodies[0], submittedBodies[1]);
  assert.equal(submittedBodies[1].idempotency_key, first.attempt.squareIdempotencyKey);
  assert.deepEqual(submittedBodies[1], {
    idempotency_key: first.attempt.squareIdempotencyKey,
    ...storedSquareRequest,
  });
  assert.equal(confirmation.id, "booking-after-429");
  const different = await store.createOrGet({
    bookingAttemptId: "33d75a56-2415-4c88-922a-6d25b64d9e42",
    requestFingerprint: createRequestFingerprint({ ...payload, startAt: "2026-09-14T14:00:00.000Z" }, "test-secret"),
  });
  assert.equal(different.created, true);
  assert.notEqual(different.attempt.squareIdempotencyKey, first.attempt.squareIdempotencyKey);
});

test("a persisted Square booking request is converted from a Mongoose subdocument before submission", async () => {
  const attempt = new BookingAttempt({
    bookingAttemptId: "c79f985d-b444-46fc-ab30-71e8e2136d20",
    squareIdempotencyKey: "a4aa6b4d-1044-4e7b-a19f-30b1009f3233",
    status: "processing",
    requestFingerprint: "test-fingerprint",
    squareBookingRequest: storedSquareRequest,
    confirmation: { location: "Main location", service: "Brow shaping" },
    expiresAt: new Date("2026-09-15T00:00:00.000Z"),
  });
  assert.equal(typeof attempt.squareBookingRequest.toObject, "function");

  const submittedBodies = [];
  const squareFetch = async (path, options) => {
    assert.equal(path, "/bookings");
    assert.equal(options.method, "POST");
    submittedBodies.push(options.body);
    return {
      booking: {
        id: "booking-1",
        status: "ACCEPTED",
        start_at: "2026-09-14T13:00:00Z",
      },
    };
  };
  const bookingAttemptStore = {
    markSucceeded: async () => {},
    markFailed: async () => assert.fail("Square submission should not fail"),
    releaseForRetry: async () => assert.fail("Square submission should not be retried"),
  };

  await executeStoredSquareBooking(attempt, "lease-token", {
    squareFetch,
    bookingAttemptStore,
  });
  await executeStoredSquareBooking(attempt, "lease-token", {
    squareFetch,
    bookingAttemptStore,
  });

  assert.equal(submittedBodies.length, 2);
  assert.deepEqual(submittedBodies[0], submittedBodies[1]);

  const body = submittedBodies[0];
  assert.equal(body.idempotency_key, attempt.squareIdempotencyKey);
  assert.deepEqual(Object.keys(body).sort(), ["booking", "idempotency_key"]);
  assert.equal(body.booking.start_at, "2026-09-14T13:00:00Z");
  assert.equal(body.booking.location_id, "location-1");
  assert.equal(body.booking.customer_id, "customer-1");
  assert.equal(body.booking.appointment_segments.length, 1);

  const [segment] = body.booking.appointment_segments;
  assert.equal(typeof segment.duration_minutes, "number");
  assert.equal(typeof segment.service_variation_id, "string");
  assert.equal(typeof segment.service_variation_version, "number");
  assert.equal(typeof segment.team_member_id, "string");

  const serializedBody = JSON.stringify(body);
  for (const mongooseInternal of ["$__parent", "$__", "$isNew", "_doc", "$basePath"]) {
    assert.equal(serializedBody.includes(mongooseInternal), false);
  }
});
