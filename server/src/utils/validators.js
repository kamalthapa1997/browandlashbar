const mongoose = require("mongoose");

const serviceCategories = require("../constants/serviceCategories");
const createHttpError = require("./httpError");

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function validateObjectId(id, resourceName) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, `Invalid ${resourceName} id`);
  }
}

function validateServicePayload(payload, options = {}) {
  const { partial = false } = options;
  const nextPayload = {};

  if (!partial || payload.name !== undefined) {
    const name = normalizeString(payload.name);

    if (!name) {
      throw createHttpError(400, "Service name is required");
    }

    nextPayload.name = name;
  }

  if (!partial || payload.price !== undefined) {
    const parsedPrice = Number(payload.price);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      throw createHttpError(400, "Service price must be a valid non-negative number");
    }

    nextPayload.price = parsedPrice;
  }

  if (!partial || payload.category !== undefined) {
    const category = normalizeString(payload.category);

    if (!serviceCategories.includes(category)) {
      throw createHttpError(400, "Service category is invalid", {
        allowedCategories: serviceCategories,
      });
    }

    nextPayload.category = category;
  }

  return nextPayload;
}

function validateLoginPayload(payload) {
  const username = normalizeString(payload.username);
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!username || !password) {
    throw createHttpError(400, "Username and password are required");
  }

  return {
    username,
    password,
  };
}

function validateGalleryPayload(payload) {
  const caption = payload.caption === undefined ? "" : normalizeString(payload.caption);

  if (caption.length > 300) {
    throw createHttpError(400, "Caption must be 300 characters or fewer");
  }

  return { caption };
}

function validateSettingsPayload(payload) {
  const updates = {};

  if (payload.businessName !== undefined) {
    const businessName = normalizeString(payload.businessName);

    if (!businessName) {
      throw createHttpError(400, "Business name cannot be empty");
    }

    if (businessName.length > 120) {
      throw createHttpError(400, "Business name must be 120 characters or fewer");
    }

    updates.businessName = businessName;
  }

  if (payload.contactPhone !== undefined) {
    const contactPhone = normalizeString(payload.contactPhone);

    if (!contactPhone) {
      throw createHttpError(400, "Contact phone cannot be empty");
    }

    if (!/^[0-9+()\-.\s]{7,25}$/.test(contactPhone)) {
      throw createHttpError(400, "Contact phone format is invalid");
    }

    updates.contactPhone = contactPhone;
  }

  return updates;
}

module.exports = {
  validateGalleryPayload,
  validateLoginPayload,
  validateObjectId,
  validateServicePayload,
  validateSettingsPayload,
};
