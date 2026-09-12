const mongoose = require("mongoose");

const appointmentSegmentSchema = new mongoose.Schema(
  {
    duration_minutes: { type: Number, required: true },
    service_variation_id: { type: String, required: true },
    service_variation_version: { type: Number, required: true },
    team_member_id: { type: String, required: true },
  },
  { _id: false },
);

const squareBookingRequestSchema = new mongoose.Schema(
  {
    booking: {
      start_at: { type: String, required: true },
      location_id: { type: String, required: true },
      customer_id: { type: String, required: true },
      appointment_segments: { type: [appointmentSegmentSchema], required: true },
    },
  },
  { _id: false },
);

const confirmationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    status: { type: String, required: true },
    startAt: { type: String, required: true },
    location: { type: String, required: true },
    service: { type: String, required: true },
  },
  { _id: false },
);

const failureSchema = new mongoose.Schema(
  {
    status: { type: Number, required: true },
    code: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const bookingAttemptSchema = new mongoose.Schema(
  {
    bookingAttemptId: { type: String, required: true, unique: true },
    squareIdempotencyKey: { type: String, required: true, select: false },
    status: { type: String, enum: ["processing", "succeeded", "failed"], required: true },
    requestFingerprint: { type: String, required: true, unique: true, select: false },
    squareBookingRequest: { type: squareBookingRequestSchema },
    squareBookingId: { type: String },
    confirmation: { type: confirmationSchema },
    failure: { type: failureSchema },
    processingLeaseToken: { type: String, select: false },
    processingLeaseExpiresAt: { type: Date },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BookingAttempt", bookingAttemptSchema);
