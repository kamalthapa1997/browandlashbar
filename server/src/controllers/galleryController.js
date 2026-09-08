const Gallery = require("../models/Gallery");
const asyncHandler = require("../utils/asyncHandler");
const { destroyCloudinaryAsset } = require("../utils/cloudinaryHelpers");
const cloudinary = require("../config/cloudinary");
const {
  validateGalleryPayload,
  validateObjectId,
} = require("../utils/validators");

function imageMetadata(upload) {
  const width = Number(upload?.width);
  const height = Number(upload?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return {};
  }

  return { width, height, aspectRatio: width / height };
}

async function hydrateLegacyDimensions(item) {
  if (item.width && item.height && item.aspectRatio) return item;

  try {
    const metadata = await getCloudinaryMetadata(item.publicId);

    if (metadata.width) {
      item.set(metadata);
      await item.save();
    }
  } catch (_error) {
    // A gallery item remains usable even if a legacy asset cannot be inspected.
    // The client uses a fixed editorial fallback ratio in that rare case.
  }

  return item;
}

async function getCloudinaryMetadata(publicId) {
  try {
    const resource = await cloudinary.api.resource(publicId, {
      resource_type: "image",
    });
    return imageMetadata(resource);
  } catch (_error) {
    return {};
  }
}

const getGallery = asyncHandler(async (_request, response) => {
  const items = await Gallery.find().sort({ createdAt: -1 });
  await Promise.all(items.map(hydrateLegacyDimensions));
  response.set("Cache-Control", "no-store").json(items);
});

const createGalleryItem = asyncHandler(async (request, response) => {
  if (!request.file) {
    throw Object.assign(new Error("Image upload is required"), {
      statusCode: 400,
    });
  }

  const { caption } = validateGalleryPayload(request.body);
  let item;

  try {
    const metadata = await getCloudinaryMetadata(request.file.filename);
    item = await Gallery.create({
      imageUrl: request.file.path,
      publicId: request.file.filename,
      caption,
      ...metadata,
    });
  } catch (error) {
    await destroyCloudinaryAsset(request.file.filename).catch(() => {});
    throw error;
  }

  response.status(201).json(item);
});

const updateGalleryItem = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "gallery");
  const item = await Gallery.findById(request.params.id);

  if (!item) {
    throw Object.assign(new Error("Gallery item not found"), {
      statusCode: 404,
    });
  }

  const { caption } = validateGalleryPayload(request.body);
  const previousPublicId = item.publicId;
  const uploadedPublicId = request.file ? request.file.filename : null;

  if (caption !== undefined) {
    item.caption = caption;
  }

  if (request.file) {
    const metadata = await getCloudinaryMetadata(request.file.filename);
    item.imageUrl = request.file.path;
    item.publicId = request.file.filename;
    item.width = metadata.width;
    item.height = metadata.height;
    item.aspectRatio = metadata.aspectRatio;
  }

  try {
    await item.save();
  } catch (error) {
    if (uploadedPublicId) {
      await destroyCloudinaryAsset(uploadedPublicId).catch(() => {});
    }
    throw error;
  }

  if (
    uploadedPublicId &&
    previousPublicId &&
    previousPublicId !== uploadedPublicId
  ) {
    await destroyCloudinaryAsset(previousPublicId).catch(() => {});
  }

  response.json(item);
});

const deleteGalleryItem = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "gallery");
  const item = await Gallery.findById(request.params.id);

  if (!item) {
    throw Object.assign(new Error("Gallery item not found"), {
      statusCode: 404,
    });
  }

  await destroyCloudinaryAsset(item.publicId);
  await item.deleteOne();

  response.json({ message: "Gallery item deleted" });
});

const likeGalleryItem = asyncHandler(async (request, response) => {
  validateObjectId(request.params.id, "gallery");
  const item = await Gallery.findByIdAndUpdate(
    request.params.id,
    { $inc: { likes: 1 } },
    { new: true },
  );

  if (!item) {
    throw Object.assign(new Error("Gallery item not found"), {
      statusCode: 404,
    });
  }

  response.json(item);
});

module.exports = {
  getGallery,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  likeGalleryItem,
};
