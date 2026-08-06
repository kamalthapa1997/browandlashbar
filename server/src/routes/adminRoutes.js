const express = require("express");

const { loginAdmin } = require("../controllers/adminController");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
});

router.post("/login", loginRateLimiter, loginAdmin);

module.exports = router;
