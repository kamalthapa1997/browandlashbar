const crypto = require("crypto");

const SquareConnection = require("../models/SquareConnection");
const OAuthState = require("../models/OAuthState");
const createHttpError = require("../utils/httpError");
const {
  getSquareConfig,
  getSquareTokenRefreshWindowMs,
  getTokenEncryptionKey,
  isSquareConfigured,
} = require("../config/square");

const OAUTH_SCOPES = [
  "APPOINTMENTS_READ",
  "APPOINTMENTS_WRITE",
  "APPOINTMENTS_ALL_READ",
  "APPOINTMENTS_BUSINESS_SETTINGS_READ",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "ITEMS_READ",
  "MERCHANT_PROFILE_READ",
];
const CONNECTION_KEY = "primary";
const refreshInFlight = new Map();
const REACTIVE_TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const CONNECTION_STATUS = Object.freeze({
  CONNECTED: "CONNECTED",
  REAUTH_REQUIRED: "REAUTH_REQUIRED",
});
// These are deliberately kept server-side so every outbound Square request has
// a bounded lifetime without adding client-facing configuration.
const SQUARE_TIMEOUTS = Object.freeze({
  normal: 10_000,
  createBooking: 20_000,
  oauth: 10_000,
});
const SANDBOX_TEST_SERVICE = Object.freeze({
  name: "Sandbox Test Eyebrow Shaping",
  variationName: "Standard",
  priceMoney: { amount: 2500, currency: "USD" },
  durationMs: 30 * 60 * 1000,
});

function assertSandboxDevelopmentEnvironment() {
  if (process.env.NODE_ENV !== "development" || getSquareConfig().environment !== "sandbox") {
    throw new Error("This command is restricted to NODE_ENV=development and SQUARE_ENVIRONMENT=sandbox.");
  }
}

