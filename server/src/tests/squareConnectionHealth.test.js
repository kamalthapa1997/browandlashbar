const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CONNECTION_STATUS,
  exchangeCode,
  getSquareStatus,
  squareFetch,
  __testables: {
    classifySquareApiFailure,
    getConnection,
    markConnectionReauthRequired,
    refreshConnection,
    refreshConnectionOnce,
  },
} = require("../services/squareService");

const squareConfig = {
  environment: "sandbox",
  apiBaseUrl: "https://square.example.test/v2",
  oauthBaseUrl: "https://oauth.example.test",
  apiVersion: "test-version",
  applicationId: "test-application-id",
  applicationSecret: "test-application-secret",
  redirectUri: "http://localhost:5001/api/square/oauth/callback",
};

function squareResponse({ status, data = {} }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => data,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("classifies only credential failures for recovery and preserves known capability failures", () => {
  assert.equal(
    classifySquareApiFailure(401, { errors: [{ code: "ACCESS_TOKEN_EXPIRED" }] }),
    "AUTHENTICATION",
  );
  assert.equal(
    classifySquareApiFailure(401, { errors: [{ code: "ACCESS_TOKEN_REVOKED" }] }),
    "AUTHENTICATION",
  );
  assert.equal(
    classifySquareApiFailure(403, { errors: [{ code: "FORBIDDEN" }] }),
    "AUTHORIZATION",
  );
  assert.equal(
    classifySquareApiFailure(401, {
      errors: [{ code: "UNAUTHORIZED", detail: "Merchant not onboarded to Appointments" }],
    }),
    "AUTHORIZATION",
  );
  assert.equal(
    classifySquareApiFailure(400, { errors: [{ code: "BAD_REQUEST" }] }),
    "NORMAL",
  );
  assert.equal(
    classifySquareApiFailure(401, { errors: [{ code: "INTERNAL_SERVER_ERROR" }] }),
    "NORMAL",
  );
});

test("normal and subscription or permission failures never refresh or disconnect", async () => {
  for (const response of [
    squareResponse({ status: 400, data: { errors: [{ code: "BAD_REQUEST" }] } }),
    squareResponse({
      status: 403,
      data: {
        errors: [{
          code: "FORBIDDEN",
          detail: "Merchant subscription does not support write operations",
        }],
      },
    }),
  ]) {
    let refreshCalls = 0;
    let healthWrites = 0;
    await assert.rejects(
      squareFetch("/bookings", {
        getSquareConfigFn: () => squareConfig,
        getAccessTokenFn: async () => "current-access-token",
        getConnectionFn: async () => {
          throw new Error("A non-authentication error must not load a connection.");
        },
        refreshConnectionOnceFn: async () => { refreshCalls += 1; return "new-access-token"; },
        markConnectionReauthRequiredFn: async () => { healthWrites += 1; },
        fetchImpl: async () => response,
      }),
      (error) => error.squareFailureType === (response.status === 403 ? "AUTHORIZATION" : "NORMAL"),
    );
    assert.equal(refreshCalls, 0);
    assert.equal(healthWrites, 0);
  }
});

test("a credential failure uses the existing refresh path and retries the operation once", async () => {
  const authorizationHeaders = [];
  let refreshCalls = 0;
  const connection = { _id: "connection-1", connectionStatus: CONNECTION_STATUS.CONNECTED };
  const result = await squareFetch("/locations", {
    getSquareConfigFn: () => squareConfig,
    getAccessTokenFn: async () => "expired-access-token",
    getConnectionFn: async () => connection,
    refreshConnectionOnceFn: async () => { refreshCalls += 1; return "refreshed-access-token"; },
    markConnectionReauthRequiredFn: async () => {
      throw new Error("A successful retry must not require reauthorization.");
    },
    fetchImpl: async (_url, options) => {
      authorizationHeaders.push(options.headers.Authorization);
      return authorizationHeaders.length === 1
        ? squareResponse({ status: 401, data: { errors: [{ code: "ACCESS_TOKEN_EXPIRED" }] } })
        : squareResponse({ status: 200, data: { locations: [] } });
    },
  });

  assert.deepEqual(result, { locations: [] });
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authorizationHeaders, ["Bearer expired-access-token", "Bearer refreshed-access-token"]);
  assert.equal(connection.connectionStatus, CONNECTION_STATUS.CONNECTED);
});

