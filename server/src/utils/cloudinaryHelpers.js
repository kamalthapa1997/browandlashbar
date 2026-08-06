const cloudinary = require("../config/cloudinary");

async function destroyCloudinaryAsset(publicId) {
  if (!publicId) {
    return;
  }

  const result = await cloudinary.uploader.destroy(publicId);

  if (result && result.result !== "ok" && result.result !== "not found") {
    const error = new Error("Cloudinary asset deletion failed");
    error.statusCode = 502;
    error.details = { publicId, result: result.result };
    throw error;
  }
}

module.exports = { destroyCloudinaryAsset };
