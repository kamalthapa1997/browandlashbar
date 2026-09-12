const express = require("express");

const {
  getServices,
  createService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { optionalAuth, requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", optionalAuth, getServices);
router.post("/", requireAuth, requireAdmin, createService);
router.put("/:id", requireAuth, requireAdmin, updateService);
router.delete("/:id", requireAuth, requireAdmin, deleteService);

module.exports = router;
