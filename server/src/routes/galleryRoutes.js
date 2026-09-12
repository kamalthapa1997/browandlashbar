const express = require("express");

const {
  getGallery,
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

const router = express.Router();
const upload = createUpload("mero-brow-and-lash-bar/gallery");

router.get("/", optionalAuth, getGallery);
router.post("/", requireAuth, requireAdmin, upload.single("image"), createGalleryItem);
router.put("/:id", requireAuth, requireAdmin, upload.single("image"), updateGalleryItem);
router.patch("/:id/like", likeGalleryItem);
router.delete("/:id", requireAuth, requireAdmin, deleteGalleryItem);

module.exports = router;
