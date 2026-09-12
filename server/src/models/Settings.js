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
    homepageOffer: {
      type: String,
      trim: true,
      default: "",
    },
    homepageOfferLink: {
      type: String,
      trim: true,
      default: "",
    },
    gallery: {
      eyebrow: {
        type: String,
        trim: true,
        default: "OUR PORTFOLIO",
      },
      title: {
        type: String,
        trim: true,
        default: "Beauty in every detail",
      },
      description: {
        type: String,
        trim: true,
        default: "Explore our latest lash and brow work.",
      },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Settings", settingsSchema);
