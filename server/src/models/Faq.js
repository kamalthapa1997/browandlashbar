const mongoose = require("mongoose");

const faqCategories = require("../constants/faqCategories");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 240 },
    answer: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, required: true, enum: faqCategories, default: "General" },
    displayOrder: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

faqSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model("Faq", faqSchema);
