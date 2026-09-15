const assert = require("node:assert/strict");
const test = require("node:test");

const OAuthState = require("../models/OAuthState");
const {
  createOAuthState,
  createPersistedOAuthState,
  consumePersistedOAuthState,
  verifyOAuthState,
  __testables: { hashOAuthState },
} = require("../services/squareService");
const {
  __testables: {
    beginOAuthFlow,
    clearOAuthStateCookie,
    completeOAuthFlow,
    cookieOptions,
  },
} = require("../controllers/squareController");

const ENVIRONMENT_KEYS = [
  "NODE_ENV",
  "SQUARE_ENVIRONMENT",
  "SQUARE_APPLICATION_ID",
  "SQUARE_APPLICATION_SECRET",
  "SQUARE_REDIRECT_URI",
  "CLIENT_URL",
];
const admin = { _id: "66f0aabbccddeeff00112233", sessionVersion: 4, role: "admin" };

async function withSandboxConfiguration(callback) {
  const previous = Object.fromEntries(
    ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NODE_ENV: "development",
    SQUARE_ENVIRONMENT: "sandbox",
    SQUARE_APPLICATION_ID: "sandbox-sq0idb-test-application-id",
    SQUARE_APPLICATION_SECRET: "sandbox-application-secret",
    SQUARE_REDIRECT_URI: "http://localhost:5001/api/square/oauth/callback",
    CLIENT_URL: "http://localhost:3000",
  });
  try {
    return await callback();
  } finally {
    for (const key of ENVIRONMENT_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function createResponse() {
  return {
    headers: {},
    redirects: [],
    setHeader(name, value) {
      this.headers[name] = value;
    },
    redirect(status, location) {
      this.redirects.push({ status, location });
    },
  };
}

function createAtomicStateStore(record) {
  const calls = [];
  return {
    calls,
    findOneAndUpdate: async (query, update, options) => {
      calls.push({ query, update, options });
      if (
        record.stateHash !== query.stateHash ||
        record.adminId !== query.adminId ||
        record.sessionVersion !== query.sessionVersion ||
        record.environment !== query.environment ||
        record.consumedAt !== null ||
        record.expiresAt <= query.expiresAt.$gt
      ) {
        return null;
      }
      record.consumedAt = update.$set.consumedAt;
      return { ...record };
    },
  };
}

test("creates a signed random state and persists only its hash", async () => {
  await withSandboxConfiguration(async () => {
    const firstState = createOAuthState();
    const secondState = createOAuthState();
    assert.notEqual(firstState, secondState);
    assert.equal(verifyOAuthState(firstState), true);

    let persisted;
    const now = new Date("2026-09-12T12:00:00.000Z");
    await createPersistedOAuthState({
      state: firstState,
      adminId: admin._id,
      sessionVersion: admin.sessionVersion,
      environment: "sandbox",
      now,
      createStateFn: async (document) => {
        persisted = document;
        return document;
      },
    });

    assert.equal(persisted.stateHash, hashOAuthState(firstState));
    assert.equal(Object.hasOwn(persisted, "state"), false);
    assert.equal(JSON.stringify(persisted).includes(firstState), false);
    assert.equal(persisted.issuedAt.toISOString(), now.toISOString());
    assert.equal(persisted.expiresAt.getTime() - persisted.issuedAt.getTime(), 10 * 60 * 1000);
    assert.equal(OAuthState.schema.path("expiresAt").options.index.expires, 0);
  });
});

test("atomically consumes only an unexpired state for its admin, session, and environment", async () => {
  const state = "signed-state";
  const now = new Date("2026-09-12T12:00:00.000Z");
  const record = {
    stateHash: hashOAuthState(state),
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    expiresAt: new Date(now.getTime() + 1_000),
    consumedAt: null,
  };
  const store = createAtomicStateStore(record);

  const consumed = await consumePersistedOAuthState({
    state,
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    now,
    findOneAndUpdateFn: store.findOneAndUpdate,
  });
  assert.ok(consumed);
  assert.equal(store.calls.length, 1);
  assert.equal(store.calls[0].query.consumedAt, null);
  assert.equal(store.calls[0].query.expiresAt.$gt.getTime(), now.getTime());
  assert.equal(store.calls[0].options.new, true);

  assert.equal(await consumePersistedOAuthState({
    state,
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    now,
    findOneAndUpdateFn: store.findOneAndUpdate,
  }), null);

  const wrongAdminStore = createAtomicStateStore({ ...record, consumedAt: null });
  assert.equal(await consumePersistedOAuthState({
    state,
    adminId: "66f0aabbccddeeff00112244",
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    now,
    findOneAndUpdateFn: wrongAdminStore.findOneAndUpdate,
  }), null);

  const wrongSessionStore = createAtomicStateStore({ ...record, consumedAt: null });
  assert.equal(await consumePersistedOAuthState({
    state,
    adminId: admin._id,
    sessionVersion: admin.sessionVersion + 1,
    environment: "sandbox",
    now,
    findOneAndUpdateFn: wrongSessionStore.findOneAndUpdate,
  }), null);

  const expiredStore = createAtomicStateStore({
    ...record,
    consumedAt: null,
    expiresAt: new Date(now.getTime() - 1),
  });
  assert.equal(await consumePersistedOAuthState({
    state,
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    now,
    findOneAndUpdateFn: expiredStore.findOneAndUpdate,
  }), null);

  const productionStore = createAtomicStateStore({
    ...record,
    consumedAt: null,
    environment: "production",
  });
  assert.equal(await consumePersistedOAuthState({
    state,
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    now,
    findOneAndUpdateFn: productionStore.findOneAndUpdate,
  }), null);
});

test("OAuth initiation persists bound state and preserves the redirect and cookie", async () => {
  await withSandboxConfiguration(async () => {
    const response = createResponse();
    let persisted;
    await beginOAuthFlow(
      { admin },
      response,
      {
        createOAuthStateFn: () => "opaque-signed-state",
        createPersistedOAuthStateFn: async (input) => { persisted = input; },
        getSafeAuthorizationMetadataFn: () => ({}),
      },
    );

    assert.deepEqual(persisted, {
      state: "opaque-signed-state",
      adminId: admin._id,
      sessionVersion: admin.sessionVersion,
      environment: "sandbox",
    });
    assert.equal(response.redirects.length, 1);
    const authorizationUrl = new URL(response.redirects[0].location);
    assert.equal(authorizationUrl.searchParams.get("redirect_uri"), process.env.SQUARE_REDIRECT_URI);
    assert.match(response.headers["Set-Cookie"], /^square_oauth_state=opaque-signed-state;/);
    assert.match(response.headers["Set-Cookie"], /HttpOnly; SameSite=Lax; Path=\/api\/square\/oauth; Max-Age=600/);
  });
});

test("callback requires the matching cookie, consumes valid state before exchange, and clears the cookie", async () => {
  const response = createResponse();
  const calls = { consume: [], exchange: [] };
  await completeOAuthFlow(
    {
      admin,
      query: { state: "signed-state", code: "authorization-code" },
      headers: { cookie: "square_oauth_state=signed-state" },
    },
    response,
    {
      verifyOAuthStateFn: () => true,
      consumePersistedOAuthStateFn: async (input) => {
        calls.consume.push(input);
        return { _id: "state-record" };
      },
      exchangeCodeFn: async (code) => calls.exchange.push(code),
      getSquareConfigFn: () => ({ environment: "sandbox" }),
      getClientUrlFn: () => "http://localhost:3000",
    },
  );

  assert.deepEqual(calls.consume, [{
    state: "signed-state",
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
  }]);
  assert.deepEqual(calls.exchange, ["authorization-code"]);
  assert.equal(response.headers["Set-Cookie"].includes("Max-Age=0"), true);
  assert.deepEqual(response.redirects, [{
    status: 302,
    location: "http://localhost:3000/admin?square=connected",
  }]);
});

test("callback rejects missing, invalid, or missing-code state flows without exchanging a code", async () => {
  const cases = [
    { query: { code: "code" }, cookie: "square_oauth_state=state", verify: () => true, code: "SQUARE_OAUTH_STATE_INVALID" },
    { query: { state: "state", code: "code" }, cookie: "square_oauth_state=other", verify: () => true, code: "SQUARE_OAUTH_STATE_INVALID" },
    { query: { state: "state", code: "code" }, cookie: "square_oauth_state=state", verify: () => false, code: "SQUARE_OAUTH_STATE_INVALID" },
    { query: { state: "state" }, cookie: "square_oauth_state=state", verify: () => true, code: undefined },
  ];

  for (const scenario of cases) {
    const response = createResponse();
    let exchangeCalls = 0;
    let consumeCalls = 0;
    await assert.rejects(
      completeOAuthFlow(
        { admin, query: scenario.query, headers: { cookie: scenario.cookie } },
        response,
        {
          verifyOAuthStateFn: scenario.verify,
          consumePersistedOAuthStateFn: async () => {
            consumeCalls += 1;
            return { _id: "state-record" };
          },
          exchangeCodeFn: async () => { exchangeCalls += 1; },
          getSquareConfigFn: () => ({ environment: "sandbox" }),
        },
      ),
      (error) => scenario.code
        ? error.errorCode === scenario.code
        : error.statusCode === 400 && /did not return a code/.test(error.message),
    );
    assert.equal(exchangeCalls, 0);
    assert.equal(response.headers["Set-Cookie"].includes("Max-Age=0"), true);
    assert.equal(consumeCalls, scenario.code ? 0 : 1);
  }
});

test("a valid denied callback consumes state, clears the cookie, and does not exchange a code", async () => {
  const response = createResponse();
  let exchangeCalls = 0;
  await assert.rejects(
    completeOAuthFlow(
      {
        admin,
        query: { state: "state", error: "access_denied" },
        headers: { cookie: "square_oauth_state=state" },
      },
      response,
      {
        verifyOAuthStateFn: () => true,
        consumePersistedOAuthStateFn: async () => ({ _id: "state-record" }),
        exchangeCodeFn: async () => { exchangeCalls += 1; },
        getSquareConfigFn: () => ({ environment: "sandbox" }),
      },
    ),
    { errorCode: "SQUARE_OAUTH_DENIED" },
  );
  assert.equal(exchangeCalls, 0);
  assert.equal(response.headers["Set-Cookie"].includes("Max-Age=0"), true);
});

test("concurrent valid callbacks atomically allow one exchange only", async () => {
  const state = "signed-state";
  const store = createAtomicStateStore({
    stateHash: hashOAuthState(state),
    adminId: admin._id,
    sessionVersion: admin.sessionVersion,
    environment: "sandbox",
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  });
  let exchangeCalls = 0;
  const dependencies = {
    verifyOAuthStateFn: () => true,
    consumePersistedOAuthStateFn: (input) => consumePersistedOAuthState({
      ...input,
      findOneAndUpdateFn: store.findOneAndUpdate,
    }),
    exchangeCodeFn: async () => { exchangeCalls += 1; },
    getSquareConfigFn: () => ({ environment: "sandbox" }),
    clearOAuthStateCookieFn: () => {},
    getClientUrlFn: () => "http://localhost:3000",
  };
  const request = {
    admin,
    query: { state, code: "authorization-code" },
    headers: { cookie: `square_oauth_state=${state}` },
  };

  const outcomes = await Promise.allSettled([
    completeOAuthFlow(request, createResponse(), dependencies),
    completeOAuthFlow(request, createResponse(), dependencies),
  ]);

  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected" && outcome.reason.errorCode === "SQUARE_OAUTH_STATE_INVALID").length, 1);
  assert.equal(exchangeCalls, 1);
});

test("OAuth state cookies remain secure in production", () => {
  assert.match(cookieOptions({ environment: "production" }), /Secure/);
  const response = createResponse();
  clearOAuthStateCookie(response, { environment: "production" });
  assert.match(response.headers["Set-Cookie"], /HttpOnly; SameSite=Lax/);
  assert.match(response.headers["Set-Cookie"], /Max-Age=0; Secure$/);
});
