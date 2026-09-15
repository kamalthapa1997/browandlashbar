const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MINIMUM_JWT_SECRET_LENGTH,
  validateEnvironment,
} = require("../config/environment");

const ENVIRONMENT_KEYS = [
  "NODE_ENV",
  "MONGODB_URI",
  "JWT_SECRET",
  "SQUARE_ENVIRONMENT",
  "SQUARE_APPLICATION_ID",
  "SQUARE_APPLICATION_SECRET",
  "SQUARE_LOCATION_ID",
  "SQUARE_REDIRECT_URI",
  "CLIENT_URL",
  "SQUARE_TOKEN_ENCRYPTION_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_PLACE_ID",
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(
    ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of ENVIRONMENT_KEYS) {
      if (!Object.hasOwn(values, key)) continue;
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
    return callback();
  } finally {
    for (const key of ENVIRONMENT_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function validProductionEnvironment(overrides = {}) {
  return {
    NODE_ENV: "production",
    MONGODB_URI: "mongodb://mongo.example.invalid:27017/mero",
    JWT_SECRET: "production-jwt-secret-with-at-least-thirty-two-characters",
    SQUARE_ENVIRONMENT: "production",
    SQUARE_APPLICATION_ID: "sq0idp-production-application-id",
    SQUARE_APPLICATION_SECRET: "production-square-application-secret",
    SQUARE_LOCATION_ID: "production-location-id",
    SQUARE_REDIRECT_URI: "https://api.example.invalid/api/square/oauth/callback",
    CLIENT_URL: "https://app.example.invalid",
    SQUARE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    CLOUDINARY_CLOUD_NAME: "production-cloud",
    CLOUDINARY_API_KEY: "production-cloudinary-api-key",
    CLOUDINARY_API_SECRET: "production-cloudinary-api-secret",
    GOOGLE_PLACES_API_KEY: "production-google-places-api-key",
    GOOGLE_PLACE_ID: "production-google-place-id",
    ...overrides,
  };
}

function assertProductionError(overrides, expectedMessage) {
  withEnvironment(validProductionEnvironment(overrides), () => {
    assert.throws(validateEnvironment, expectedMessage);
  });
}

test("development accepts Sandbox without production-only configuration", () => {
  withEnvironment({
    NODE_ENV: "development",
    SQUARE_ENVIRONMENT: "sandbox",
    MONGODB_URI: undefined,
    JWT_SECRET: undefined,
    SQUARE_APPLICATION_ID: undefined,
    SQUARE_APPLICATION_SECRET: undefined,
    SQUARE_LOCATION_ID: undefined,
    SQUARE_REDIRECT_URI: undefined,
    CLIENT_URL: undefined,
    SQUARE_TOKEN_ENCRYPTION_KEY: undefined,
    CLOUDINARY_CLOUD_NAME: undefined,
    CLOUDINARY_API_KEY: undefined,
    CLOUDINARY_API_SECRET: undefined,
    GOOGLE_PLACES_API_KEY: undefined,
    GOOGLE_PLACE_ID: undefined,
  }, () => {
    assert.doesNotThrow(validateEnvironment);
  });
});

test("production rejects a missing or Sandbox Square environment", () => {
  assertProductionError(
    { SQUARE_ENVIRONMENT: undefined },
    /SQUARE_ENVIRONMENT=production/,
  );
  assertProductionError(
    { SQUARE_ENVIRONMENT: "sandbox" },
    /SQUARE_ENVIRONMENT=production/,
  );
});

test("production requires a strong non-placeholder JWT secret without exposing it", () => {
  assertProductionError({ JWT_SECRET: undefined }, /JWT_SECRET/);
  assertProductionError({ JWT_SECRET: "changeme" }, /JWT_SECRET/);
  assertProductionError(
    { JWT_SECRET: "a".repeat(MINIMUM_JWT_SECRET_LENGTH - 1) },
    /JWT_SECRET/,
  );

  const secret = "private-production-jwt-secret-never-log-this-value";
  withEnvironment(validProductionEnvironment({ JWT_SECRET: secret }), () => {
    assert.doesNotThrow(validateEnvironment);
  });
  withEnvironment(validProductionEnvironment({ JWT_SECRET: "changeme" }), () => {
    assert.throws(validateEnvironment, (error) => {
      assert.equal(error.message.includes("changeme"), false);
      return true;
    });
  });
});

test("production requires each Square credential and secure OAuth URLs", () => {
  for (const name of [
    "SQUARE_APPLICATION_ID",
    "SQUARE_APPLICATION_SECRET",
    "SQUARE_LOCATION_ID",
    "SQUARE_REDIRECT_URI",
    "CLIENT_URL",
  ]) {
    assertProductionError({ [name]: undefined }, new RegExp(name));
  }

  assertProductionError(
    { SQUARE_APPLICATION_ID: "sandbox-sq0idb-example" },
    /SQUARE_APPLICATION_ID/,
  );
  assertProductionError(
    { SQUARE_REDIRECT_URI: "http://localhost:5001/api/square/oauth/callback" },
    /SQUARE_REDIRECT_URI/,
  );
  assertProductionError({ CLIENT_URL: "https://localhost" }, /CLIENT_URL/);
});

test("production requires a dedicated valid AES-256 Square token encryption key", () => {
  assertProductionError({ SQUARE_TOKEN_ENCRYPTION_KEY: undefined }, /SQUARE_TOKEN_ENCRYPTION_KEY/);
  assertProductionError({ SQUARE_TOKEN_ENCRYPTION_KEY: "not-base64" }, /SQUARE_TOKEN_ENCRYPTION_KEY/);
  assertProductionError(
    { SQUARE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(31, 7).toString("base64") },
    /SQUARE_TOKEN_ENCRYPTION_KEY/,
  );
});

test("production requires configured Cloudinary uploads and Google reviews", () => {
  for (const name of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "GOOGLE_PLACES_API_KEY",
    "GOOGLE_PLACE_ID",
  ]) {
    assertProductionError({ [name]: undefined }, new RegExp(name));
  }
});

test("a fully configured production environment passes without external calls", () => {
  withEnvironment(validProductionEnvironment(), () => {
    assert.doesNotThrow(validateEnvironment);
  });
});
