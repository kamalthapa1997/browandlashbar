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

async function clearOtherFeaturedItems(item) {
  if (!item.featured || item.active === false) return;

  await Gallery.updateMany(
    { _id: { $ne: item._id }, featured: true },
    { $set: { featured: false } },
  );
}

function sortGalleryItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((first, second) => {
      const featuredDifference =
        Number(Boolean(second.item.featured)) - Number(Boolean(first.item.featured));
      if (featuredDifference) return featuredDifference;

      const firstOrder = Number(first.item.displayOrder);
      const secondOrder = Number(second.item.displayOrder);
      const displayOrderDifference =
        (Number.isFinite(firstOrder) ? firstOrder : first.index) -
        (Number.isFinite(secondOrder) ? secondOrder : second.index);
      return displayOrderDifference || first.index - second.index;
    })
    .map(({ item }) => item);
}

const getGallery = asyncHandler(async (request, response) => {
  const filter = request.admin ? {} : { active: { $ne: false } };
  const items = await Gallery.find(filter).sort({ createdAt: -1 });
  await Promise.all(items.map(hydrateLegacyDimensions));
  response.set("Cache-Control", "no-store").json(sortGalleryItems(items));
});

const createGalleryItem = asyncHandler(async (request, response) => {
  if (!request.file) {
    throw Object.assign(new Error("Image upload is required"), {
      statusCode: 400,
    });
  }

  const galleryPayload = validateGalleryPayload(request.body);
  if (galleryPayload.active === false) {
    galleryPayload.featured = false;
  }
  let item;

  try {
    const metadata = await getCloudinaryMetadata(request.file.filename);
    item = await Gallery.create({
      imageUrl: request.file.path,
      publicId: request.file.filename,
      ...galleryPayload,
      ...metadata,
    });
  } catch (error) {
    await destroyCloudinaryAsset(request.file.filename).catch(() => {});
    throw error;
  }

  await clearOtherFeaturedItems(item);

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

  const updates = validateGalleryPayload(request.body, {
    partial: true,
    allowedCategories: [item.category].filter(Boolean),
  });
  const previousPublicId = item.publicId;
  const uploadedPublicId = request.file ? request.file.filename : null;

  Object.assign(item, updates);

  if (item.active === false) {
    item.featured = false;
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

  await clearOtherFeaturedItems(item);

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
