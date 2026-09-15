const assert = require("node:assert/strict");
const test = require("node:test");

const {
  __testables: { getAccessToken, refreshConnection },
} = require("../services/squareService");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createExpiredConnectionStore() {
  const stored = {
    _id: "seller-primary",
    connectionKey: "primary",
    environment: "sandbox",
    accessToken: "encrypted-old-token",
    refreshToken: "encrypted-refresh-token",
    expiresAt: new Date(0),
  };

  let persistenceWrites = 0;
  return {
    stored,
    get persistenceWrites() { return persistenceWrites; },
    getConnection: async () => ({
      ...stored,
      save: async function save() {
        persistenceWrites += 1;
        stored.accessToken = this.accessToken;
        stored.refreshToken = this.refreshToken;
        stored.expiresAt = this.expiresAt;
      },
    }),
  };
}

test("concurrent expired-token callers share one refresh and receive the persisted new token", async () => {
  const connectionStore = createExpiredConnectionStore();
  const { stored, getConnection } = connectionStore;
  const refreshGate = deferred();
  const inFlight = new Map();
  let refreshCalls = 0;
  const refreshConnectionFn = (connection) => refreshConnection(connection, {
    config: {
      oauthBaseUrl: "https://oauth.example.test",
      applicationId: "test-application-id",
      applicationSecret: "test-application-secret",
      apiVersion: "test-version",
    },
    decryptFn: () => "refresh-token",
    encryptFn: (value) => `encrypted:${value}`,
    persistRefreshedConnectionFn: async (connection, _originalCredentials, updates) => {
      Object.assign(connection, updates);
      await connection.save();
      return true;
    },
    fetchWithTimeoutFn: async (_url, _options) => {
      refreshCalls += 1;
      await refreshGate.promise;
      return {
        response: { ok: true },
        data: {
          access_token: "new-access-token",
          refresh_token: "next-refresh-token",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      };
    },
  });
  const options = {
    getConnectionFn: getConnection,
    refreshConnectionFn,
    decryptFn: (value) => value === "encrypted:new-access-token" ? "new-access-token" : "old-access-token",
    inFlight,
  };

  const callers = Array.from({ length: 8 }, () => getAccessToken(options));
  await nextTurn();
  assert.equal(refreshCalls, 1);

  refreshGate.resolve();
  assert.deepEqual(await Promise.all(callers), Array(8).fill("new-access-token"));
  assert.equal(connectionStore.persistenceWrites, 1);
  assert.equal(stored.accessToken, "encrypted:new-access-token");
  assert.equal(stored.refreshToken, "encrypted:next-refresh-token");
  assert.equal(inFlight.size, 0);

  assert.equal(await getAccessToken(options), "new-access-token");
  assert.equal(refreshCalls, 1);
});

test("failed concurrent refreshes share one failure, clear state, and permit a later refresh", async () => {
  const { stored, getConnection } = createExpiredConnectionStore();
  const refreshGate = deferred();
  const inFlight = new Map();
  const failure = new Error("Square refresh temporarily failed");
  let refreshCalls = 0;
  const refreshConnection = async () => {
    refreshCalls += 1;
    if (refreshCalls === 1) {
      await refreshGate.promise;
      throw failure;
    }
    stored.accessToken = "encrypted-recovered-token";
    stored.expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    return "recovered-access-token";
  };
  const options = {
    getConnectionFn: getConnection,
    refreshConnectionFn: refreshConnection,
    decryptFn: (value) => value === "encrypted-recovered-token"
      ? "recovered-access-token"
      : "old-access-token",
    inFlight,
  };

  const callers = Array.from({ length: 5 }, () => getAccessToken(options));
  await nextTurn();
  assert.equal(refreshCalls, 1);

  refreshGate.resolve();
  const outcomes = await Promise.allSettled(callers);
  assert.equal(outcomes.every((outcome) => outcome.status === "rejected" && outcome.reason === failure), true);
  assert.equal(inFlight.size, 0);

  assert.equal(await getAccessToken(options), "recovered-access-token");
  assert.equal(refreshCalls, 2);
  assert.equal(inFlight.size, 0);
});
