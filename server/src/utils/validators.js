const mongoose = require("mongoose");

const createHttpError = require("./httpError");
const {
  MAX_BOOKING_DAYS,
  assertDateWithinBookingWindow,
  calendarDateInBusinessTimeZone,
} = require("./bookingWindow");

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

function validateAvailabilityPayload(payload, options = {}) {
  const variationIds = validateVariationIds(payload?.variationIds);
  const date = normalizeString(payload?.date);
  const startDate = normalizeString(payload?.startDate);
  const endDate = normalizeString(payload?.endDate);

  if (date && !startDate && !endDate) {
    validateCalendarDate(date, "Date");
    assertDateWithinBookingWindow(date, options);
    return { variationIds, date };
  }

  if (startDate && endDate && !date) {
    const start = validateCalendarDate(startDate, "Start date");
    const end = validateCalendarDate(endDate, "End date");
    const daysInRange = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);

    if (daysInRange < 0 || daysInRange > MAX_BOOKING_DAYS) {
      throw createHttpError(400, "Availability range must be within 31 calendar days");
    }

    assertDateWithinBookingWindow(startDate, options);
    assertDateWithinBookingWindow(endDate, options);

    return { variationIds, startDate, endDate };
  }

  throw createHttpError(
    400,
    "Provide either a date or a startDate and endDate using YYYY-MM-DD format",
  );
}

function validateCalendarDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, `${label} must use YYYY-MM-DD format`);
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw createHttpError(400, `${label} is invalid`);
  }

  return parsed;
}

function validateVariationIds(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw createHttpError(400, "At least one Square service variation is required");
  }

  const variationIds = value.map((variationId) => {
    const normalized = normalizeString(variationId);
    if (!normalized || normalized.length > 255) {
      throw createHttpError(400, "A valid Square service variation is required");
    }
    return normalized;
  });

  if (new Set(variationIds).size !== variationIds.length) {
    throw createHttpError(400, "Square service variations must be unique");
  }

  return variationIds.sort();
}

function validateBookingPayload(payload, options = {}) {
  const bookingAttemptId = normalizeString(payload?.bookingAttemptId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingAttemptId)) {
    throw createHttpError(400, "Booking attempt id must be a valid UUID");
  }
  const variationIds = validateVariationIds(payload?.variationIds);
  const startAt = normalizeString(payload?.startAt);
  const parsedStart = new Date(startAt);
  if (!startAt || Number.isNaN(parsedStart.getTime()) || !/[zZ]|[+-]\d{2}:?\d{2}$/.test(startAt)) {
    throw createHttpError(400, "Appointment time must be a valid ISO date with a timezone");
  }
  const now = new Date(options.now || Date.now());
  if (parsedStart.getTime() < now.getTime() - 60 * 1000) {
    throw createHttpError(400, "Appointment time must be in the future");
  }
  assertDateWithinBookingWindow(
    calendarDateInBusinessTimeZone(parsedStart),
    { now },
  );

  const customer = payload?.customer || {};
  const firstName = normalizeString(customer.firstName);
  const lastName = normalizeString(customer.lastName);
  const phone = normalizeString(customer.phone);
  const email = normalizeString(customer.email).toLowerCase();
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) {
    throw createHttpError(400, "First and last name are required");
  }
  if (!phone || phone.length > 30 || !/^[0-9+().\-\s]+$/.test(phone)) {
    throw createHttpError(400, "A valid phone number is required");
  }
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
    throw createHttpError(400, "Email address is invalid");
  }
  return {
    bookingAttemptId,
    variationIds,
    startAt: parsedStart.toISOString(),
    customer: { firstName, lastName, phone, email },
  };
}

function parseBoolean(value, field) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw createHttpError(400, `${field} must be true or false`);
}

