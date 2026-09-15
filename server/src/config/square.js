const crypto = require("crypto");

const SQUARE_API_VERSION = process.env.SQUARE_API_VERSION || "2026-08-19";
const SQUARE_OAUTH_CALLBACK_PATH = "/api/square/oauth/callback";
const DEFAULT_SQUARE_TOKEN_REFRESH_WINDOW_MS = 15 * 60 * 1000;

function getSquareTokenRefreshWindowMs() {
  const configuredWindow = process.env.SQUARE_TOKEN_REFRESH_WINDOW_MS;
  if (configuredWindow === undefined || configuredWindow.trim() === "") {
    return DEFAULT_SQUARE_TOKEN_REFRESH_WINDOW_MS;
  }

  const refreshWindowMs = Number(configuredWindow);
  if (!Number.isFinite(refreshWindowMs) || refreshWindowMs <= 0) {
    throw new Error("SQUARE_TOKEN_REFRESH_WINDOW_MS must be a positive finite duration in milliseconds");
  }
  return refreshWindowMs;
}

function getEnvironment() {
  const configuredEnvironment = process.env.SQUARE_ENVIRONMENT;

  if (process.env.NODE_ENV === "production" && !configuredEnvironment) {
    throw new Error("Production requires SQUARE_ENVIRONMENT=production");
  }

  const environment = configuredEnvironment || "sandbox";
  if (!["sandbox", "production"].includes(environment)) {
    throw new Error("SQUARE_ENVIRONMENT must be sandbox or production");
  }
  if (process.env.NODE_ENV === "production" && environment !== "production") {
    throw new Error("Production requires SQUARE_ENVIRONMENT=production");
  }

  return environment;
}

function requireProductionValue(name, value) {
  if (!value || !value.trim()) throw new Error(`Production requires ${name}`);
  return value.trim();
}

function isLocalhost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(host)
  );
}

function requireProductionHttpsUrl(name, value, { callback = false } = {}) {
  const urlValue = requireProductionValue(name, value);
  let url;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error(`Production requires ${name} to be an absolute HTTPS URL`);
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    isLocalhost(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error(`Production requires ${name} to be a non-local HTTPS URL`);
  }
  if (callback && url.pathname !== SQUARE_OAUTH_CALLBACK_PATH) {
    throw new Error(
      `Production requires SQUARE_REDIRECT_URI to use ${SQUARE_OAUTH_CALLBACK_PATH}`,
    );
  }

  return url.toString();
}

function validateProductionConfiguration(config) {
  if (process.env.NODE_ENV !== "production") return;

  const applicationId = requireProductionValue(
    "SQUARE_APPLICATION_ID",
    config.applicationId,
  );
  if (applicationId.startsWith("sandbox-")) {
    throw new Error("Production requires a production SQUARE_APPLICATION_ID");
  }
  requireProductionValue("SQUARE_APPLICATION_SECRET", config.applicationSecret);
  requireProductionValue("SQUARE_LOCATION_ID", config.locationId);
  requireProductionHttpsUrl("SQUARE_REDIRECT_URI", config.redirectUri, {
    callback: true,
  });
  requireProductionHttpsUrl("CLIENT_URL", process.env.CLIENT_URL || "");
}

function getSquareConfig() {
  const environment = getEnvironment();
  const config = {
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
  validateProductionConfiguration(config);
  getSquareTokenRefreshWindowMs();
  return config;
}

function isSquareConfigured() {
  const config = getSquareConfig();
  return Boolean(
    config.applicationId && config.applicationSecret && config.redirectUri,
  );
}

function getTokenEncryptionKey() {
  const configuredKey = process.env.SQUARE_TOKEN_ENCRYPTION_KEY?.trim();

  if (configuredKey) {
    if (
      !/^[A-Za-z0-9+/]{43}=$/.test(configuredKey) ||
      Buffer.from(configuredKey, "base64").toString("base64") !== configuredKey
    ) {
      throw new Error(
        "SQUARE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 value",
      );
    }
    const key = Buffer.from(configuredKey, "base64");
    if (key.length !== 32) {
      throw new Error(
        "SQUARE_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 value",
      );
    }
    return key;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing required production environment variable: SQUARE_TOKEN_ENCRYPTION_KEY",
    );
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
  getSquareTokenRefreshWindowMs,
  getTokenEncryptionKey,
  isSquareConfigured,
  validateProductionConfiguration,
};
