const express = require("express");

const {
  getSettings,
  upsertSettings,
} = require("../controllers/settingsController");
const { protect } = require("../middleware/authMiddleware");
const { createUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();
const upload = createUpload("mero-brow-and-lash-bar/branding");

router.get("/", getSettings);
router.put("/", protect, upload.single("logo"), upsertSettings);

module.exports = router;
