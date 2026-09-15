const crypto = require("crypto");

const BookingAttempt = require("../models/BookingAttempt");
const asyncHandler = require("../utils/asyncHandler");
const createHttpError = require("../utils/httpError");
const { createRateLimiter } = require("../middleware/rateLimitMiddleware");
const {
  buildAuthorizationUrl,
  createOAuthState,
  createPersistedOAuthState,
  consumePersistedOAuthState,
  exchangeCode,
  getSquareAdminHealth,
  getSafeAuthorizationMetadata,
  getSquareStatus,
  listBookingCatalogServices,
  listBookableTeamMembers,
  listCatalogServices,
  listLocations,
  resolveLocation,
  retrieveServiceVariation,
  squareFetch,
  verifyOAuthState,
} = require("../services/squareService");
const { getPublicMenu } = require("../services/squareMenuService");
const { getSquareConfig } = require("../config/square");
const {
  BookingAttemptStore,
  createRequestFingerprint,
  throwStoredFailure,
} = require("../services/bookingAttemptService");
const {
  validateAvailabilityPayload,
  validateBookingPayload,
} = require("../utils/validators");

const BUSINESS_TIME_ZONE = "America/New_York";
const bookingAttemptStore = new BookingAttemptStore(BookingAttempt);

function getCookie(request, name) {
  const value = (request.headers.cookie || "")
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : "";
}

function cookieOptions(config = getSquareConfig()) {
  return [
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/square/oauth",
    "Max-Age=600",
    ...(config.environment === "production" ? ["Secure"] : []),
  ].join("; ");
}

function clearOAuthStateCookie(response, config = getSquareConfig()) {
  response.setHeader(
    "Set-Cookie",
    [
      "square_oauth_state=",
      "HttpOnly",
      "SameSite=Lax",
      "Path=/api/square/oauth",
      "Max-Age=0",
      ...(config.environment === "production" ? ["Secure"] : []),
    ].join("; "),
  );
}

function getOAuthStateBinding(admin) {
  if (!admin?._id || !Number.isInteger(admin.sessionVersion)) {
    throw createHttpError(401, "Authentication is required");
  }
  return { adminId: admin._id, sessionVersion: admin.sessionVersion };
}

function createOAuthStateInvalidError() {
  return createHttpError(
    400,
    "Square authorization could not be verified. Please try again.",
    undefined,
    "SQUARE_OAUTH_STATE_INVALID",
  );
}

function getOffsetMilliseconds(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return (
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    ) - date.getTime()
  );
}

function businessDateRange(startDate, endDate = startDate) {
  const [year, month, day] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const startGuess = Date.UTC(year, month - 1, day);
  const endGuess = Date.UTC(endYear, endMonth - 1, endDay + 1);
  const start = new Date(
    startGuess -
      getOffsetMilliseconds(new Date(startGuess), BUSINESS_TIME_ZONE),
  );
  const end = new Date(
    endGuess - getOffsetMilliseconds(new Date(endGuess), BUSINESS_TIME_ZONE),
  );
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function dateInBusinessTimeZone(isoDate) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoDate));
}

