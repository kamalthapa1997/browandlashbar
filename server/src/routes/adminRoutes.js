const express = require("express");

const {
  getSession,
  loginAdmin,
  logoutAdmin,
} = require("../controllers/adminController");
const {
  optionalAuth,
  requireAuth,
  requireAdmin,
} = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
});

router.post("/login", loginRateLimiter, loginAdmin);
router.get("/session", optionalAuth, getSession);
router.post("/logout", requireAuth, requireAdmin, logoutAdmin);

module.exports = router;
