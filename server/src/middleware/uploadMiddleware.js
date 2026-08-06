const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");
const createHttpError = require("../utils/httpError");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function buildStorage(folder) {
  return new CloudinaryStorage({
    cloudinary,
    params: async (_request, file) => ({
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`,
    }),
  });
}

function createUpload(folder) {
  return multer({
    storage: buildStorage(folder),
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (_request, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(createHttpError(400, "Only JPG, PNG, and WebP images are allowed"));
        return;
      }

      callback(null, true);
    },
  });
}

module.exports = { createUpload };
