const multer = require("multer");
const crypto = require("crypto");
const { Transform } = require("stream");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const cloudinary = require("../config/cloudinary");
const createHttpError = require("../utils/httpError");

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function detectImageMimeType(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return "";
}

class ImageSignatureValidator extends Transform {
  constructor(expectedMimeType) {
    super();
    this.expectedMimeType = expectedMimeType;
    this.prefix = Buffer.alloc(0);
    this.validated = false;
  }

  validatePrefix(callback) {
    const detectedMimeType = detectImageMimeType(this.prefix);
    if (detectedMimeType) {
      if (detectedMimeType !== this.expectedMimeType) {
        callback(
          createHttpError(
            400,
            "Uploaded file content does not match its image type.",
          ),
        );
        return false;
      }

      this.validated = true;
      callback(null, this.prefix);
      this.prefix = Buffer.alloc(0);
      return true;
    }

    if (this.prefix.length >= 12) {
      callback(
        createHttpError(
          400,
          "Only valid JPG, PNG, and WebP image files are allowed.",
        ),
      );
      return true;
    }

    return false;
  }

  _transform(chunk, _encoding, callback) {
    if (this.validated) {
      callback(null, chunk);
      return;
    }

    this.prefix = Buffer.concat([this.prefix, chunk]);
    this.validatePrefix(callback);
  }

  _flush(callback) {
    if (this.validated) {
      callback();
      return;
    }

    this.validatePrefix((error) => {
      callback(
        error ||
          createHttpError(
            400,
            "Only valid JPG, PNG, and WebP image files are allowed.",
          ),
      );
    });
  }
}

function buildStorage(folder) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (_request, file) => ({
      folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: `${Date.now()}-${crypto.randomUUID()}`,
    }),
  });

  storage.upload = function uploadValidatedImage(options, file) {
    return new Promise((resolve, reject) => {
      const validator = new ImageSignatureValidator(file.mimetype);
      const uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );

      validator.on("error", (error) => {
        uploadStream.destroy();
        reject(error);
      });
      file.stream.pipe(validator).pipe(uploadStream);
    });
  };

  return storage;
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
module.exports.__testables = { ImageSignatureValidator, detectImageMimeType };
