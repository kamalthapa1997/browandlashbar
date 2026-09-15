const assert = require("node:assert/strict");
const test = require("node:test");

const {
  getSquareConfig,
  getSquareTokenRefreshWindowMs,
} = require("../config/square");
const { assertSandboxDevelopmentSeeding } = require("../services/squareService");

const CONFIG_KEYS = [
  "NODE_ENV",
  "SQUARE_ENVIRONMENT",
  "SQUARE_APPLICATION_ID",
  "SQUARE_APPLICATION_SECRET",
  "SQUARE_LOCATION_ID",
  "SQUARE_REDIRECT_URI",
  "SQUARE_OAUTH_REDIRECT_URI",
  "CLIENT_URL",
  "SQUARE_ENABLE_SANDBOX_TOKEN_SEED",
  "SQUARE_TOKEN_ENCRYPTION_KEY",
  "SQUARE_TOKEN_REFRESH_WINDOW_MS",
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(CONFIG_KEYS.map((key) => [key, process.env[key]]));
  try {
    for (const key of CONFIG_KEYS) {
      if (Object.hasOwn(values, key)) {
        if (values[key] === undefined) delete process.env[key];
        else process.env[key] = values[key];
      }
    }
    return callback();
  } finally {
    for (const key of CONFIG_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function validProductionEnvironment(overrides = {}) {
  return {
    NODE_ENV: "production",
    SQUARE_ENVIRONMENT: "production",
    SQUARE_APPLICATION_ID: "application-id",
    SQUARE_APPLICATION_SECRET: "application-secret",
    SQUARE_LOCATION_ID: "location-id",
    SQUARE_REDIRECT_URI: "https://api.example.test/api/square/oauth/callback",
    CLIENT_URL: "https://app.example.test",
    ...overrides,
  };
}

test("development Sandbox configuration remains valid", () => {
  withEnvironment({
    NODE_ENV: "development",
    SQUARE_ENVIRONMENT: "sandbox",
    SQUARE_APPLICATION_ID: "sandbox-application-id",
    SQUARE_APPLICATION_SECRET: "sandbox-application-secret",
    SQUARE_REDIRECT_URI: "http://localhost:5001/api/square/oauth/callback",
    CLIENT_URL: "http://localhost:3000",
  }, () => {
    assert.equal(getSquareConfig().environment, "sandbox");
  });
});

test("token refresh window defaults safely and rejects invalid explicit values", () => {
  withEnvironment({ SQUARE_TOKEN_REFRESH_WINDOW_MS: undefined }, () => {
    assert.equal(getSquareTokenRefreshWindowMs(), 15 * 60 * 1000);
  });
  withEnvironment({ SQUARE_TOKEN_REFRESH_WINDOW_MS: "60000" }, () => {
    assert.equal(getSquareTokenRefreshWindowMs(), 60000);
  });
  for (const value of ["0", "-1", "not-a-duration"]) {
    withEnvironment({ SQUARE_TOKEN_REFRESH_WINDOW_MS: value }, () => {
      assert.throws(() => getSquareConfig(), /SQUARE_TOKEN_REFRESH_WINDOW_MS/);
    });
  }
});

test("production configuration accepts explicit production values", () => {
  withEnvironment(validProductionEnvironment(), () => {
    const config = getSquareConfig();
    assert.equal(config.environment, "production");
    assert.equal(config.apiBaseUrl, "https://connect.squareup.com/v2");
  });
});

test("production rejects a missing or Sandbox Square environment", () => {
  withEnvironment(validProductionEnvironment({ SQUARE_ENVIRONMENT: undefined }), () => {
    assert.throws(() => getSquareConfig(), /Production requires SQUARE_ENVIRONMENT=production/);
  });
  withEnvironment(validProductionEnvironment({ SQUARE_ENVIRONMENT: "sandbox" }), () => {
    assert.throws(() => getSquareConfig(), /Production requires SQUARE_ENVIRONMENT=production/);
  });
});

test("unknown Square environments are rejected", () => {
  withEnvironment({ NODE_ENV: "development", SQUARE_ENVIRONMENT: "staging" }, () => {
    assert.throws(() => getSquareConfig(), /SQUARE_ENVIRONMENT must be sandbox or production/);
  });
});

test("production requires Square application credentials", () => {
  withEnvironment(validProductionEnvironment({ SQUARE_APPLICATION_ID: undefined }), () => {
    assert.throws(() => getSquareConfig(), /Production requires SQUARE_APPLICATION_ID/);
  });
  withEnvironment(validProductionEnvironment({ SQUARE_APPLICATION_SECRET: undefined }), () => {
    assert.throws(() => getSquareConfig(), /Production requires SQUARE_APPLICATION_SECRET/);
  });
  withEnvironment(validProductionEnvironment({
    SQUARE_APPLICATION_ID: "sandbox-sq0idb-test-application-id",
  }), () => {
    assert.throws(() => getSquareConfig(), /Production requires a production SQUARE_APPLICATION_ID/);
  });
});

test("production requires a Square location ID", () => {
  withEnvironment(validProductionEnvironment({ SQUARE_LOCATION_ID: undefined }), () => {
    assert.throws(() => getSquareConfig(), /SQUARE_LOCATION_ID/);
  });
});

test("production validates the Square callback redirect URI", () => {
  for (const redirectUri of [
    "http://api.example.test/api/square/oauth/callback",
    "https://localhost/api/square/oauth/callback",
    "not-a-url",
  ]) {
    withEnvironment(validProductionEnvironment({ SQUARE_REDIRECT_URI: redirectUri }), () => {
      assert.throws(() => getSquareConfig(), /SQUARE_REDIRECT_URI/);
    });
  }
  withEnvironment(validProductionEnvironment({ SQUARE_REDIRECT_URI: "https://api.example.test/not-callback" }), () => {
    assert.throws(() => getSquareConfig(), /api\/square\/oauth\/callback/);
  });
  withEnvironment(validProductionEnvironment(), () => {
    assert.doesNotThrow(() => getSquareConfig());
  });
});

test("production requires a secure non-local client URL", () => {
  for (const clientUrl of [undefined, "http://app.example.test", "https://localhost", "not-a-url"]) {
    withEnvironment(validProductionEnvironment({ CLIENT_URL: clientUrl }), () => {
      assert.throws(() => getSquareConfig(), /CLIENT_URL/);
    });
  }
  withEnvironment(validProductionEnvironment({ CLIENT_URL: "https://app.example.test" }), () => {
    assert.doesNotThrow(() => getSquareConfig());
  });
});

test("Sandbox token seeding is impossible in production and valid only for enabled development Sandbox", () => {
  const encryptionKey = Buffer.alloc(32, 7).toString("base64");
  withEnvironment(validProductionEnvironment({
    SQUARE_ENABLE_SANDBOX_TOKEN_SEED: "true",
    SQUARE_TOKEN_ENCRYPTION_KEY: encryptionKey,
  }), () => {
    assert.throws(() => assertSandboxDevelopmentSeeding(), /Sandbox token seeding requires/);
  });
  withEnvironment({
    NODE_ENV: "development",
    SQUARE_ENVIRONMENT: "sandbox",
    SQUARE_ENABLE_SANDBOX_TOKEN_SEED: "true",
    SQUARE_TOKEN_ENCRYPTION_KEY: encryptionKey,
  }, () => {
    assert.doesNotThrow(() => assertSandboxDevelopmentSeeding());
  });
});
