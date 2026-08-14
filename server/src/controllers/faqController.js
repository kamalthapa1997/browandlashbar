const Faq = require("../models/Faq");
const asyncHandler = require("../utils/asyncHandler");
const { validateFaqPayload, validateObjectId } = require("../utils/validators");

const sortOrder = { displayOrder: 1, createdAt: 1 };

const getActiveFaqs = asyncHandler(async (_request, response) => {
  const faqs = await Faq.find({ isActive: true }).sort(sortOrder);
  response.set("Cache-Control", "no-store").json(faqs);
});

const getAdminFaqs = asyncHandler(async (_request, response) => {
  const faqs = await Faq.find().sort(sortOrder);
  response.set("Cache-Control", "no-store").json(faqs);
});

const createFaq = asyncHandler(async (request, response) => {
  const faq = await Faq.create(validateFaqPayload(request.body));
  response.status(201).json(faq);
});

const updateFaq = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "FAQ");
  const faq = await Faq.findById(request.params.id);

  if (!faq) throw Object.assign(new Error("FAQ not found"), { statusCode: 404 });

  Object.assign(faq, validateFaqPayload(request.body, { partial: true }));
  await faq.save();
  response.json(faq);
});

const deleteFaq = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "FAQ");
  const faq = await Faq.findById(request.params.id);

  if (!faq) throw Object.assign(new Error("FAQ not found"), { statusCode: 404 });

  await faq.deleteOne();
  response.json({ message: "FAQ deleted" });
});

module.exports = { getActiveFaqs, getAdminFaqs, createFaq, updateFaq, deleteFaq };
