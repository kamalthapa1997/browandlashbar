const Settings = require("../models/Settings");
const asyncHandler = require("../utils/asyncHandler");
const { destroyCloudinaryAsset } = require("../utils/cloudinaryHelpers");
const { validateSettingsPayload } = require("../utils/validators");

async function getSettingsDocument() {
  let settings = await Settings.findOne();

  if (!settings) {
    settings = await Settings.create({});
  }

  return settings;
}

const getSettings = asyncHandler(async (_request, response) => {
  // Public reads return schema defaults without creating a document. A write is
  // reserved for the authenticated settings update path.
  const settings = await Settings.findOne() || new Settings();
  response.set("Cache-Control", "no-store").json(settings);
});

const upsertSettings = asyncHandler(async (request, response) => {
  const settings = await getSettingsDocument();
  const updates = validateSettingsPayload(request.body);
  const previousLogoPublicId = settings.logoPublicId;
  const uploadedLogoPublicId = request.file ? request.file.filename : null;

  const galleryUpdates = updates.gallery;
  delete updates.gallery;
  Object.assign(settings, updates);

  if (galleryUpdates) {
    settings.gallery = {
      ...(settings.gallery?.toObject?.() || settings.gallery || {}),
      ...galleryUpdates,
    };
  }

  if (request.file) {
    settings.logoUrl = request.file.path;
    settings.logoPublicId = request.file.filename;
  }

  try {
    await settings.save();
  } catch (error) {
    if (uploadedLogoPublicId) {
      await destroyCloudinaryAsset(uploadedLogoPublicId).catch(() => {});
    }

    throw error;
  }

  if (
    uploadedLogoPublicId &&
    previousLogoPublicId &&
    previousLogoPublicId !== uploadedLogoPublicId
  ) {
    await destroyCloudinaryAsset(previousLogoPublicId);
  }

  response.json(settings);
});

module.exports = { getSettings, upsertSettings };
