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
  const settings = await getSettingsDocument();
  response.set("Cache-Control", "no-store").json(settings);
});

const upsertSettings = asyncHandler(async (request, response) => {
  const settings = await getSettingsDocument();
  const updates = validateSettingsPayload(request.body);
  const previousLogoPublicId = settings.logoPublicId;
  const uploadedLogoPublicId = request.file ? request.file.filename : null;

  Object.assign(settings, updates);

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
