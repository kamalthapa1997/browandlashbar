const express = require("express");

const {
  getGallery,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  likeGalleryItem,
} = require("../controllers/galleryController");
const { protect } = require("../middleware/authMiddleware");
const { createUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();
const upload = createUpload("mero-brow-and-lash-bar/gallery");

router.get("/", getGallery);
router.post("/", protect, upload.single("image"), createGalleryItem);
router.put("/:id", protect, upload.single("image"), updateGalleryItem);
router.patch("/:id/like", likeGalleryItem);
router.delete("/:id", protect, deleteGalleryItem);

module.exports = router;