function assertSandboxDevelopmentSeeding() {
  try {
    assertSandboxDevelopmentEnvironment();
  } catch {
    throw new Error(
      "Sandbox token seeding requires NODE_ENV=development, SQUARE_ENVIRONMENT=sandbox, and SQUARE_ENABLE_SANDBOX_TOKEN_SEED=true.",
    );
  }
  if (process.env.SQUARE_ENABLE_SANDBOX_TOKEN_SEED !== "true") {
    throw new Error(
      "Sandbox token seeding requires NODE_ENV=development, SQUARE_ENVIRONMENT=sandbox, and SQUARE_ENABLE_SANDBOX_TOKEN_SEED=true.",
    );
  }
  if (!process.env.SQUARE_TOKEN_ENCRYPTION_KEY) {
    throw new Error("SQUARE_TOKEN_ENCRYPTION_KEY is required for Sandbox token seeding.");
  }
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(value) {
  const data = Buffer.from(value, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function requireSquareConfiguration() {
  if (!isSquareConfigured()) {
    throw createHttpError(
      503,
      "Square is not configured. Add the required server-side Square environment variables.",
      undefined,
      "SQUARE_NOT_CONFIGURED",
    );
  }
}

function getOAuthStateSignature(state) {
  const { applicationSecret } = getSquareConfig();
  return crypto.createHmac("sha256", applicationSecret).update(state).digest("base64url");
}

function createOAuthState() {
  const payload = Buffer.from(
    JSON.stringify({ nonce: crypto.randomBytes(24).toString("base64url"), issuedAt: Date.now() }),
  ).toString("base64url");
  return `${payload}.${getOAuthStateSignature(payload)}`;
}

function hashOAuthState(state) {
  return crypto.createHash("sha256").update(state).digest("base64url");
}

async function createPersistedOAuthState({
  state,
  adminId,
  sessionVersion,
  environment = getSquareConfig().environment,
  now = new Date(),
  createStateFn = OAuthState.create.bind(OAuthState),
}) {
  const issuedAt = new Date(now);
  return createStateFn({
    stateHash: hashOAuthState(state),
    adminId,
    sessionVersion,
    environment,
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + OAUTH_STATE_TTL_MS),
  });
}

async function consumePersistedOAuthState({
  state,
  adminId,
  sessionVersion,
  environment = getSquareConfig().environment,
  now = new Date(),
  findOneAndUpdateFn = OAuthState.findOneAndUpdate.bind(OAuthState),
}) {
  const consumedAt = new Date(now);
  return findOneAndUpdateFn(
    {
      stateHash: hashOAuthState(state),
      adminId,
      sessionVersion,
      environment,
      consumedAt: null,
      expiresAt: { $gt: consumedAt },
    },
    { $set: { consumedAt } },
    { new: true },
  );
}

function verifyOAuthState(state) {
  if (typeof state !== "string" || !state.includes(".")) return false;
  const [payload, signature] = state.split(".");
  const expected = getOAuthStateSignature(payload);
  const validSignature =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!validSignature) return false;

  try {
    const { issuedAt } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(issuedAt) && Date.now() - issuedAt <= 10 * 60 * 1000;
  } catch {
    return false;
  }
}

function buildAuthorizationUrl(state) {
  requireSquareConfiguration();
  const { oauthBaseUrl, applicationId, redirectUri } = getSquareConfig();
  const url = new URL(`${oauthBaseUrl}/authorize`);
  url.searchParams.set("client_id", applicationId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OAUTH_SCOPES.join(" "));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

function getSafeAuthorizationMetadata(authorizationUrl) {
  const url = new URL(authorizationUrl);
  const scope = url.searchParams.get("scope") || "";
  const config = getSquareConfig();

  return {
    endpoint: `${url.origin}${url.pathname}`,
    environment: config.environment,
    hasClientId: Boolean(url.searchParams.get("client_id")),
    scopes: scope.split(" ").filter(Boolean),
    redirectUri: url.searchParams.get("redirect_uri") || "",
    stateGenerated: Boolean(url.searchParams.get("state")),
    queryParameters: [...url.searchParams.keys()].sort(),
  };
}

function createSquareTimeoutError(operation, timeoutMs) {
  const error = createHttpError(
    504,
    `Square ${operation} request timed out.`,
    undefined,
    "SQUARE_TIMEOUT",
  );
  error.name = "SquareTimeoutError";
  error.operation = operation;
  error.timeoutMs = timeoutMs;
  return error;
}

async function fetchWithTimeout(
  url,
  options,
  { timeoutMs, operation, fetchImpl = fetch, responseHandler },
) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Square request timeout must be a positive number.");
  }

  const controller = new AbortController();
  const timeoutError = createSquareTimeoutError(operation, timeoutMs);
  const timeout = setTimeout(() => controller.abort(timeoutError), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    return responseHandler ? await responseHandler(response) : response;
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason === timeoutError) {
      // Preserve the original AbortError/network detail for server-side callers
      // without losing the stable timeout classification.
      if (error !== timeoutError) timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readSquareJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error?.name === "AbortError" || error?.errorCode === "SQUARE_TIMEOUT") {
      throw error;
    }
    // Square responses are expected to be JSON; keep a safe generic error below.
    return {};
  }
}

function getSquareResponseHeader(response, name) {
  if (!response?.headers) return undefined;
  if (typeof response.headers.get === "function") {
    return response.headers.get(name) || undefined;
  }
  return response.headers[name] || response.headers[name.toLowerCase()];
}

function parseRetryAfterSeconds(value, now = () => Date.now()) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const retryAt = Date.parse(trimmed);
  if (Number.isNaN(retryAt)) return undefined;
  return Math.max(0, Math.ceil((retryAt - now()) / 1000));
}

function getSquareRequestOperation(path, method) {
  if (path === "/bookings" && method === "POST") return "CreateBooking";
  return "API";
}

function classifySquareApiFailure(status, data = {}) {
  const squareCode = data.errors?.[0]?.code;
  const squareDetail = data.errors?.[0]?.detail || "";

  if (
    status === 401 &&
    squareCode === "UNAUTHORIZED" &&
    squareDetail.includes("Merchant not onboarded to Appointments")
  ) {
    return "AUTHORIZATION";
  }
  if (
    status === 401 &&
    ["ACCESS_TOKEN_EXPIRED", "ACCESS_TOKEN_REVOKED", "UNAUTHORIZED"].includes(squareCode)
  ) {
    return "AUTHENTICATION";
  }
  if (status === 403) return "AUTHORIZATION";
  return "NORMAL";
}

function isPermanentRefreshFailure(response) {
  return response.status === 400 || response.status === 401;
}

