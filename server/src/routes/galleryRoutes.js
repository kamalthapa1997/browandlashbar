const express = require("express");

const {
  getGallery,
  getGalleryCategories,
  createGalleryCategory,
  deleteGalleryCategory,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  likeGalleryItem,
} = require("../controllers/galleryController");
const {
  optionalAuth,
  requireAuth,
  requireAdmin,
} = require("../middleware/authMiddleware");
const { createUpload } = require("../middleware/uploadMiddleware");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");

const router = express.Router();
const upload = createUpload("mero-brow-and-lash-bar/gallery");
const galleryLikeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
});

router.get("/", optionalAuth, getGallery);
router.get("/categories", getGalleryCategories);
router.post("/categories", requireAuth, requireAdmin, createGalleryCategory);
router.delete("/categories/:categoryId", requireAuth, requireAdmin, deleteGalleryCategory);
router.post("/", requireAuth, requireAdmin, upload.single("image"), createGalleryItem);
router.put("/:id", requireAuth, requireAdmin, upload.single("image"), updateGalleryItem);
router.patch("/:id/like", galleryLikeRateLimiter, likeGalleryItem);
router.delete("/:id", requireAuth, requireAdmin, deleteGalleryItem);

module.exports = router;
