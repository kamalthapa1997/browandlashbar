const crypto = require("crypto");

const BookingAttempt = require("../models/BookingAttempt");
const { getSquareConfig } = require("../config/square");
const createHttpError = require("../utils/httpError");

const ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSING_LEASE_MS = 30 * 1000;

function canonicalizeVariationIds(variationIds) {
  return [...variationIds].sort();
}

function createRequestFingerprint({ variationIds, startAt, customer, phoneNumber }, secret) {
  const payload = JSON.stringify({
    variationIds: canonicalizeVariationIds(variationIds),
    startAt,
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber,
      email: customer.email,
    },
  });
  return crypto
    .createHmac("sha256", secret || getSquareConfig().applicationSecret)
    .update(payload)
    .digest("hex");
}

function fingerprintsMatch(first, second) {
  if (typeof first !== "string" || typeof second !== "string" || first.length !== second.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(first), Buffer.from(second));
}

function createAttemptMismatchError() {
  return createHttpError(
    409,
    "This booking attempt no longer matches the selected appointment. Please start again.",
    undefined,
    "BOOKING_ATTEMPT_MISMATCH",
  );
}

function createAttemptInProgressError() {
  return createHttpError(
    409,
    "Your booking confirmation is still being processed. Please wait a moment and try again.",
    undefined,
    "BOOKING_IN_PROGRESS",
  );
}

class BookingAttemptStore {
  constructor(model = BookingAttempt, options = {}) {
    this.model = model;
    this.attemptTtlMs = options.attemptTtlMs || ATTEMPT_TTL_MS;
    this.processingLeaseMs = options.processingLeaseMs || PROCESSING_LEASE_MS;
    this.now = options.now || Date.now;
  }

  async createOrGet({ bookingAttemptId, requestFingerprint }) {
    const now = this.now();
    const leaseToken = crypto.randomUUID();
    try {
      const attempt = await this.model.create({
        bookingAttemptId,
        squareIdempotencyKey: crypto.randomUUID(),
        status: "processing",
        requestFingerprint,
        processingLeaseToken: leaseToken,
        processingLeaseExpiresAt: new Date(now + this.processingLeaseMs),
        expiresAt: new Date(now + this.attemptTtlMs),
      });
      return { attempt, created: true, leaseToken };
    } catch (error) {
      if (error?.code !== 11000) throw error;
      const attempt = await this.model.findOne({ bookingAttemptId }).select(
        "+squareIdempotencyKey +requestFingerprint +processingLeaseToken",
      );
      if (attempt) {
        if (!fingerprintsMatch(attempt.requestFingerprint, requestFingerprint)) {
          throw createAttemptMismatchError();
        }
        return { attempt, created: false, leaseToken: "" };
      }

      const matchingAttempt = await this.model.findOne({ requestFingerprint }).select(
        "+squareIdempotencyKey +requestFingerprint +processingLeaseToken",
      );
      if (!matchingAttempt) throw error;
      return { attempt: matchingAttempt, created: false, leaseToken: "" };
    }
  }

  async claimExpiredAttempt(attempt) {
    const now = new Date(this.now());
    const leaseToken = crypto.randomUUID();
    const claimed = await this.model.findOneAndUpdate(
      {
        _id: attempt._id,
        status: "processing",
        processingLeaseExpiresAt: { $lte: now },
      },
      {
        $set: {
          processingLeaseToken: leaseToken,
          processingLeaseExpiresAt: new Date(now.getTime() + this.processingLeaseMs),
        },
      },
      { new: true },
    ).select("+squareIdempotencyKey +requestFingerprint +processingLeaseToken");
    if (!claimed) throw createAttemptInProgressError();
    return { attempt: claimed, leaseToken };
  }

  async renewLease(attempt, leaseToken) {
    const now = new Date(this.now());
    const renewed = await this.model.findOneAndUpdate(
      {
        _id: attempt._id,
        status: "processing",
        processingLeaseToken: leaseToken,
        // Once this boundary is crossed, the immutable request and Square
        // idempotency key protect retries; validation no longer renews a lease.
        squareBookingRequest: { $exists: false },
      },
      {
        $set: {
          processingLeaseExpiresAt: new Date(now.getTime() + this.processingLeaseMs),
        },
      },
      { new: true },
    ).select("+squareIdempotencyKey +requestFingerprint +processingLeaseToken");
    if (!renewed) throw createAttemptInProgressError();
    return renewed;
  }

  async storeSquareRequest(attempt, leaseToken, squareBookingRequest, metadata) {
    const updated = await this.model.findOneAndUpdate(
      { _id: attempt._id, status: "processing", processingLeaseToken: leaseToken },
      {
        $set: {
          squareBookingRequest,
          "confirmation.location": metadata.location,
          "confirmation.service": metadata.service,
        },
      },
      { new: true },
    ).select("+squareIdempotencyKey +requestFingerprint +processingLeaseToken");
    if (!updated) throw createAttemptInProgressError();
    return updated;
  }

  async releaseForRetry(attempt, leaseToken) {
    await this.model.findOneAndUpdate(
      { _id: attempt._id, status: "processing", processingLeaseToken: leaseToken },
      { $set: { processingLeaseExpiresAt: new Date(0) }, $unset: { processingLeaseToken: 1 } },
      { new: true },
    );
  }

  async markSucceeded(attempt, confirmation) {
    return this.model.findOneAndUpdate(
      { _id: attempt._id, status: "processing" },
      {
        $set: {
          status: "succeeded",
          squareBookingId: confirmation.id,
          confirmation,
        },
        $unset: { processingLeaseToken: 1, processingLeaseExpiresAt: 1 },
      },
      { new: true },
    );
  }

  async markFailed(attempt, error) {
    return this.model.findOneAndUpdate(
      { _id: attempt._id, status: "processing" },
      {
        $set: {
          status: "failed",
          failure: { status: error.statusCode || 502, code: error.errorCode || "BOOKING_FAILED", message: error.message },
        },
        $unset: { processingLeaseToken: 1, processingLeaseExpiresAt: 1 },
      },
      { new: true },
    );
  }
}

function throwStoredFailure(attempt) {
  const failure = attempt.failure || {};
  throw createHttpError(
    failure.status || 409,
    failure.message || "This booking attempt cannot be completed. Please start again.",
    undefined,
    failure.code || "BOOKING_ATTEMPT_FAILED",
  );
}

module.exports = {
  ATTEMPT_TTL_MS,
  PROCESSING_LEASE_MS,
  BookingAttemptStore,
  canonicalizeVariationIds,
  createAttemptInProgressError,
  createRequestFingerprint,
  throwStoredFailure,
};
