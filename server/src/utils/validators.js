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
      throw createHttpError(
        400,
        "Service price must be a valid non-negative number",
      );
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

  if (
    !username ||
    !password ||
    username.length > 120 ||
    password.length > 1024
  ) {
    throw createHttpError(400, "Invalid login request");
  }

  return {
    username,
    password,
  };
}

function validateGalleryPayload(payload) {
  const caption =
    payload.caption === undefined ? "" : normalizeString(payload.caption);

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
      throw createHttpError(
        400,
        "Business name must be 120 characters or fewer",
      );
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

  if (payload.businessEmail !== undefined) {
    const businessEmail = normalizeString(payload.businessEmail).toLowerCase();

    if (
      businessEmail &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail) ||
        businessEmail.length > 254)
    ) {
      throw createHttpError(
        400,
        "Business email must be a valid email address",
      );
    }

    updates.businessEmail = businessEmail;
  }

  if (payload.homepageOffer !== undefined) {
    const homepageOffer = normalizeString(payload.homepageOffer);

    if (homepageOffer.length > 200) {
      throw createHttpError(
        400,
        "Homepage offer must be 200 characters or fewer",
      );
    }

    updates.homepageOffer = homepageOffer;
  }

  if (payload.homepageOfferLink !== undefined) {
    const homepageOfferLink = normalizeString(payload.homepageOfferLink);

    if (!homepageOfferLink) {
      updates.homepageOfferLink = "";
    } else {
      if (homepageOfferLink.length > 2048) {
        throw createHttpError(400, "Homepage offer link is too long");
      }

      let parsed;
      try {
        parsed = new URL(homepageOfferLink);
      } catch (err) {
        throw createHttpError(400, "Homepage offer link must be a valid URL");
      }

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw createHttpError(
          400,
          "Homepage offer link must use http or https protocol",
        );
      }

      updates.homepageOfferLink = homepageOfferLink;
    }
  }

  const addressLimits = {
    streetAddress: 160,
    suiteNumber: 80,
    city: 80,
    state: 60,
    zipCode: 10,
  };

  for (const [field, limit] of Object.entries(addressLimits)) {
    if (payload[field] === undefined) continue;

    const value = normalizeString(payload[field]);

    if (value.length > limit) {
      throw createHttpError(400, `${field} is too long`);
    }

    if (field === "zipCode" && value && !/^\d{5}(?:-\d{4})?$/.test(value)) {
      throw createHttpError(400, "ZIP code must be a valid US ZIP code");
    }

    updates[field] = value;
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