function validateGalleryPayload(payload, options = {}) {
  const { partial = false } = options;
  const updates = {};

  const textFields = {
    caption: { limit: 300, label: "Caption" },
    service: { limit: 160, label: "Service" },
    altText: { limit: 300, label: "Alt text" },
  };

  for (const [field, { limit, label }] of Object.entries(textFields)) {
    if (partial && payload[field] === undefined) continue;
    const value = payload[field] === undefined ? "" : normalizeString(payload[field]);
    if (value.length > limit) {
      throw createHttpError(400, `${label} must be ${limit} characters or fewer`);
    }
    updates[field] = value;
  }

  if (!partial || payload.category !== undefined) {
    const category = normalizeString(payload.category);
    if (!category || category.length > 80) {
      throw createHttpError(400, "Gallery category is invalid");
    }
    updates.category = category;
  }

  for (const field of ["featured", "active"]) {
    if (partial && payload[field] === undefined) continue;
    updates[field] =
      payload[field] === undefined ? field === "active" : parseBoolean(payload[field], field);
  }

  if (!partial || payload.displayOrder !== undefined) {
    const displayOrder =
      payload.displayOrder === undefined ? 0 : Number(payload.displayOrder);
    if (!Number.isFinite(displayOrder)) {
      throw createHttpError(400, "Display order must be a valid number");
    }
    updates.displayOrder = displayOrder;
  }

  return updates;
}

function validateFaqPayload(payload, options = {}) {
  const { partial = false } = options;
  const nextPayload = {};
  const faqCategories = require("../constants/faqCategories");

  if (!partial || payload.question !== undefined) {
    const question = normalizeString(payload.question);
    if (!question) throw createHttpError(400, "FAQ question is required");
    if (question.length > 240) throw createHttpError(400, "FAQ question must be 240 characters or fewer");
    nextPayload.question = question;
  }

  if (!partial || payload.answer !== undefined) {
    const answer = normalizeString(payload.answer);
    if (!answer) throw createHttpError(400, "FAQ answer is required");
    if (answer.length > 3000) throw createHttpError(400, "FAQ answer must be 3000 characters or fewer");
    nextPayload.answer = answer;
  }

  if (!partial || payload.category !== undefined) {
    const category = normalizeString(payload.category);
    if (!faqCategories.includes(category)) throw createHttpError(400, "FAQ category is invalid");
    nextPayload.category = category;
  }

  if (!partial || payload.displayOrder !== undefined) {
    const displayOrder = Number(payload.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      throw createHttpError(400, "Display order must be a non-negative whole number");
    }
    nextPayload.displayOrder = displayOrder;
  }

  if (!partial || payload.isActive !== undefined) {
    if (typeof payload.isActive !== "boolean") throw createHttpError(400, "FAQ status is invalid");
    nextPayload.isActive = payload.isActive;
  }

  return nextPayload;
}

function validateSettingsPayload(payload) {
  const updates = {};
  const galleryUpdates = {};

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

  const galleryFields = {
    galleryEyebrow: {
      key: "eyebrow",
      limit: 80,
      fallback: "OUR PORTFOLIO",
      label: "Gallery eyebrow",
    },
    galleryTitle: {
      key: "title",
      limit: 160,
      fallback: "Beauty in every detail",
      label: "Gallery title",
    },
    galleryDescription: {
      key: "description",
      limit: 360,
      fallback: "Explore our latest lash and brow work.",
      label: "Gallery description",
    },
  };

  for (const [field, config] of Object.entries(galleryFields)) {
    if (payload[field] === undefined) continue;

    const value = normalizeString(payload[field]);
    if (value.length > config.limit) {
      throw createHttpError(400, `${config.label} must be ${config.limit} characters or fewer`);
    }

    galleryUpdates[config.key] = value || config.fallback;
  }

  if (Object.keys(galleryUpdates).length) {
    updates.gallery = galleryUpdates;
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
  validateFaqPayload,
  validateAvailabilityPayload,
  validateBookingPayload,
  validateVariationIds,
  validateLoginPayload,
  validateObjectId,
  validateSettingsPayload,
};
