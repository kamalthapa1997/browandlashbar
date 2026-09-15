const mongoose = require("mongoose");

const galleryCategorySchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true },
);

galleryCategorySchema.index({ value: 1 }, { unique: true });

module.exports = mongoose.model("GalleryCategory", galleryCategorySchema);
