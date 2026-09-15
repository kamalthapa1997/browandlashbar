const assert = require("node:assert/strict");
const test = require("node:test");

const {
  __testables: {
    getAvailabilityData,
    getAvailabilityRangeData,
    searchAvailability,
  },
} = require("../controllers/squareController");
const { validateAvailabilityPayload } = require("../utils/validators");
const { getBookingWindow } = require("../utils/bookingWindow");

function variation(id, teamMemberIds = []) {
  return {
    id,
    version: 7,
    item_variation_data: {
      available_for_booking: true,
      team_member_ids: teamMemberIds,
      service_duration: 30 * 60 * 1000,
      price_money: { amount: 2500, currency: "USD" },
    },
  };
}

const profiles = [
  { team_member_id: "team-a", display_name: "Avery", is_bookable: true },
  { team_member_id: "team-b", display_name: "Blair", is_bookable: true },
  { team_member_id: "team-c", display_name: "Casey", is_bookable: true },
];

const location = { id: "location-1", name: "Main location" };

test("availability validation requires a non-empty unique variationIds array", () => {
  const { today, maximumDate } = getBookingWindow();
  assert.throws(
    () => validateAvailabilityPayload({ variationIds: [], date: today }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateAvailabilityPayload({ variationIds: ["a", "a"], date: today }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateAvailabilityPayload({ variationIds: [42], date: today }),
    { statusCode: 400 },
  );
  assert.throws(
    () => validateAvailabilityPayload({ variationIds: ["a".repeat(256)], date: today }),
    { statusCode: 400 },
  );
  assert.deepEqual(
    validateAvailabilityPayload({ variationIds: ["variation-b", "variation-a"], date: today }),
    { variationIds: ["variation-a", "variation-b"], date: today },
  );
  assert.deepEqual(
    validateAvailabilityPayload({
      variationIds: ["variation-b", "variation-a"],
      startDate: today,
      endDate: maximumDate,
    }),
    {
      variationIds: ["variation-a", "variation-b"],
      startDate: today,
      endDate: maximumDate,
    },
  );
  assert.throws(
    () => validateAvailabilityPayload({
      variationIds: ["a"],
      startDate: today,
      endDate: "2099-01-01",
    }),
    { statusCode: 400 },
  );
});

test("makes one Square availability call with one segment filter per selected variation", async () => {
  const calls = [];
  const response = { availabilities: [{ start_at: "2026-09-14T13:00:00Z" }] };
  const selections = [
    { variation: variation("variation-a", ["team-a"]), profiles: [profiles[0]] },
    { variation: variation("variation-b", ["team-b"]), profiles: [profiles[1]] },
    { variation: variation("variation-c"), profiles },
  ];

  const availability = await searchAvailability({
    date: "2026-09-14",
    location,
    selections,
    fetchSquare: async (path, options) => {
      calls.push({ path, options });
      return response;
    },
  });

  assert.deepEqual(availability, response.availabilities);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "/bookings/availability/search");
  assert.equal(calls[0].options.method, "POST");
  const filter = calls[0].options.body.query.filter;
  assert.equal(filter.location_id, "location-1");
  assert.match(filter.start_at_range.start_at, /^2026-09-14T/);
  assert.deepEqual(filter.segment_filters, [
    { service_variation_id: "variation-a", team_member_id_filter: { any: ["team-a"] } },
    { service_variation_id: "variation-b", team_member_id_filter: { any: ["team-b"] } },
    { service_variation_id: "variation-c", team_member_id_filter: { any: ["team-a", "team-b", "team-c"] } },
  ]);
  assert.equal(JSON.stringify(filter).includes("service_duration"), false);
  assert.equal(JSON.stringify(filter).includes("price_money"), false);
});

test("uses the same combined flow for a single service", async () => {
  const calls = [];
  await searchAvailability({
    date: "2026-09-14",
    location,
    selections: [{ variation: variation("variation-a"), profiles }],
    fetchSquare: async (_path, options) => {
      calls.push(options);
      return { availabilities: [] };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.query.filter.segment_filters.length, 1);
  assert.equal(
    calls[0].body.query.filter.segment_filters[0].service_variation_id,
    "variation-a",
  );
});

test("resolves every variation before one combined availability search and permits different providers", async () => {
  const resolved = new Map([
    ["variation-a", { variation: variation("variation-a", ["team-a"]) }],
    ["variation-b", { variation: variation("variation-b", ["team-b"]) }],
    ["variation-c", { variation: variation("variation-c") }],
  ]);
  const resolvedIds = [];
  let searchCalls = 0;
  let capturedSearch;

  const result = await getAvailabilityData(
    { variationIds: ["variation-a", "variation-b", "variation-c"], date: "2026-09-14" },
    {
      resolveBookableVariation: async (id) => {
        resolvedIds.push(id);
        return resolved.get(id);
      },
      resolveLocation: async () => location,
      listBookableTeamMembers: async () => profiles,
      searchAvailability: async (input) => {
        searchCalls += 1;
        capturedSearch = input;
        return [{
          start_at: "2026-09-14T13:00:00Z",
          appointment_segments: [
            { team_member_id: "team-a" },
            { team_member_id: "team-b" },
            { team_member_id: "team-c" },
          ],
        }];
      },
    },
  );

  assert.deepEqual(resolvedIds.sort(), ["variation-a", "variation-b", "variation-c"]);
  assert.equal(searchCalls, 1);
  assert.deepEqual(
    capturedSearch.selections.map((selection) => selection.profiles.map((profile) => profile.team_member_id)),
    [["team-a"], ["team-b"], ["team-a", "team-b", "team-c"]],
  );
  assert.deepEqual(result.availability, [{ startAt: "2026-09-14T13:00:00Z", teamMemberName: "Avery" }]);
  assert.equal(JSON.stringify(result.availability).includes("appointment_segments"), false);
});

test("does not search partial availability when any variation cannot be resolved", async () => {
  let profileCalls = 0;
  let searchCalls = 0;

  await assert.rejects(
    getAvailabilityData(
      { variationIds: ["variation-a", "variation-missing"], date: "2026-09-14" },
      {
        resolveBookableVariation: async (id) => {
          if (id === "variation-missing") {
            const error = new Error("This service is not available for online booking.");
            error.statusCode = 422;
            error.errorCode = "SERVICE_NOT_BOOKABLE";
            throw error;
          }
          return { variation: variation(id) };
        },
        resolveLocation: async () => location,
        listBookableTeamMembers: async () => {
          profileCalls += 1;
          return profiles;
        },
        searchAvailability: async () => {
          searchCalls += 1;
          return [];
        },
      },
    ),
    { errorCode: "SERVICE_NOT_BOOKABLE" },
  );

  assert.equal(profileCalls, 0);
  assert.equal(searchCalls, 0);
});

test("returns no availability when Square has no valid combined appointment", async () => {
  const result = await getAvailabilityData(
    { variationIds: ["variation-a", "variation-b"], date: "2026-09-14" },
    {
      resolveBookableVariation: async (id) => ({ variation: variation(id) }),
      resolveLocation: async () => location,
      listBookableTeamMembers: async () => profiles,
      searchAvailability: async () => [],
    },
  );

  assert.deepEqual(result.availability, []);
});

test("groups one Square range search into Eastern calendar dates, including empty days", async () => {
  const calls = [];
  const result = await getAvailabilityRangeData(
    {
      variationIds: ["variation-a"],
      startDate: "2026-09-14",
      endDate: "2026-09-16",
    },
    {
      resolveBookableVariation: async (id) => ({ variation: variation(id) }),
      resolveLocation: async () => location,
      listBookableTeamMembers: async () => profiles,
      searchAvailability: async (input) => {
        calls.push(input);
        return [
          {
            start_at: "2026-09-15T01:00:00Z",
            appointment_segments: [{ team_member_id: "team-a" }],
          },
          {
            start_at: "2026-09-16T14:00:00Z",
            appointment_segments: [{ team_member_id: "team-b" }],
          },
        ];
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].startDate, "2026-09-14");
  assert.equal(calls[0].endDate, "2026-09-16");
  assert.deepEqual(result.availabilityByDate["2026-09-14"], [
    { startAt: "2026-09-15T01:00:00Z", teamMemberName: "Avery" },
  ]);
  assert.deepEqual(result.availabilityByDate["2026-09-15"], []);
  assert.deepEqual(result.availabilityByDate["2026-09-16"], [
    { startAt: "2026-09-16T14:00:00Z", teamMemberName: "Blair" },
  ]);
});

test("returns same-staff and different-staff Square responses as safe availability choices", async () => {
  const result = await getAvailabilityData(
    { variationIds: ["variation-a", "variation-b"], date: "2026-09-14" },
    {
      resolveBookableVariation: async (id) => ({ variation: variation(id) }),
      resolveLocation: async () => location,
      listBookableTeamMembers: async () => profiles,
      searchAvailability: async () => [
        {
          start_at: "2026-09-14T13:00:00Z",
          appointment_segments: [{ team_member_id: "team-a" }, { team_member_id: "team-a" }],
        },
        {
          start_at: "2026-09-14T14:00:00Z",
          appointment_segments: [{ team_member_id: "team-b" }, { team_member_id: "team-c" }],
        },
      ],
    },
  );

  assert.deepEqual(result.availability, [
    { startAt: "2026-09-14T13:00:00Z", teamMemberName: "Avery" },
    { startAt: "2026-09-14T14:00:00Z", teamMemberName: "Blair" },
  ]);
});

test("does not search availability when a selected service has no eligible provider", async () => {
  let searchCalls = 0;

  await assert.rejects(
    getAvailabilityData(
      { variationIds: ["variation-a", "variation-b"], date: "2026-09-14" },
      {
        resolveBookableVariation: async (id) => ({
          variation: variation(id, id === "variation-b" ? ["team-missing"] : []),
        }),
        resolveLocation: async () => location,
        listBookableTeamMembers: async () => profiles,
        searchAvailability: async () => {
          searchCalls += 1;
          return [];
        },
      },
    ),
    { errorCode: "NO_ELIGIBLE_TEAM_MEMBERS" },
  );

  assert.equal(searchCalls, 0);
});
