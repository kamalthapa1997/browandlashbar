const mongoose = require("mongoose");

const oauthStateSchema = new mongoose.Schema(
  {
    stateHash: { type: String, required: true, unique: true, select: false },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    sessionVersion: { type: Number, required: true },
    environment: { type: String, enum: ["sandbox", "production"], required: true },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

oauthStateSchema.index({
  stateHash: 1,
  adminId: 1,
  sessionVersion: 1,
  environment: 1,
  consumedAt: 1,
  expiresAt: 1,
});

module.exports = mongoose.model("OAuthState", oauthStateSchema);