async function markConnectionReauthRequired(connection, {
  reasonCode,
  now = new Date(),
  updateOneFn = SquareConnection.updateOne.bind(SquareConnection),
} = {}) {
  if (!connection?._id) throw new Error("Cannot mark a missing Square connection as requiring reauthorization.");

  const result = await updateOneFn(
    {
      _id: connection._id,
      connectionStatus: { $ne: CONNECTION_STATUS.REAUTH_REQUIRED },
      ...(connection.accessToken && { accessToken: connection.accessToken }),
    },
    {
      $set: {
        connectionStatus: CONNECTION_STATUS.REAUTH_REQUIRED,
        lastAuthFailureAt: now,
        ...(reasonCode && { lastAuthFailureReasonCode: reasonCode }),
      },
    },
  );
  if (typeof result?.matchedCount === "number" && result.matchedCount === 0) return false;
  connection.connectionStatus = CONNECTION_STATUS.REAUTH_REQUIRED;
  connection.lastAuthFailureAt = now;
  if (reasonCode) connection.lastAuthFailureReasonCode = reasonCode;
  return true;
}

async function squareFetch(path, {
  method = "GET",
  body,
  accessToken,
  timeoutMs,
  fetchImpl,
  getAccessTokenFn = getAccessToken,
  getConnectionFn = getConnection,
  refreshConnectionOnceFn = refreshConnectionOnce,
  markConnectionReauthRequiredFn = markConnectionReauthRequired,
  getSquareConfigFn = getSquareConfig,
} = {}) {
  const config = getSquareConfigFn();
  const operation = getSquareRequestOperation(path, method);
  const requestWithAccessToken = async (token) => fetchWithTimeout(
    `${config.apiBaseUrl}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Square-Version": config.apiVersion,
      },
      ...(body && { body: JSON.stringify(body) }),
    },
    {
      timeoutMs: timeoutMs ?? (
        operation === "CreateBooking" ? SQUARE_TIMEOUTS.createBooking : SQUARE_TIMEOUTS.normal
      ),
      operation,
      ...(fetchImpl && { fetchImpl }),
      responseHandler: async (squareResponse) => ({
        response: squareResponse,
        data: await readSquareJson(squareResponse),
      }),
    },
  );

  let { response, data } = await requestWithAccessToken(accessToken || await getAccessTokenFn());
  if (
    !response.ok &&
    !accessToken &&
    classifySquareApiFailure(response.status, data) === "AUTHENTICATION"
  ) {
    const connection = await getConnectionFn();
    const refreshedAccessToken = await refreshConnectionOnceFn(connection);
    ({ response, data } = await requestWithAccessToken(refreshedAccessToken));

    if (
      !response.ok &&
      classifySquareApiFailure(response.status, data) === "AUTHENTICATION"
    ) {
      const markedReauthRequired = await markConnectionReauthRequiredFn(connection, {
        reasonCode: data.errors?.[0]?.code || "UNAUTHORIZED",
      });
      if (markedReauthRequired === false) {
        throw createHttpError(
          503,
          "Square connection changed while this request was in progress. Please try again.",
          undefined,
          "SQUARE_CONNECTION_CHANGED",
        );
      }
      throw createHttpError(
        503,
        "Square authorization needs to be connected again.",
        undefined,
        "SQUARE_REAUTH_REQUIRED",
      );
    }
  }

  if (!response.ok) {
    const squareCode = data.errors?.[0]?.code;
    const squareDetail = data.errors?.[0]?.detail || "";
    const retryAfterSeconds = parseRetryAfterSeconds(
      getSquareResponseHeader(response, "retry-after"),
    );
    const squareRequestId =
      getSquareResponseHeader(response, "x-square-request-id") ||
      getSquareResponseHeader(response, "request-id");
    const safeSquareErrors = Array.isArray(data.errors)
      ? data.errors.map(({ category, code, field, detail }) => ({
        category,
        code,
        ...(field && { field }),
        ...(typeof detail === "string" && { detail: detail.slice(0, 500) }),
      }))
      : undefined;
    const failureType = classifySquareApiFailure(response.status, data);
    const statusCode = response.status === 429
      ? 429
      : response.status === 401 || response.status === 403 ? 503 : 502;
    const error = createHttpError(
      statusCode,
      response.status === 429
        ? "Square is temporarily rate-limiting requests. Please wait a moment and try again."
        : response.status === 401 || response.status === 403
        ? "Square rejected the configured authorization. Renew the Sandbox test-account token or verify its required scopes."
        : "Square could not complete this request. Please try again.",
      {
        squareStatus: response.status,
        ...(safeSquareErrors && { squareErrors: safeSquareErrors }),
        ...(retryAfterSeconds !== undefined && { retryAfterSeconds }),
        ...(squareRequestId && { squareRequestId }),
      },
      response.status === 429
        ? "SQUARE_RATE_LIMITED"
        : squareCode === "CONFLICT" ? "SQUARE_CONFLICT" : "SQUARE_REQUEST_FAILED",
    );
    error.squareCode = squareCode;
    error.squareFailureType = failureType;
    if (response.status === 429) {
      error.retryable = true;
      error.retryAfterSeconds = retryAfterSeconds;
      error.squareRequestId = squareRequestId;
    }
    if (
      response.status === 401 &&
      squareCode === "UNAUTHORIZED" &&
      squareDetail.includes("Merchant not onboarded to Appointments")
    ) {
      error.message = "Square Appointments must be configured for this Sandbox seller before appointments can be booked.";
      error.exposeMessage = true;
    }
    throw error;
  }

  return data;
}

async function exchangeCode(code, {
  requireSquareConfigurationFn = requireSquareConfiguration,
  getSquareConfigFn = getSquareConfig,
  encryptFn = encrypt,
  fetchWithTimeoutFn = fetchWithTimeout,
  findOneAndUpdateFn = SquareConnection.findOneAndUpdate.bind(SquareConnection),
  now = () => new Date(),
} = {}) {
  requireSquareConfigurationFn();
  const config = getSquareConfigFn();
  const connectedAt = now();
  const { response, data } = await fetchWithTimeoutFn(
    `${config.oauthBaseUrl}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": config.apiVersion },
      body: JSON.stringify({
        client_id: config.applicationId,
        client_secret: config.applicationSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
    },
    {
      timeoutMs: SQUARE_TIMEOUTS.oauth,
      operation: "OAuth authorization",
      responseHandler: async (squareResponse) => ({
        response: squareResponse,
        data: await readSquareJson(squareResponse),
      }),
    },
  );

  if (!response.ok || !data.access_token || !data.refresh_token || !data.merchant_id) {
    throw createHttpError(502, "Square authorization could not be completed.", undefined, "SQUARE_OAUTH_FAILED");
  }

  await findOneAndUpdateFn(
    { connectionKey: CONNECTION_KEY },
    {
      $set: {
        connectionKey: CONNECTION_KEY,
        merchantId: data.merchant_id,
        environment: config.environment,
        accessToken: encryptFn(data.access_token),
        refreshToken: encryptFn(data.refresh_token),
        authMode: "oauth",
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        lastHealthCheckAt: connectedAt,
        ...(data.expires_at && { expiresAt: new Date(data.expires_at) }),
        scopes: Array.isArray(data.scopes) ? data.scopes : OAUTH_SCOPES,
      },
      $unset: {
        lastAuthFailureAt: 1,
        lastAuthFailureReasonCode: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function refreshConnection(connection, {
  fetchWithTimeoutFn = fetchWithTimeout,
  config = getSquareConfig(),
  decryptFn = decrypt,
  encryptFn = encrypt,
  markConnectionReauthRequiredFn = markConnectionReauthRequired,
  persistRefreshedConnectionFn = async (currentConnection, originalCredentials, updates) => {
    const result = await SquareConnection.updateOne(
      {
        _id: currentConnection._id,
        connectionStatus: { $ne: CONNECTION_STATUS.REAUTH_REQUIRED },
        accessToken: originalCredentials.accessToken,
        ...(originalCredentials.refreshToken && { refreshToken: originalCredentials.refreshToken }),
      },
      {
        $set: updates,
        $unset: {
          lastAuthFailureAt: 1,
          lastAuthFailureReasonCode: 1,
        },
      },
    );
    return result.matchedCount > 0;
  },
  now = () => new Date(),
} = {}) {
  if (!connection.refreshToken) {
    const markedReauthRequired = await markConnectionReauthRequiredFn(connection, {
      reasonCode: "SQUARE_REFRESH_TOKEN_MISSING",
      now: now(),
    });
    if (markedReauthRequired === false) {
      throw createHttpError(
        503,
        "Square connection changed while this request was in progress. Please try again.",
        undefined,
        "SQUARE_CONNECTION_CHANGED",
      );
    }
    throw createHttpError(
      503,
      "Square authorization needs to be connected again.",
      undefined,
      "SQUARE_REAUTH_REQUIRED",
    );
  }
  const refreshToken = decryptFn(connection.refreshToken);
  const { response, data } = await fetchWithTimeoutFn(
    `${config.oauthBaseUrl}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Square-Version": config.apiVersion },
      body: JSON.stringify({
        client_id: config.applicationId,
        client_secret: config.applicationSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    },
    {
      timeoutMs: SQUARE_TIMEOUTS.oauth,
      operation: "OAuth token refresh",
      responseHandler: async (squareResponse) => ({
        response: squareResponse,
        data: await readSquareJson(squareResponse),
      }),
    },
  );

  if (!response.ok || !data.access_token) {
    if (!response.ok && isPermanentRefreshFailure(response)) {
      const markedReauthRequired = await markConnectionReauthRequiredFn(connection, {
        reasonCode: data.errors?.[0]?.code || "SQUARE_REFRESH_REJECTED",
        now: now(),
      });
      if (markedReauthRequired === false) {
        throw createHttpError(
          503,
          "Square connection changed while this request was in progress. Please try again.",
          undefined,
          "SQUARE_CONNECTION_CHANGED",
        );
      }
      throw createHttpError(
        503,
        "Square authorization needs to be connected again.",
        undefined,
        "SQUARE_REAUTH_REQUIRED",
      );
    }
    throw createHttpError(
      503,
      "Square token refresh could not be completed. Please try again.",
      undefined,
      "SQUARE_TOKEN_REFRESH_FAILED",
    );
  }

  const originalCredentials = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
  };
  const updates = {
    accessToken: encryptFn(data.access_token),
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    lastHealthCheckAt: now(),
    ...(data.refresh_token && { refreshToken: encryptFn(data.refresh_token) }),
    ...(data.expires_at && { expiresAt: new Date(data.expires_at) }),
    ...(Array.isArray(data.scopes) && { scopes: data.scopes }),
  };
  const persisted = await persistRefreshedConnectionFn(connection, originalCredentials, updates);
  if (!persisted) {
    throw createHttpError(
      503,
      "Square connection changed while this request was in progress. Please try again.",
      undefined,
      "SQUARE_CONNECTION_CHANGED",
    );
  }
  Object.assign(connection, updates);
  connection.lastAuthFailureAt = undefined;
  connection.lastAuthFailureReasonCode = undefined;
  return data.access_token;
}

async function getConnection({
  requireSquareConfigurationFn = requireSquareConfiguration,
  findConnectionFn = () => SquareConnection.findOne({ connectionKey: CONNECTION_KEY }).select(
    "+accessToken +refreshToken",
  ),
  getSquareConfigFn = getSquareConfig,
} = {}) {
  requireSquareConfigurationFn();
  const connection = await findConnectionFn();
  const { environment } = getSquareConfigFn();

  if (!connection || connection.environment !== environment) {
    throw createHttpError(503, "Square has not been connected yet.", undefined, "SQUARE_NOT_CONNECTED");
  }
  if (connection.connectionStatus === CONNECTION_STATUS.REAUTH_REQUIRED) {
    throw createHttpError(
      503,
      "Square authorization needs to be connected again.",
      undefined,
      "SQUARE_REAUTH_REQUIRED",
    );
  }
  return connection;
}

function getRefreshInFlightKey(connection) {
  if (connection?._id) return String(connection._id);
  return `${connection?.environment || "unknown"}:${connection?.connectionKey || CONNECTION_KEY}`;
}

function refreshConnectionOnce(connection, {
  refreshConnectionFn = refreshConnection,
  inFlight = refreshInFlight,
} = {}) {
  const key = getRefreshInFlightKey(connection);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const refreshPromise = Promise.resolve().then(() => refreshConnectionFn(connection));
  inFlight.set(key, refreshPromise);
  refreshPromise.then(
    () => {
      if (inFlight.get(key) === refreshPromise) inFlight.delete(key);
    },
    () => {
      if (inFlight.get(key) === refreshPromise) inFlight.delete(key);
    },
  );
  return refreshPromise;
}

async function getAccessToken({
  getConnectionFn = getConnection,
  refreshConnectionFn = refreshConnection,
  decryptFn = decrypt,
  now = () => Date.now(),
  inFlight = refreshInFlight,
} = {}) {
  const connection = await getConnectionFn();
  if (
    connection.expiresAt &&
    connection.expiresAt.getTime() <= now() + REACTIVE_TOKEN_REFRESH_WINDOW_MS
  ) {
    return refreshConnectionOnce(connection, { refreshConnectionFn, inFlight });
  }
  return decryptFn(connection.accessToken);
}

async function seedSandboxDevelopmentToken(accessToken) {
  assertSandboxDevelopmentSeeding();
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    throw new Error("SQUARE_SANDBOX_ACCESS_TOKEN is required for Sandbox token seeding.");
  }

  await SquareConnection.findOneAndUpdate(
    { connectionKey: CONNECTION_KEY },
    {
      $set: {
        connectionKey: CONNECTION_KEY,
        environment: "sandbox",
        accessToken: encrypt(accessToken.trim()),
        authMode: "sandbox_development",
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        scopes: [],
      },
      $unset: {
        merchantId: 1,
        refreshToken: 1,
        expiresAt: 1,
        lastAuthFailureAt: 1,
        lastAuthFailureReasonCode: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function getSquareStatus({
  getSquareConfigFn = getSquareConfig,
  isSquareConfiguredFn = isSquareConfigured,
  findConnectionFn = () => SquareConnection.findOne({ connectionKey: CONNECTION_KEY }).select(
    "environment connectionStatus",
  ),
} = {}) {
  const config = getSquareConfigFn();
  const connection = await findConnectionFn();
  const connectionStatus = connection?.environment === config.environment
    ? connection.connectionStatus || CONNECTION_STATUS.CONNECTED
    : CONNECTION_STATUS.REAUTH_REQUIRED;
  return {
    configured: isSquareConfiguredFn(),
    connected: connectionStatus === CONNECTION_STATUS.CONNECTED,
    environment: config.environment,
    connectionStatus,
  };
}

function getSquareOperationalStatus(connection, {
  environment,
  now = Date.now(),
  refreshWindowMs,
} = {}) {
  if (!connection || connection.environment !== environment) return "NOT_CONNECTED";
  if (connection.connectionStatus === CONNECTION_STATUS.REAUTH_REQUIRED) return "REAUTH_REQUIRED";

  const expiresAtMs = connection.expiresAt instanceof Date
    ? connection.expiresAt.getTime()
    : new Date(connection.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return "TOKEN_EXPIRATION_UNKNOWN";
  if (expiresAtMs <= now + refreshWindowMs) return "TOKEN_REFRESH_DUE";
  return "HEALTHY";
}

async function getSquareAdminHealth({
  getSquareConfigFn = getSquareConfig,
  getRefreshWindowMsFn = getSquareTokenRefreshWindowMs,
  isSquareConfiguredFn = isSquareConfigured,
  findConnectionFn = () => SquareConnection.findOne({ connectionKey: CONNECTION_KEY }).select(
    "environment connectionStatus lastHealthCheckAt lastAuthFailureAt lastAuthFailureReasonCode expiresAt",
  ),
  now = () => Date.now(),
} = {}) {
  const config = getSquareConfigFn();
  if (!isSquareConfiguredFn()) {
    return {
      configured: false,
      connected: false,
      connectionStatus: "NOT_CONFIGURED",
      operationalStatus: "NOT_CONFIGURED",
      environment: config.environment,
    };
  }

  const connection = await findConnectionFn();
  const connectionStatus = connection?.environment === config.environment
    ? connection.connectionStatus || CONNECTION_STATUS.CONNECTED
    : "NOT_CONNECTED";
  const operationalStatus = getSquareOperationalStatus(connection, {
    environment: config.environment,
    now: now(),
    refreshWindowMs: getRefreshWindowMsFn(),
  });
  return {
    configured: true,
    connected: connectionStatus === CONNECTION_STATUS.CONNECTED,
    connectionStatus,
    operationalStatus,
    environment: config.environment,
    ...(connection?.lastHealthCheckAt && { lastHealthCheckAt: connection.lastHealthCheckAt }),
    ...(connection?.lastAuthFailureAt && { lastAuthFailureAt: connection.lastAuthFailureAt }),
    ...(connection?.lastAuthFailureReasonCode && {
      lastAuthFailureReasonCode: connection.lastAuthFailureReasonCode,
    }),
  };
}

async function listLocations() {
  const data = await squareFetch("/locations");
  return (data.locations || []).filter((location) => location.status === "ACTIVE");
}

async function resolveLocation() {
  const locations = await listLocations();
  const { locationId } = getSquareConfig();
  if (locationId) {
    const location = locations.find((item) => item.id === locationId);
    if (!location) throw createHttpError(503, "The configured Square location is unavailable.", undefined, "SQUARE_LOCATION_UNAVAILABLE");
    return location;
  }
  if (locations.length === 1) return locations[0];
  throw createHttpError(503, "Set SQUARE_LOCATION_ID to a valid active Square location.", undefined, "SQUARE_LOCATION_REQUIRED");
}

async function listBookableTeamMembers() {
  const data = await squareFetch("/bookings/team-member-booking-profiles");
  return (data.team_member_booking_profiles || []).filter((profile) => profile.is_bookable);
}

async function retrieveServiceVariation(variationId, options = {}) {
  const fetchSquare = options.squareFetch || squareFetch;
  const data = await fetchSquare(
    `/catalog/object/${encodeURIComponent(variationId)}?include_related_objects=true`,
  );
  const object = data.object;
  if (
    !object ||
    object.type !== "ITEM_VARIATION" ||
    object.is_deleted ||
    !object.item_variation_data?.available_for_booking
  ) {
    throw createHttpError(422, "This service is not available for online booking.", undefined, "SERVICE_NOT_BOOKABLE");
  }
  const parentItem = (data.related_objects || []).find(
    (relatedObject) =>
      relatedObject.type === "ITEM" &&
      relatedObject.id === object.item_variation_data.item_id,
  );
  if (
    !parentItem ||
    parentItem.is_deleted ||
    parentItem.item_data?.is_archived ||
    parentItem.item_data?.product_type !== "APPOINTMENTS_SERVICE"
  ) {
    throw createHttpError(
      422,
      "This service is not available for online booking.",
      undefined,
      "SERVICE_NOT_BOOKABLE",
    );
  }
  return {
    variation: object,
    serviceName: parentItem.item_data?.name || object.item_variation_data?.name || "Selected service",
  };
}

function toBookableCatalogService(item) {
  if (
    !item ||
    item.type !== "ITEM" ||
    item.is_deleted ||
    item.item_data?.is_archived ||
    item.item_data?.product_type !== "APPOINTMENTS_SERVICE"
  ) {
    return null;
  }
  return {
    id: item.id,
    name: item.item_data.name,
    variations: (item.item_data.variations || [])
      .filter(
        (variation) =>
          !variation.is_deleted &&
          variation.item_variation_data?.available_for_booking,
      )
      .map((variation) => ({
        id: variation.id,
        version: variation.version,
        name: variation.item_variation_data?.name,
        durationMs: variation.item_variation_data.service_duration,
        priceMoney: variation.item_variation_data.price_money,
      })),
  };
}

async function listAppointmentServiceCatalogItems(fetchSquare = squareFetch) {
  const items = [];
  let cursor;

  do {
    const data = await fetchSquare("/catalog/search-catalog-items", {
      method: "POST",
      body: {
        product_types: ["APPOINTMENTS_SERVICE"],
        archived_state: "ARCHIVED_STATE_NOT_ARCHIVED",
        limit: 100,
        ...(cursor && { cursor }),
      },
    });
    items.push(...(data.items || []));
    cursor = data.cursor;
  } while (cursor);

  return items;
}

function getCategoryReferences(item) {
  const categories = Array.isArray(item.item_data?.categories)
    ? item.item_data.categories
    : [];
  const references = categories
    .filter((category) => typeof category?.id === "string" && category.id)
    .map((category) => ({
      id: category.id,
      ordinal: Number.isFinite(category.ordinal) ? category.ordinal : Number.MAX_SAFE_INTEGER,
    }));

  if (!references.length && typeof item.item_data?.category_id === "string") {
    references.push({ id: item.item_data.category_id, ordinal: Number.MAX_SAFE_INTEGER });
  }

  return references.sort((first, second) =>
    first.ordinal - second.ordinal || first.id.localeCompare(second.id),
  );
}

async function resolveCatalogCategories(categoryIds, fetchSquare = squareFetch) {
  const categories = new Map();
  const uniqueIds = [...new Set(categoryIds)].filter(Boolean);

  for (let index = 0; index < uniqueIds.length; index += 1000) {
    const data = await fetchSquare("/catalog/batch-retrieve", {
      method: "POST",
      body: { object_ids: uniqueIds.slice(index, index + 1000) },
    });
    for (const object of data.objects || []) {
      if (object.type === "CATEGORY" && object.category_data?.name) {
        categories.set(object.id, object.category_data.name);
      }
    }
  }

  return categories;
}

async function listCatalogServices(options = {}) {
  const fetchSquare = options.squareFetch || squareFetch;
  const items = await listAppointmentServiceCatalogItems(fetchSquare);
  return items.map(toBookableCatalogService).filter((item) => item?.variations.length);
}

async function listBookingCatalogServices(options = {}) {
  const fetchSquare = options.squareFetch || squareFetch;
  const services = (await listAppointmentServiceCatalogItems(fetchSquare))
    .map((item) => ({ item, service: toBookableCatalogService(item) }))
    .filter(({ service }) => service?.variations.length);
  const categoryIds = services.flatMap(({ item }) =>
    getCategoryReferences(item).map((category) => category.id),
  );
  const categoryNames = await resolveCatalogCategories(categoryIds, fetchSquare);
  const grouped = new Map();

  for (const { item, service } of services) {
    const primaryCategory = getCategoryReferences(item)[0];
    const categoryId = primaryCategory?.id || "uncategorized";
    const categoryName = primaryCategory && categoryNames.get(primaryCategory.id)
      ? categoryNames.get(primaryCategory.id)
      : "Uncategorized";
    const category = grouped.get(categoryId) || {
      id: categoryId,
      name: categoryName,
      services: [],
    };
    category.services.push(service);
    grouped.set(categoryId, category);
  }

  return {
    categories: [...grouped.values()]
      .map((category) => ({
        ...category,
        services: category.services.sort((first, second) =>
          first.name.localeCompare(second.name) || first.id.localeCompare(second.id),
        ),
      }))
      .sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id)),
  };
}

async function ensureSandboxTestCatalogService() {
  assertSandboxDevelopmentEnvironment();
  const location = await resolveLocation();
  const existing = (await listCatalogServices()).find(
    (item) => item.name === SANDBOX_TEST_SERVICE.name,
  );
  const existingVariation = existing?.variations?.find((variation) => variation.id);

  if (existing && existingVariation) {
    return { location, item: existing, variation: existingVariation, created: false };
  }
  if (existing) {
    throw new Error("The existing Sandbox test catalog item has no bookable variation. Update or remove it in Square before rerunning this command.");
  }

  const upserted = await squareFetch("/catalog/object", {
    method: "POST",
    body: {
      idempotency_key: crypto.randomUUID(),
      object: {
        id: "#sandbox_test_eyebrow_shaping",
        type: "ITEM",
        present_at_all_locations: false,
        present_at_location_ids: [location.id],
        item_data: {
          name: SANDBOX_TEST_SERVICE.name,
          product_type: "APPOINTMENTS_SERVICE",
          variations: [
            {
              id: "#sandbox_test_eyebrow_shaping_standard",
              type: "ITEM_VARIATION",
              present_at_all_locations: false,
              present_at_location_ids: [location.id],
              item_variation_data: {
                item_id: "#sandbox_test_eyebrow_shaping",
                name: SANDBOX_TEST_SERVICE.variationName,
                pricing_type: "FIXED_PRICING",
                price_money: SANDBOX_TEST_SERVICE.priceMoney,
                service_duration: SANDBOX_TEST_SERVICE.durationMs,
                available_for_booking: true,
              },
            },
          ],
        },
      },
    },
  });

  const item = toBookableCatalogService(upserted.catalog_object);
  const variation = item?.variations?.find((candidate) => candidate.id);
  if (!item || !variation) {
    throw new Error("Square created the Sandbox test item but it is not available as a bookable service yet.");
  }
  return { location, item, variation, created: true };
}

module.exports = {
  CONNECTION_STATUS,
  OAUTH_SCOPES,
  SANDBOX_TEST_SERVICE,
  assertSandboxDevelopmentEnvironment,
  buildAuthorizationUrl,
  assertSandboxDevelopmentSeeding,
  createOAuthState,
  createPersistedOAuthState,
  consumePersistedOAuthState,
  exchangeCode,
  getSquareAdminHealth,
  getSquareStatus,
  getSafeAuthorizationMetadata,
  ensureSandboxTestCatalogService,
  listBookableTeamMembers,
  listBookingCatalogServices,
  listCatalogServices,
  listLocations,
  resolveLocation,
  retrieveServiceVariation,
  refreshConnectionOnce,
  seedSandboxDevelopmentToken,
  squareFetch,
  __testables: {
    classifySquareApiFailure,
    fetchWithTimeout,
    getAccessToken,
    getConnection,
    getSquareOperationalStatus,
    hashOAuthState,
    isPermanentRefreshFailure,
    markConnectionReauthRequired,
    parseRetryAfterSeconds,
    refreshConnection,
    refreshConnectionOnce,
  },
  verifyOAuthState,
};
