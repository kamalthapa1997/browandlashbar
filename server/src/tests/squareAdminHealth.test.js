const assert = require("node:assert/strict");
const test = require("node:test");

const squareRoutes = require("../routes/squareRoutes");
const { requireAdmin, requireAuth } = require("../middleware/authMiddleware");
const {
  CONNECTION_STATUS,
  getSquareAdminHealth,
  getSquareStatus,
} = require("../services/squareService");
const { createSquareTokenLifecycle } = require("../services/squareTokenLifecycleService");
const {
  __testables: { getAdminHealthData },
} = require("../controllers/squareController");

const now = Date.parse("2026-09-12T12:00:00.000Z");
const configuration = { environment: "sandbox" };

function getHealth(overrides = {}) {
  return getSquareAdminHealth({
    getSquareConfigFn: () => configuration,
    getRefreshWindowMsFn: () => 15 * 60 * 1000,
    isSquareConfiguredFn: () => true,
    now: () => now,
    ...overrides,
  });
}

function findRoute(path) {
  return squareRoutes.stack.find((layer) => layer.route?.path === path)?.route;
}

test("admin health route uses the existing authentication and administrator middleware", async () => {
  const route = findRoute("/admin/health");
  assert.ok(route);
  assert.equal(route.stack[0].handle, requireAuth);
  assert.equal(route.stack[1].handle, requireAdmin);

  const unauthorized = await new Promise((resolve) => {
    requireAuth({ headers: {} }, {}, resolve);
  });
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.message, "Authentication is required");

  let forbidden;
  requireAdmin({}, {}, (error) => { forbidden = error; });
  assert.equal(forbidden.statusCode, 403);
});

test("admin health returns safe connected operational information without credentials", async () => {
  const health = await getHealth({
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      expiresAt: new Date(now + 60 * 60 * 1000),
      lastHealthCheckAt: new Date("2026-09-12T11:55:00.000Z"),
      accessToken: "secret-access-token",
      refreshToken: "secret-refresh-token",
      applicationSecret: "secret-client-secret",
    }),
  });
  assert.deepEqual(health, {
    configured: true,
    connected: true,
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    operationalStatus: "HEALTHY",
    environment: "sandbox",
    lastHealthCheckAt: new Date("2026-09-12T11:55:00.000Z"),
  });
  const serialized = JSON.stringify(health);
  for (const sensitiveValue of ["secret-access-token", "secret-refresh-token", "secret-client-secret"]) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }
  assert.equal(Object.hasOwn(health, "expiresAt"), false);
});

test("admin health prioritizes REAUTH_REQUIRED and returns only safe failure metadata", async () => {
  const health = await getHealth({
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
      expiresAt: new Date(now + 60 * 60 * 1000),
      lastHealthCheckAt: new Date("2026-09-12T11:00:00.000Z"),
      lastAuthFailureAt: new Date("2026-09-12T11:30:00.000Z"),
      lastAuthFailureReasonCode: "ACCESS_TOKEN_REVOKED",
      accessToken: "ciphertext-access-token",
      refreshToken: "ciphertext-refresh-token",
    }),
  });
  assert.equal(health.connected, false);
  assert.equal(health.connectionStatus, CONNECTION_STATUS.REAUTH_REQUIRED);
  assert.equal(health.operationalStatus, "REAUTH_REQUIRED");
  assert.equal(health.lastAuthFailureReasonCode, "ACCESS_TOKEN_REVOKED");
  assert.equal(JSON.stringify(health).includes("ciphertext"), false);
});

test("admin health distinguishes unconfigured, absent, and refresh-due connections without exact token expiry", async () => {
  const notConfigured = await getHealth({ isSquareConfiguredFn: () => false });
  assert.deepEqual(notConfigured, {
    configured: false,
    connected: false,
    connectionStatus: "NOT_CONFIGURED",
    operationalStatus: "NOT_CONFIGURED",
    environment: "sandbox",
  });

  const noConnection = await getHealth({ findConnectionFn: async () => null });
  assert.equal(noConnection.connectionStatus, "NOT_CONNECTED");
  assert.equal(noConnection.operationalStatus, "NOT_CONNECTED");

  const refreshDue = await getHealth({
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      expiresAt: new Date(now + 15 * 60 * 1000),
    }),
  });
  assert.equal(refreshDue.connected, true);
  assert.equal(refreshDue.operationalStatus, "TOKEN_REFRESH_DUE");
  assert.equal(Object.hasOwn(refreshDue, "expiresAt"), false);
});

test("controller returns the safe health payload and public status remains minimal and compatible", async () => {
  const response = { json(body) { this.body = body; } };
  await getAdminHealthData({}, response, {
    getSquareAdminHealthFn: async () => ({
      configured: true,
      connected: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      operationalStatus: "HEALTHY",
      environment: "sandbox",
    }),
  });
  assert.deepEqual(response.body, {
    configured: true,
    connected: true,
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    operationalStatus: "HEALTHY",
    environment: "sandbox",
  });

  const publicStatus = await getSquareStatus({
    getSquareConfigFn: () => configuration,
    isSquareConfiguredFn: () => true,
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      lastAuthFailureReasonCode: "must-not-be-public",
      expiresAt: new Date(now),
    }),
  });
  assert.deepEqual(publicStatus, {
    configured: true,
    connected: true,
    environment: "sandbox",
    connectionStatus: CONNECTION_STATUS.CONNECTED,
  });
});

test("REAUTH_REQUIRED scheduler checks skip quietly instead of repeatedly logging alerts", async () => {
  const warnings = [];
  const lifecycle = createSquareTokenLifecycle({
    isSquareConfiguredFn: () => true,
    getSquareConfigFn: () => configuration,
    getRefreshWindowMsFn: () => 15 * 60 * 1000,
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
      expiresAt: new Date(now),
    }),
    logger: { warn: (...args) => warnings.push(args) },
  });
  assert.deepEqual(await lifecycle.runCycle(), { refreshed: false, reason: "REAUTH_REQUIRED" });
  assert.deepEqual(await lifecycle.runCycle(), { refreshed: false, reason: "REAUTH_REQUIRED" });
  assert.deepEqual(warnings, []);
});
