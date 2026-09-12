const express = require("express");

const { requireAuth, requireAdmin } = require("../middleware/authMiddleware");
const {
  beginOAuth,
  bookingRateLimiter,
  completeOAuth,
  createBooking,
  getAvailability,
  getBookingServices,
  getCatalogServices,
  getLocations,
  getMenu,
  getStatus,
  getTeamMembers,
  receiveWebhook,
} = require("../controllers/squareController");

const router = express.Router();

router.get("/status", getStatus);
router.get("/booking-services", bookingRateLimiter, getBookingServices);
router.get("/menu", getMenu);
router.get("/oauth", requireAuth, requireAdmin, beginOAuth);
router.get("/oauth/callback", completeOAuth);
router.get("/locations", requireAuth, requireAdmin, getLocations);
router.get("/catalog/services", requireAuth, requireAdmin, getCatalogServices);
router.get("/team-members", requireAuth, requireAdmin, getTeamMembers);
router.post("/availability", bookingRateLimiter, getAvailability);
router.post("/bookings", bookingRateLimiter, createBooking);
router.post("/webhooks", receiveWebhook);

module.exports = router;
