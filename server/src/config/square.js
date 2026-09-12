const crypto = require("crypto");

const SQUARE_API_VERSION = process.env.SQUARE_API_VERSION || "2026-08-19";

function getSquareConfig() {
  const environment = process.env.SQUARE_ENVIRONMENT || "sandbox";

  if (!["sandbox", "production"].includes(environment)) {
    throw new Error("SQUARE_ENVIRONMENT must be sandbox or production");
  }

  return {
    environment,
    applicationId: process.env.SQUARE_APPLICATION_ID || "",
    applicationSecret: process.env.SQUARE_APPLICATION_SECRET || "",
    redirectUri: process.env.SQUARE_REDIRECT_URI || "",
    locationId: process.env.SQUARE_LOCATION_ID || "",
    apiVersion: SQUARE_API_VERSION,
    apiBaseUrl:
      environment === "production"
        ? "https://connect.squareup.com/v2"
        : "https://connect.squareupsandbox.com/v2",
    oauthBaseUrl:
      environment === "production"
        ? "https://connect.squareup.com/oauth2"
        : "https://connect.squareupsandbox.com/oauth2",
  };
}

function isSquareConfigured() {
  const config = getSquareConfig();
  return Boolean(
    config.applicationId && config.applicationSecret && config.redirectUri,
  );
}

function getTokenEncryptionKey() {
  const configuredKey = process.env.SQUARE_TOKEN_ENCRYPTION_KEY;

  if (configuredKey) {
    const key = Buffer.from(configuredKey, "base64");
    if (key.length !== 32) {
      throw new Error("SQUARE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 value");
    }
    return key;
  }

  // The application secret is already server-only. A separate key is preferred
  // so token encryption can be rotated without replacing Square credentials.
  return crypto
    .createHash("sha256")
    .update(process.env.SQUARE_APPLICATION_SECRET || "")
    .digest();
}

module.exports = {
  getSquareConfig,
  getTokenEncryptionKey,
  isSquareConfigured,
};
