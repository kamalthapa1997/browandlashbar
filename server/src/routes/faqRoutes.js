const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");
const {
  getActiveFaqs,
  getAdminFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
} = require("../controllers/faqController");

const router = express.Router();

router.get("/", getActiveFaqs);
router.get("/admin", requireAuth, requireAdmin, getAdminFaqs);
router.post("/", requireAuth, requireAdmin, createFaq);
router.put("/:id", requireAuth, requireAdmin, updateFaq);
router.delete("/:id", requireAuth, requireAdmin, deleteFaq);

module.exports = router;