test("a repeated credential failure after refresh persists REAUTH_REQUIRED", async () => {
  const connection = { _id: "connection-2", connectionStatus: CONNECTION_STATUS.CONNECTED };
  let healthWrite;
  await assert.rejects(
    squareFetch("/locations", {
      getSquareConfigFn: () => squareConfig,
      getAccessTokenFn: async () => "expired-access-token",
      getConnectionFn: async () => connection,
      refreshConnectionOnceFn: async () => "still-invalid-access-token",
      markConnectionReauthRequiredFn: async (_connection, update) => {
        healthWrite = update;
        connection.connectionStatus = CONNECTION_STATUS.REAUTH_REQUIRED;
      },
      fetchImpl: async () => squareResponse({
        status: 401,
        data: { errors: [{ code: "ACCESS_TOKEN_REVOKED" }] },
      }),
    }),
    (error) => error.errorCode === "SQUARE_REAUTH_REQUIRED",
  );
  assert.equal(connection.connectionStatus, CONNECTION_STATUS.REAUTH_REQUIRED);
  assert.deepEqual(healthWrite, { reasonCode: "ACCESS_TOKEN_REVOKED" });
});

test("a permanently rejected refresh marks the connection, while a successful refresh restores health", async () => {
  const rejectedConnection = {
    _id: "connection-3",
    refreshToken: "encrypted-refresh-token",
  };
  let permanentFailure;
  await assert.rejects(
    refreshConnection(rejectedConnection, {
      config: squareConfig,
      decryptFn: () => "refresh-token",
      fetchWithTimeoutFn: async () => ({
        response: { ok: false, status: 400 },
        data: { errors: [{ code: "UNAUTHORIZED" }] },
      }),
      markConnectionReauthRequiredFn: async (_connection, update) => { permanentFailure = update; },
      now: () => new Date("2026-09-12T12:00:00.000Z"),
    }),
    (error) => error.errorCode === "SQUARE_REAUTH_REQUIRED",
  );
  assert.deepEqual(permanentFailure, {
    reasonCode: "UNAUTHORIZED",
    now: new Date("2026-09-12T12:00:00.000Z"),
  });

  const refreshedConnection = {
    refreshToken: "encrypted-refresh-token",
    connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
    lastAuthFailureAt: new Date("2026-09-11T12:00:00.000Z"),
    lastAuthFailureReasonCode: "ACCESS_TOKEN_REVOKED",
    save: async function save() { this.saved = true; },
  };
  const accessToken = await refreshConnection(refreshedConnection, {
    config: squareConfig,
    decryptFn: () => "refresh-token",
    encryptFn: (value) => `encrypted:${value}`,
    fetchWithTimeoutFn: async () => ({
      response: { ok: true, status: 200 },
      data: {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_at: "2026-09-13T12:00:00.000Z",
      },
    }),
    persistRefreshedConnectionFn: async (connection, _originalCredentials, updates) => {
      Object.assign(connection, updates);
      await connection.save();
      return true;
    },
    now: () => new Date("2026-09-12T12:00:00.000Z"),
  });
  assert.equal(accessToken, "new-access-token");
  assert.equal(refreshedConnection.connectionStatus, CONNECTION_STATUS.CONNECTED);
  assert.equal(refreshedConnection.lastHealthCheckAt.toISOString(), "2026-09-12T12:00:00.000Z");
  assert.equal(refreshedConnection.lastAuthFailureAt, undefined);
  assert.equal(refreshedConnection.lastAuthFailureReasonCode, undefined);
  assert.equal(refreshedConnection.saved, true);
});

test("REAUTH_REQUIRED blocks old credentials, and a successful OAuth callback atomically restores CONNECTED", async () => {
  await assert.rejects(
    getConnection({
      requireSquareConfigurationFn: () => {},
      getSquareConfigFn: () => squareConfig,
      findConnectionFn: async () => ({
        environment: "sandbox",
        connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
      }),
    }),
    (error) => error.errorCode === "SQUARE_REAUTH_REQUIRED",
  );

  let persisted;
  await exchangeCode("one-time-code", {
    requireSquareConfigurationFn: () => {},
    getSquareConfigFn: () => squareConfig,
    encryptFn: (value) => `encrypted:${value}`,
    fetchWithTimeoutFn: async () => ({
      response: { ok: true, status: 200 },
      data: {
        access_token: "replacement-access-token",
        refresh_token: "replacement-refresh-token",
        merchant_id: "merchant-1",
      },
    }),
    findOneAndUpdateFn: async (_filter, update, options) => { persisted = { update, options }; },
    now: () => new Date("2026-09-12T12:00:00.000Z"),
  });
  assert.equal(persisted.update.$set.connectionStatus, CONNECTION_STATUS.CONNECTED);
  assert.equal(persisted.update.$set.accessToken, "encrypted:replacement-access-token");
  assert.equal(persisted.update.$set.refreshToken, "encrypted:replacement-refresh-token");
  assert.deepEqual(persisted.update.$unset, { lastAuthFailureAt: 1, lastAuthFailureReasonCode: 1 });
  assert.equal(persisted.options.upsert, true);
});

