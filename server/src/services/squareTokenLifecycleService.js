const SquareConnection = require("../models/SquareConnection");
const {
  getSquareConfig,
  getSquareTokenRefreshWindowMs,
  isSquareConfigured,
} = require("../config/square");
const { CONNECTION_STATUS, refreshConnectionOnce } = require("./squareService");

const SQUARE_CONNECTION_KEY = "primary";
const SQUARE_TOKEN_LIFECYCLE_INTERVAL_MS = 5 * 60 * 1000;

function getConnectionExpiryMs(connection) {
  const expiresAt = connection?.expiresAt;
  const expiresAtMs = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return Number.isFinite(expiresAtMs) ? expiresAtMs : undefined;
}

function getProactiveRefreshDecision(connection, {
  environment,
  now = Date.now(),
  refreshWindowMs,
} = {}) {
  if (!connection || connection.environment !== environment) return { refresh: false, reason: "NO_CONNECTION" };
  if (connection.connectionStatus === CONNECTION_STATUS.REAUTH_REQUIRED) {
    return { refresh: false, reason: "REAUTH_REQUIRED" };
  }

  const expiresAtMs = getConnectionExpiryMs(connection);
  if (expiresAtMs === undefined) return { refresh: false, reason: "EXPIRATION_UNKNOWN" };
  if (expiresAtMs > now + refreshWindowMs) return { refresh: false, reason: "OUTSIDE_REFRESH_WINDOW" };
  return { refresh: true, reason: "WITHIN_REFRESH_WINDOW" };
}

function createSquareTokenLifecycle({
  isSquareConfiguredFn = isSquareConfigured,
  getSquareConfigFn = getSquareConfig,
  getRefreshWindowMsFn = getSquareTokenRefreshWindowMs,
  findConnectionFn = () => SquareConnection.findOne({ connectionKey: SQUARE_CONNECTION_KEY }).select(
    "+accessToken +refreshToken",
  ),
  refreshConnectionOnceFn = refreshConnectionOnce,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  now = () => Date.now(),
  logger = console,
  intervalMs = SQUARE_TOKEN_LIFECYCLE_INTERVAL_MS,
} = {}) {
  let timer;
  let cyclePromise;

  async function checkConnection() {
    if (!isSquareConfiguredFn()) return { refreshed: false, reason: "NOT_CONFIGURED" };

    const config = getSquareConfigFn();
    const connection = await findConnectionFn();
    const decision = getProactiveRefreshDecision(connection, {
      environment: config.environment,
      now: now(),
      refreshWindowMs: getRefreshWindowMsFn(),
    });
    if (!decision.refresh) return { refreshed: false, reason: decision.reason };

    await refreshConnectionOnceFn(connection);
    return { refreshed: true, reason: "REFRESHED" };
  }

  function runCycle() {
    if (cyclePromise) return cyclePromise;

    cyclePromise = Promise.resolve()
      .then(checkConnection)
      .catch((error) => {
        logger.warn?.("Square proactive token refresh failed.", {
          code: error?.errorCode || "SQUARE_TOKEN_LIFECYCLE_FAILED",
        });
        return { refreshed: false, reason: "FAILED", errorCode: error?.errorCode };
      })
      .finally(() => {
        cyclePromise = undefined;
      });
    return cyclePromise;
  }

  function start() {
    if (timer !== undefined) return timer;
    timer = setIntervalFn(() => { void runCycle(); }, intervalMs);
    timer.unref?.();
    void runCycle();
    return timer;
  }

  function stop() {
    if (timer === undefined) return;
    clearIntervalFn(timer);
    timer = undefined;
  }

  return {
    checkConnection,
    runCycle,
    start,
    stop,
    isStarted: () => timer !== undefined,
  };
}

const squareTokenLifecycle = createSquareTokenLifecycle();

module.exports = {
  SQUARE_TOKEN_LIFECYCLE_INTERVAL_MS,
  createSquareTokenLifecycle,
  getProactiveRefreshDecision,
  startSquareTokenLifecycle: squareTokenLifecycle.start,
  stopSquareTokenLifecycle: squareTokenLifecycle.stop,
};
