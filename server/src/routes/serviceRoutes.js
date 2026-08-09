const express = require("express");

const {
  getServices,
  createService,
  updateService,
  deleteService,
} = require("../controllers/serviceController");
const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", getServices);
router.post("/", requireAuth, requireAdmin, createService);
router.put("/:id", requireAuth, requireAdmin, updateService);
router.delete("/:id", requireAuth, requireAdmin, deleteService);

module.exports = router;
