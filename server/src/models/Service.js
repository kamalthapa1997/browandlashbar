const mongoose = require("mongoose");

const serviceCategories = require("../constants/serviceCategories");

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: serviceCategories,
      required: true,
    },
    square: {
      catalogItemId: { type: String, trim: true, default: "" },
      variationId: { type: String, trim: true, default: "" },
      variationVersion: { type: Number, min: 0 },
      // An empty list means any currently bookable Square team member.
      teamMemberIds: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Service", serviceSchema);
