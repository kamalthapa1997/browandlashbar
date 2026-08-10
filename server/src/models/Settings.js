const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    logoPublicId: {
      type: String,
      trim: true,
      default: "",
    },
    businessName: {
      type: String,
      trim: true,
      default: "Mero Brow & Lash Bar",
    },
    contactPhone: {
      type: String,
      trim: true,
      default: "",
    },
    businessEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    streetAddress: {
      type: String,
      trim: true,
      default: "",
    },
    suiteNumber: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    zipCode: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Settings", settingsSchema);