test("a reconnect wins over a stale refresh or stale health transition", async () => {
  const staleConnection = {
    _id: "connection-6",
    accessToken: "encrypted-old-access-token",
    refreshToken: "encrypted-old-refresh-token",
    connectionStatus: CONNECTION_STATUS.CONNECTED,
  };
  await assert.rejects(
    refreshConnection(staleConnection, {
      config: squareConfig,
      decryptFn: () => "old-refresh-token",
      encryptFn: (value) => `encrypted:${value}`,
      fetchWithTimeoutFn: async () => ({
        response: { ok: true, status: 200 },
        data: { access_token: "stale-refreshed-access-token" },
      }),
      // This represents the callback replacing the encrypted credentials first.
      persistRefreshedConnectionFn: async () => false,
    }),
    (error) => error.errorCode === "SQUARE_CONNECTION_CHANGED",
  );
  assert.equal(staleConnection.accessToken, "encrypted-old-access-token");

  const marked = await markConnectionReauthRequired(staleConnection, {
    reasonCode: "ACCESS_TOKEN_REVOKED",
    updateOneFn: async () => ({ matchedCount: 0 }),
  });
  assert.equal(marked, false);
  assert.equal(staleConnection.connectionStatus, CONNECTION_STATUS.CONNECTED);
});

test("status is safe and concurrent credential failures share refresh work without corrupting state", async () => {
  const connectedStatus = await getSquareStatus({
    getSquareConfigFn: () => squareConfig,
    isSquareConfiguredFn: () => true,
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.CONNECTED,
    }),
  });
  assert.deepEqual(connectedStatus, {
    configured: true,
    connected: true,
    environment: "sandbox",
    connectionStatus: CONNECTION_STATUS.CONNECTED,
  });

  const status = await getSquareStatus({
    getSquareConfigFn: () => squareConfig,
    isSquareConfiguredFn: () => true,
    findConnectionFn: async () => ({
      environment: "sandbox",
      connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
      accessToken: "secret-access-token",
      refreshToken: "secret-refresh-token",
    }),
  });
  assert.deepEqual(status, {
    configured: true,
    connected: false,
    environment: "sandbox",
    connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
  });
  assert.equal(JSON.stringify(status).includes("secret"), false);

  const connection = { _id: "connection-4", connectionStatus: CONNECTION_STATUS.CONNECTED };
  const refreshGate = deferred();
  const inFlight = new Map();
  let refreshCalls = 0;
  const refreshConnectionOnceFn = (currentConnection) => refreshConnectionOnce(currentConnection, {
    inFlight,
    refreshConnectionFn: async () => {
      refreshCalls += 1;
      await refreshGate.promise;
      return "refreshed-access-token";
    },
  });
  const request = () => squareFetch("/locations", {
    getSquareConfigFn: () => squareConfig,
    getAccessTokenFn: async () => "expired-access-token",
    getConnectionFn: async () => connection,
    refreshConnectionOnceFn,
    markConnectionReauthRequiredFn: async () => {
      throw new Error("Both retries succeed, so health must remain connected.");
    },
    fetchImpl: async (_url, options) => options.headers.Authorization === "Bearer expired-access-token"
      ? squareResponse({ status: 401, data: { errors: [{ code: "ACCESS_TOKEN_EXPIRED" }] } })
      : squareResponse({ status: 200, data: { locations: [] } }),
  });

  const callers = [request(), request()];
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshCalls, 1);
  refreshGate.resolve();
  assert.deepEqual(await Promise.all(callers), [{ locations: [] }, { locations: [] }]);
  assert.equal(inFlight.size, 0);
  assert.equal(connection.connectionStatus, CONNECTION_STATUS.CONNECTED);
});

test("concurrent REAUTH_REQUIRED persistence is idempotent", async () => {
  const connection = { _id: "connection-5", connectionStatus: CONNECTION_STATUS.CONNECTED };
  const writes = [];
  await Promise.all([
    markConnectionReauthRequired(connection, {
      reasonCode: "ACCESS_TOKEN_REVOKED",
      now: new Date("2026-09-12T12:00:00.000Z"),
      updateOneFn: async (filter, update) => { writes.push({ filter, update }); },
    }),
    markConnectionReauthRequired(connection, {
      reasonCode: "ACCESS_TOKEN_REVOKED",
      now: new Date("2026-09-12T12:00:00.000Z"),
      updateOneFn: async (filter, update) => { writes.push({ filter, update }); },
    }),
  ]);
  assert.equal(connection.connectionStatus, CONNECTION_STATUS.REAUTH_REQUIRED);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].filter.connectionStatus, { $ne: CONNECTION_STATUS.REAUTH_REQUIRED });
});
