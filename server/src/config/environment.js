const {
  getSquareConfig,
  getTokenEncryptionKey,
} = require("./square");

const MINIMUM_JWT_SECRET_LENGTH = 32;

function requireProductionValue(name, value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required production environment variable: ${name}`);
  }

  return value.trim();
}

function isObviousDevelopmentSecret(value) {
  const normalized = value.trim().toLowerCase();
  return [
    "secret",
    "jwt_secret",
    "changeme",
    "change-me",
    "development",
    "development-secret",
    "test",
    "test-secret",
    "password",
  ].includes(normalized);
}

function validateJwtSecret() {
  const secret = requireProductionValue("JWT_SECRET", process.env.JWT_SECRET);

  if (secret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `Invalid production environment variable: JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters`,
    );
  }

  if (isObviousDevelopmentSecret(secret)) {
    throw new Error(
      "Invalid production environment variable: JWT_SECRET must not use a development placeholder",
    );
  }
}

function validateMongoUri() {
  const mongoUri = requireProductionValue("MONGODB_URI", process.env.MONGODB_URI);

  try {
    const url = new URL(mongoUri);
    if (!url.protocol.startsWith("mongodb")) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(
      "Invalid production environment variable: MONGODB_URI must be a MongoDB connection URI",
    );
  }
}

function validateCloudinaryConfiguration() {
  requireProductionValue("CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME);
  requireProductionValue("CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY);
  requireProductionValue("CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET);
}

function validateGooglePlacesConfiguration() {
  requireProductionValue("GOOGLE_PLACES_API_KEY", process.env.GOOGLE_PLACES_API_KEY);
  requireProductionValue("GOOGLE_PLACE_ID", process.env.GOOGLE_PLACE_ID);
}

function validateEnvironment() {
  // Preserve the existing Square environment and refresh-window validation for
  // development as well as production.
  getSquareConfig();

  if (process.env.NODE_ENV !== "production") return;

  validateMongoUri();
  validateJwtSecret();
  // This verifies both the dedicated key's presence and its AES-256 key size.
  getTokenEncryptionKey();
  validateCloudinaryConfiguration();
  validateGooglePlacesConfiguration();
}

module.exports = {
  MINIMUM_JWT_SECRET_LENGTH,
  validateEnvironment,
};
