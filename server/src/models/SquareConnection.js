const mongoose = require("mongoose");

const squareConnectionSchema = new mongoose.Schema(
  {
    connectionKey: { type: String, required: true, unique: true, default: "primary" },
    merchantId: { type: String, trim: true },
    environment: { type: String, enum: ["sandbox", "production"], required: true },
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, select: false },
    expiresAt: { type: Date },
    scopes: { type: [String], default: [] },
    authMode: {
      type: String,
      enum: ["oauth", "sandbox_development"],
      default: "oauth",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("SquareConnection", squareConnectionSchema);
