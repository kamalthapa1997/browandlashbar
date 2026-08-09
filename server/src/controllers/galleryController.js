const Gallery = require("../models/Gallery");
const asyncHandler = require("../utils/asyncHandler");
const { destroyCloudinaryAsset } = require("../utils/cloudinaryHelpers");
const {
  validateGalleryPayload,
  validateObjectId,
} = require("../utils/validators");

const getGallery = asyncHandler(async (_request, response) => {
  const items = await Gallery.find().sort({ createdAt: -1 });
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
    item = await Gallery.create({
      imageUrl: request.file.path,
      publicId: request.file.filename,
      caption,
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
    item.imageUrl = request.file.path;
    item.publicId = request.file.filename;
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
