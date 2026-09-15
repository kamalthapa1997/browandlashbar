const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CONNECTION_STATUS,
  refreshConnectionOnce,
  __testables: { getAccessToken },
} = require("../services/squareService");
const {
  createSquareTokenLifecycle,
  getProactiveRefreshDecision,
} = require("../services/squareTokenLifecycleService");

const now = Date.parse("2026-09-12T12:00:00.000Z");
const refreshWindowMs = 15 * 60 * 1000;
const squareConfig = { environment: "sandbox" };

function connection(overrides = {}) {
  return {
    _id: "connection-1",
    connectionKey: "primary",
    environment: "sandbox",
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    accessToken: "encrypted-access-token",
    refreshToken: "encrypted-refresh-token",
    expiresAt: new Date(now + 60 * 60 * 1000),
    ...overrides,
  };
}

function createLifecycle(overrides = {}) {
  return createSquareTokenLifecycle({
    isSquareConfiguredFn: () => true,
    getSquareConfigFn: () => squareConfig,
    getRefreshWindowMsFn: () => refreshWindowMs,
    findConnectionFn: async () => connection(),
    refreshConnectionOnceFn: async () => "refreshed-access-token",
    now: () => now,
    logger: { warn: () => {} },
    ...overrides,
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test("starts one unref'd lifecycle interval, supports a safe restart, and never blocks startup", async () => {
  const timers = [];
  const cleared = [];
  let checks = 0;
  const lifecycle = createLifecycle({
    findConnectionFn: async () => { checks += 1; return null; },
    setIntervalFn: (callback, delay) => {
      const timer = { callback, delay, unrefCalled: false, unref() { this.unrefCalled = true; } };
      timers.push(timer);
      return timer;
    },
    clearIntervalFn: (timer) => { cleared.push(timer); },
  });

  const firstTimer = lifecycle.start();
  assert.equal(lifecycle.start(), firstTimer);
  assert.equal(timers.length, 1);
  assert.equal(firstTimer.unrefCalled, true);
  assert.equal(lifecycle.isStarted(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(checks, 1, "startup triggers a non-blocking initial check");

  lifecycle.stop();
  assert.equal(lifecycle.isStarted(), false);
  assert.deepEqual(cleared, [firstTimer]);
  lifecycle.start();
  assert.equal(timers.length, 2, "a restarted process can establish one new lifecycle interval");
  lifecycle.stop();
});

test("skips lifecycle work when Square is not configured or no active connection exists", async () => {
  let connectionReads = 0;
  const notConfigured = createLifecycle({
    isSquareConfiguredFn: () => false,
    findConnectionFn: async () => { connectionReads += 1; return connection(); },
  });
  assert.deepEqual(await notConfigured.checkConnection(), { refreshed: false, reason: "NOT_CONFIGURED" });
  assert.equal(connectionReads, 0);

  const noConnection = createLifecycle({ findConnectionFn: async () => null });
  assert.deepEqual(await noConnection.checkConnection(), { refreshed: false, reason: "NO_CONNECTION" });
});

test("proactive decision skips REAUTH_REQUIRED, missing expirations, and tokens outside the window", () => {
  assert.deepEqual(
    getProactiveRefreshDecision(connection({ connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED }), {
      environment: "sandbox", now, refreshWindowMs,
    }),
    { refresh: false, reason: "REAUTH_REQUIRED" },
  );
  assert.deepEqual(
    getProactiveRefreshDecision(connection({ expiresAt: undefined }), {
      environment: "sandbox", now, refreshWindowMs,
    }),
    { refresh: false, reason: "EXPIRATION_UNKNOWN" },
  );
  assert.deepEqual(
    getProactiveRefreshDecision(connection({ expiresAt: new Date(now + refreshWindowMs + 1) }), {
      environment: "sandbox", now, refreshWindowMs,
    }),
    { refresh: false, reason: "OUTSIDE_REFRESH_WINDOW" },
  );
});

test("refreshes tokens inside the window or already expired through the existing refresh entry point", async () => {
  for (const expiresAt of [new Date(now + refreshWindowMs), new Date(now - 1)]) {
    let refreshCalls = 0;
    const lifecycle = createLifecycle({
      findConnectionFn: async () => connection({ expiresAt }),
      refreshConnectionOnceFn: async (storedConnection) => {
        refreshCalls += 1;
        assert.equal(storedConnection.expiresAt, expiresAt);
        return "refreshed-access-token";
      },
    });
    assert.deepEqual(await lifecycle.checkConnection(), { refreshed: true, reason: "REFRESHED" });
    assert.equal(refreshCalls, 1);
  }
});

test("a successful proactive refresh retains CONNECTED and persists rotated token expiration through the canonical refresh", async () => {
  const storedConnection = connection({ expiresAt: new Date(now + refreshWindowMs) });
  let persisted = false;
  const lifecycle = createLifecycle({
    findConnectionFn: async () => storedConnection,
    refreshConnectionOnceFn: async (currentConnection) => {
      currentConnection.accessToken = "encrypted:rotated-access-token";
      currentConnection.refreshToken = "encrypted:rotated-refresh-token";
      currentConnection.expiresAt = new Date(now + 60 * 60 * 1000);
      currentConnection.connectionStatus = CONNECTION_STATUS.CONNECTED;
      persisted = true;
      return "rotated-access-token";
    },
  });
  await lifecycle.checkConnection();
  assert.equal(persisted, true);
  assert.equal(storedConnection.connectionStatus, CONNECTION_STATUS.CONNECTED);
  assert.equal(storedConnection.expiresAt.toISOString(), "2026-09-12T13:00:00.000Z");
  assert.equal(storedConnection.accessToken, "encrypted:rotated-access-token");
  assert.equal(storedConnection.refreshToken, "encrypted:rotated-refresh-token");
});

test("permanent refresh failure remains REAUTH_REQUIRED while temporary failures leave the connection connected", async () => {
  const permanentConnection = connection({ expiresAt: new Date(now) });
  const permanentLifecycle = createLifecycle({
    findConnectionFn: async () => permanentConnection,
    refreshConnectionOnceFn: async () => {
      permanentConnection.connectionStatus = CONNECTION_STATUS.REAUTH_REQUIRED;
      const error = new Error("reauthorize");
      error.errorCode = "SQUARE_REAUTH_REQUIRED";
      throw error;
    },
  });
  assert.deepEqual(await permanentLifecycle.runCycle(), {
    refreshed: false,
    reason: "FAILED",
    errorCode: "SQUARE_REAUTH_REQUIRED",
  });
  assert.equal(permanentConnection.connectionStatus, CONNECTION_STATUS.REAUTH_REQUIRED);

  const temporaryConnection = connection({ expiresAt: new Date(now) });
  const temporaryLifecycle = createLifecycle({
    findConnectionFn: async () => temporaryConnection,
    refreshConnectionOnceFn: async () => {
      const error = new Error("network unavailable");
      error.errorCode = "SQUARE_TOKEN_REFRESH_FAILED";
      throw error;
    },
  });
  assert.deepEqual(await temporaryLifecycle.runCycle(), {
    refreshed: false,
    reason: "FAILED",
    errorCode: "SQUARE_TOKEN_REFRESH_FAILED",
  });
  assert.equal(temporaryConnection.connectionStatus, CONNECTION_STATUS.CONNECTED);
});

test("overlapping scheduled cycles share one promise and scheduler/request callers converge on refresh single-flight", async () => {
  const storedConnection = connection({ expiresAt: new Date(now) });
  const refreshGate = deferred();
  const inFlight = new Map();
  let refreshCalls = 0;
  const refreshConnectionFn = async () => {
    refreshCalls += 1;
    await refreshGate.promise;
    return "refreshed-access-token";
  };
  const sharedRefresh = (currentConnection) => refreshConnectionOnce(currentConnection, {
    refreshConnectionFn,
    inFlight,
  });
  const lifecycle = createLifecycle({
    findConnectionFn: async () => storedConnection,
    refreshConnectionOnceFn: sharedRefresh,
  });

  const scheduledFirst = lifecycle.runCycle();
  const scheduledSecond = lifecycle.runCycle();
  const requestTriggered = getAccessToken({
    getConnectionFn: async () => storedConnection,
    refreshConnectionFn,
    decryptFn: () => "old-access-token",
    now: () => now,
    inFlight,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scheduledFirst, scheduledSecond);
  assert.equal(refreshCalls, 1);

  refreshGate.resolve();
  assert.deepEqual(await Promise.all([scheduledFirst, scheduledSecond]), [
    { refreshed: true, reason: "REFRESHED" },
    { refreshed: true, reason: "REFRESHED" },
  ]);
  assert.equal(await requestTriggered, "refreshed-access-token");
  assert.equal(inFlight.size, 0);
});

test("a lifecycle failure is contained and emits only a safe operational code", async () => {
  const warnings = [];
  const lifecycle = createLifecycle({
    findConnectionFn: async () => { throw new Error("database unavailable"); },
    logger: { warn: (message, metadata) => warnings.push({ message, metadata }) },
  });
  assert.deepEqual(await lifecycle.runCycle(), {
    refreshed: false,
    reason: "FAILED",
    errorCode: undefined,
  });
  assert.deepEqual(warnings, [{
    message: "Square proactive token refresh failed.",
    metadata: { code: "SQUARE_TOKEN_LIFECYCLE_FAILED" },
  }]);
});
