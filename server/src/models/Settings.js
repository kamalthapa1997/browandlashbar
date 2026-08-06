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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Settings", settingsSchema);