function canonicalizeVariationIds(variationIds) {
  return [...variationIds].sort();
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (
    phone.trim().startsWith("+") &&
    digits.length >= 8 &&
    digits.length <= 15
  ) {
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  throw createHttpError(
    400,
    "Phone number must include a valid country code or US phone number",
  );
}

async function resolveBookableVariation(variationId) {
  return retrieveServiceVariation(variationId);
}

async function resolveEligibleTeamMembers(variation, bookableProfiles) {
  const profiles = bookableProfiles || await listBookableTeamMembers();
  const allowedIds = Array.isArray(variation.item_variation_data?.team_member_ids)
    ? variation.item_variation_data.team_member_ids
    : [];
  const eligible = allowedIds.length
    ? profiles.filter((profile) => allowedIds.includes(profile.team_member_id))
    : profiles;
  if (!eligible.length) {
    throw createHttpError(
      422,
      "No eligible staff member is available for this service.",
      undefined,
      "NO_ELIGIBLE_TEAM_MEMBERS",
    );
  }
  return eligible;
}

async function searchAvailability({
  date,
  startDate = date,
  endDate = date,
  location,
  selections,
  fetchSquare = squareFetch,
}) {
  const { startAt, endAt } = businessDateRange(startDate, endDate);
  const data = await fetchSquare("/bookings/availability/search", {
    method: "POST",
    body: {
      query: {
        filter: {
          start_at_range: { start_at: startAt, end_at: endAt },
          location_id: location.id,
          segment_filters: selections.map(({ variation, profiles }) => ({
            service_variation_id: variation.id,
            team_member_id_filter: {
              any: profiles.map((profile) => profile.team_member_id),
            },
          })),
        },
      },
    },
  });

  return data.availabilities || [];
}

async function findCombinedAvailability({ variationIds, date, startDate, endDate }, dependencies = {}) {
  const resolveVariation =
    dependencies.resolveBookableVariation || resolveBookableVariation;
  const resolveBookingLocation = dependencies.resolveLocation || resolveLocation;
  const getBookableTeamMembers =
    dependencies.listBookableTeamMembers || listBookableTeamMembers;
  const findAvailability = dependencies.searchAvailability || searchAvailability;
  const beforeSquareOperation = dependencies.beforeSquareOperation;

  // Resolve all requested IDs before searching availability. A failure for any
  // one service prevents a partial or substituted availability response.
  if (beforeSquareOperation) await beforeSquareOperation();
  const resolvedVariations = await Promise.all(
    variationIds.map((variationId) => resolveVariation(variationId)),
  );
  if (beforeSquareOperation) await beforeSquareOperation();
  const [location, profiles] = await Promise.all([
    resolveBookingLocation(),
    getBookableTeamMembers(),
  ]);
  const selections = await Promise.all(
    resolvedVariations.map(async ({ variation }) => ({
      variation,
      profiles: await resolveEligibleTeamMembers(variation, profiles),
    })),
  );
  if (beforeSquareOperation) await beforeSquareOperation();
  const slots = await findAvailability({
    date,
    startDate: startDate || date,
    endDate: endDate || date,
    location,
    selections,
  });

  return { location, profiles, resolvedVariations, slots };
}

async function getAvailabilityData({ variationIds, date }, dependencies = {}) {
  const { profiles, slots } = await findCombinedAvailability(
    { variationIds, date },
    dependencies,
  );
  const names = new Map(
    profiles.map((profile) => [profile.team_member_id, profile.display_name]),
  );

  return {
    date,
    timezone: BUSINESS_TIME_ZONE,
    availability: slots.map((slot) => ({
      startAt: slot.start_at,
      teamMemberName:
        names.get(slot.appointment_segments?.[0]?.team_member_id) ||
        "Staff member",
    })),
  };
}

function calendarDates(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T12:00:00Z`);
  const finalDate = new Date(`${endDate}T12:00:00Z`);

  while (current <= finalDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function mapAvailabilitySlot(slot, names) {
  return {
    startAt: slot.start_at,
    teamMemberName:
      names.get(slot.appointment_segments?.[0]?.team_member_id) ||
      "Staff member",
  };
}

async function getAvailabilityRangeData(
  { variationIds, startDate, endDate },
  dependencies = {},
) {
  const { profiles, slots } = await findCombinedAvailability(
    { variationIds, startDate, endDate },
    dependencies,
  );
  const names = new Map(
    profiles.map((profile) => [profile.team_member_id, profile.display_name]),
  );
  const availabilityByDate = Object.fromEntries(
    calendarDates(startDate, endDate).map((calendarDate) => [calendarDate, []]),
  );

  slots.forEach((slot) => {
    const calendarDate = dateInBusinessTimeZone(slot.start_at);

    if (availabilityByDate[calendarDate]) {
      availabilityByDate[calendarDate].push(mapAvailabilitySlot(slot, names));
    }
  });

  return { startDate, endDate, timezone: BUSINESS_TIME_ZONE, availabilityByDate };
}

async function findOrCreateCustomer(customer, dependencies = {}) {
  const fetchSquare = dependencies.squareFetch || squareFetch;
  const beforeSquareOperation = dependencies.beforeSquareOperation;
  const phoneNumber = normalizePhone(customer.phone);
  let existing = [];
  if (customer.email) {
    if (beforeSquareOperation) await beforeSquareOperation();
    const data = await fetchSquare("/customers/search", {
      method: "POST",
      body: {
        query: { filter: { email_address: { exact: customer.email } } },
        limit: 1,
      },
    });
    existing = data.customers || [];
  }
  if (!existing.length) {
    if (beforeSquareOperation) await beforeSquareOperation();
    const data = await fetchSquare("/customers/search", {
      method: "POST",
      body: {
        query: { filter: { phone_number: { exact: phoneNumber } } },
        limit: 1,
      },
    });
    existing = data.customers || [];
  }
  if (existing[0]?.id) return existing[0].id;

  if (beforeSquareOperation) await beforeSquareOperation();
  const created = await fetchSquare("/customers", {
    method: "POST",
    body: {
      given_name: customer.firstName,
      family_name: customer.lastName,
      phone_number: phoneNumber,
      ...(customer.email && { email_address: customer.email }),
    },
  });
  if (!created.customer?.id)
    throw createHttpError(502, "Square could not save customer information.");
  return created.customer.id;
}

function createConfirmation({ booking, location, service }) {
  return {
    id: booking.id,
    status: booking.status,
    startAt: booking.start_at,
    location: location.name,
    service: service.name,
  };
}

function createSlotUnavailableError() {
  return createHttpError(
    409,
    "The selected time is no longer available. Please choose another time.",
    undefined,
    "SLOT_UNAVAILABLE",
  );
}

function createAuthoritativeAvailabilityError() {
  return createHttpError(
    502,
    "Square returned an invalid appointment availability. Please choose another time.",
    undefined,
    "SQUARE_AVAILABILITY_INVALID",
  );
}

function selectAuthoritativeAvailability(slots, startAt, variationIds) {
  if (!Array.isArray(slots)) throw createAuthoritativeAvailabilityError();

  const requestedStartAt = new Date(startAt).getTime();
  const matchingSlots = slots.filter(
    (slot) =>
      slot &&
      typeof slot.start_at === "string" &&
      new Date(slot.start_at).getTime() === requestedStartAt,
  );

  if (!matchingSlots.length) throw createSlotUnavailableError();
  if (matchingSlots.length !== 1) throw createAuthoritativeAvailabilityError();

  const selected = matchingSlots[0];
  const segments = selected.appointment_segments;
  if (!Array.isArray(segments) || segments.length !== variationIds.length) {
    throw createAuthoritativeAvailabilityError();
  }

  const segmentVariationIds = segments.map((segment) => segment?.service_variation_id);
  const canonicalSegmentVariationIds = canonicalizeVariationIds(segmentVariationIds);
  const canonicalRequestedVariationIds = canonicalizeVariationIds(variationIds);
  if (
    segmentVariationIds.some((variationId) => typeof variationId !== "string") ||
    canonicalSegmentVariationIds.length !== canonicalRequestedVariationIds.length ||
    canonicalSegmentVariationIds.some(
      (variationId, index) => variationId !== canonicalRequestedVariationIds[index],
    )
  ) {
    throw createAuthoritativeAvailabilityError();
  }

  for (const segment of segments) {
    if (
      !Number.isInteger(segment?.duration_minutes) ||
      segment.duration_minutes <= 0 ||
      !Number.isInteger(segment.service_variation_version) ||
      segment.service_variation_version < 0 ||
      typeof segment.team_member_id !== "string" ||
      !segment.team_member_id
    ) {
      throw createAuthoritativeAvailabilityError();
    }
  }

  return selected;
}

function createSquareBookingRequest({ selected, location, customerId }) {
  return {
    booking: {
      start_at: selected.start_at,
      location_id: location.id,
      customer_id: customerId,
      appointment_segments: selected.appointment_segments.map((segment) => ({
        duration_minutes: segment.duration_minutes,
        service_variation_id: segment.service_variation_id,
        service_variation_version: segment.service_variation_version,
        team_member_id: segment.team_member_id,
      })),
    },
  };
}

async function prepareAuthoritativeBooking({ variationIds, startAt, customer }, dependencies = {}) {
  const findCustomer = dependencies.findOrCreateCustomer || findOrCreateCustomer;
  const date = dateInBusinessTimeZone(startAt);
  const { location, resolvedVariations, slots } = await findCombinedAvailability(
    { variationIds, date },
    dependencies,
  );
  const selected = selectAuthoritativeAvailability(slots, startAt, variationIds);
  const customerId = await findCustomer(customer, {
    beforeSquareOperation: dependencies.beforeSquareOperation,
  });

  return {
    squareBookingRequest: createSquareBookingRequest({
      selected,
      location,
      customerId,
    }),
    confirmation: {
      location: location.name,
      service: resolvedVariations.map(({ serviceName }) => serviceName).join(" + "),
    },
  };
}

function isDefinitiveSquareFailure(error) {
  const squareStatus = error.details?.squareStatus;
  return (
    Number.isInteger(squareStatus) && squareStatus >= 400 && squareStatus < 500
  );
}

function shouldReleasePrePersistenceAttempt(error) {
  return (
    error?.errorCode === "SQUARE_RATE_LIMITED" ||
    error?.statusCode >= 500 ||
    !error?.statusCode
  );
}

function isSquareStaleSlotError(error) {
  const squareErrors = error.details?.squareErrors;
  return Array.isArray(squareErrors) && squareErrors.some(
    (squareError) =>
      squareError.category === "INVALID_REQUEST_ERROR" &&
      squareError.code === "BAD_REQUEST" &&
      squareError.field === "start_at" &&
      /\btime slot is no longer available\b/i.test(squareError.detail || ""),
  );
}

async function executeStoredSquareBooking(attempt, leaseToken, dependencies = {}) {
  const fetchSquare = dependencies.squareFetch || squareFetch;
  const attemptStore = dependencies.bookingAttemptStore || bookingAttemptStore;
  const squareBookingRequest = attempt.squareBookingRequest.toObject();
  try {
    const data = await fetchSquare("/bookings", {
      method: "POST",
      body: {
        idempotency_key: attempt.squareIdempotencyKey,
        ...squareBookingRequest,
      },
    });
    const confirmation = createConfirmation({
      booking: data.booking,
      location: { name: attempt.confirmation.location },
      service: { name: attempt.confirmation.service },
    });
    await attemptStore.markSucceeded(attempt, confirmation);
    return confirmation;
  } catch (error) {
    if (
      error.squareCode === "CONFLICT" ||
      error.squareCode === "BOOKING_CONFLICT" ||
      isSquareStaleSlotError(error)
    ) {
      const slotUnavailableError = createSlotUnavailableError();
      await attemptStore.markFailed(attempt, slotUnavailableError);
      throw slotUnavailableError;
    }
    if (error.errorCode === "SQUARE_RATE_LIMITED") {
      // A received 429 is definitive enough not to retry automatically, but
      // the durable request and Square key are safe to reuse after the caller
      // observes Square's requested delay.
      await attemptStore.releaseForRetry(attempt, leaseToken);
      throw error;
    }
    if (isDefinitiveSquareFailure(error)) {
      await attemptStore.markFailed(attempt, error);
    } else {
      await attemptStore.releaseForRetry(attempt, leaseToken);
    }
    throw error;
  }
}

const getStatus = asyncHandler(async (_request, response) => {
  response.json(await getSquareStatus());
});

async function getAdminHealthData(_request, response, {
  getSquareAdminHealthFn = getSquareAdminHealth,
} = {}) {
  response.json(await getSquareAdminHealthFn());
}

const getAdminHealth = asyncHandler(getAdminHealthData);

async function beginOAuthFlow(request, response, {
  createOAuthStateFn = createOAuthState,
  createPersistedOAuthStateFn = createPersistedOAuthState,
  buildAuthorizationUrlFn = buildAuthorizationUrl,
  getSafeAuthorizationMetadataFn = getSafeAuthorizationMetadata,
  getSquareConfigFn = getSquareConfig,
} = {}) {
  const state = createOAuthStateFn();
  const config = getSquareConfigFn();
  await createPersistedOAuthStateFn({
    state,
    ...getOAuthStateBinding(request.admin),
    environment: config.environment,
  });
  const authorizationUrl = buildAuthorizationUrlFn(state);
  console.info(
    "Square OAuth authorization request",
    getSafeAuthorizationMetadataFn(authorizationUrl),
  );
  response.setHeader(
    "Set-Cookie",
    `square_oauth_state=${encodeURIComponent(state)}; ${cookieOptions(config)}`,
  );
  response.redirect(302, authorizationUrl);
}

const beginOAuth = asyncHandler(beginOAuthFlow);

async function completeOAuthFlow(request, response, {
  verifyOAuthStateFn = verifyOAuthState,
  consumePersistedOAuthStateFn = consumePersistedOAuthState,
  exchangeCodeFn = exchangeCode,
  getSquareConfigFn = getSquareConfig,
  clearOAuthStateCookieFn = clearOAuthStateCookie,
  getClientUrlFn = () => process.env.CLIENT_URL || "http://localhost:3000",
} = {}) {
  const state =
    typeof request.query.state === "string" ? request.query.state : "";
  const expectedState = getCookie(request, "square_oauth_state");

  if (
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifyOAuthStateFn(state)
  ) {
    clearOAuthStateCookieFn(response);
    throw createOAuthStateInvalidError();
  }

  const config = getSquareConfigFn();
  const consumedState = await consumePersistedOAuthStateFn({
    state,
    ...getOAuthStateBinding(request.admin),
    environment: config.environment,
  });
  clearOAuthStateCookieFn(response, config);
  if (!consumedState) throw createOAuthStateInvalidError();

  if (request.query.error) {
    throw createHttpError(
      400,
      "Square authorization was not completed.",
      undefined,
      "SQUARE_OAUTH_DENIED",
    );
  }
  const code = typeof request.query.code === "string" ? request.query.code : "";
  if (!code)
    throw createHttpError(400, "Square authorization did not return a code.");

  await exchangeCodeFn(code);
  const clientUrl = getClientUrlFn();
  response.redirect(302, `${clientUrl}/admin?square=connected`);
}

const completeOAuth = asyncHandler(completeOAuthFlow);

const getLocations = asyncHandler(async (_request, response) => {
  const locations = await listLocations();
  response.json(
    locations.map((location) => ({
      id: location.id,
      name: location.name,
      timezone: location.timezone,
    })),
  );
});

const getCatalogServices = asyncHandler(async (_request, response) => {
  response.json(await listCatalogServices());
});

const getBookingServices = asyncHandler(async (_request, response) => {
  response.json(await listBookingCatalogServices());
});

const getMenu = asyncHandler(async (_request, response) => {
  response.json(await getPublicMenu());
});

const getTeamMembers = asyncHandler(async (_request, response) => {
  const teamMembers = await listBookableTeamMembers();
  response.json(
    teamMembers.map(({ team_member_id: id, display_name: name }) => ({
      id,
      name,
    })),
  );
});

const getAvailability = asyncHandler(async (request, response) => {
  const payload = validateAvailabilityPayload(request.body);
  response.json(
    "date" in payload
      ? await getAvailabilityData(payload)
      : await getAvailabilityRangeData(payload),
  );
});

const createBooking = asyncHandler(async (request, response) => {
  const { bookingAttemptId, variationIds, startAt, customer } =
    validateBookingPayload(request.body);
  const requestFingerprint = createRequestFingerprint({
    variationIds,
    startAt,
    customer,
    phoneNumber: normalizePhone(customer.phone),
  });
  let { attempt, created, leaseToken } = await bookingAttemptStore.createOrGet({
    bookingAttemptId,
    requestFingerprint,
  });

  if (!created) {
    if (attempt.status === "succeeded") {
      return response.status(200).json({ booking: attempt.confirmation });
    }
    if (attempt.status === "failed") {
      return throwStoredFailure(attempt);
    }
    ({ attempt, leaseToken } =
      await bookingAttemptStore.claimExpiredAttempt(attempt));
  }

  if (attempt.squareBookingRequest) {
    const confirmation = await executeStoredSquareBooking(attempt, leaseToken);
    return response.status(200).json({ booking: confirmation });
  }

  try {
    const preparedBooking = await prepareAuthoritativeBooking({
      variationIds,
      startAt,
      customer,
    }, {
      // This is deliberately an operation-boundary hook rather than a timer.
      // It can run only at the finite pre-persistence Square stages below.
      beforeSquareOperation: async () => {
        attempt = await bookingAttemptStore.renewLease(attempt, leaseToken);
      },
    });
    attempt = await bookingAttemptStore.storeSquareRequest(
      attempt,
      leaseToken,
      preparedBooking.squareBookingRequest,
      preparedBooking.confirmation,
    );

    const confirmation = await executeStoredSquareBooking(attempt, leaseToken);
    return response.status(201).json({ booking: confirmation });
  } catch (error) {
    if (
      !attempt.squareBookingRequest &&
      error.errorCode !== "BOOKING_IN_PROGRESS"
    ) {
      if (shouldReleasePrePersistenceAttempt(error)) {
        await bookingAttemptStore.releaseForRetry(attempt, leaseToken);
      } else {
        await bookingAttemptStore.markFailed(attempt, error);
      }
    }
    throw error;
  }
});

function verifyWebhook(request) {
  const signature = request.get("x-square-hmacsha256-signature") || "";
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL || "";
  const body = request.rawBody || Buffer.from("");
  if (!signature || !signatureKey || !notificationUrl || !body.length)
    return false;
  const expected = crypto
    .createHmac("sha256", signatureKey)
    .update(notificationUrl + body.toString("utf8"))
    .digest("base64");
  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

const receiveWebhook = asyncHandler(async (request, response) => {
  if (!verifyWebhook(request)) {
    throw createHttpError(
      401,
      "Invalid webhook signature",
      undefined,
      "INVALID_WEBHOOK_SIGNATURE",
    );
  }
  // Booking events are verified here. Square remains the booking system of record,
  // so no local appointment calendar is written from webhook payloads.
  response.status(200).json({ received: true });
});

module.exports = {
  beginOAuth,
  completeOAuth,
  createBooking,
  getAvailability,
  getAdminHealth,
  getBookingServices,
  getCatalogServices,
  getLocations,
  getMenu,
  getStatus,
  getTeamMembers,
  receiveWebhook,
  __testables: {
    createSquareBookingRequest,
    beginOAuthFlow,
    clearOAuthStateCookie,
    completeOAuthFlow,
    cookieOptions,
    getOAuthStateBinding,
    createAuthoritativeAvailabilityError,
    executeStoredSquareBooking,
    findCombinedAvailability,
    getAvailabilityData,
    getAdminHealthData,
    getAvailabilityRangeData,
    isSquareStaleSlotError,
    prepareAuthoritativeBooking,
    searchAvailability,
    selectAuthoritativeAvailability,
    shouldReleasePrePersistenceAttempt,
  },
  bookingRateLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 30,
  }),
};
