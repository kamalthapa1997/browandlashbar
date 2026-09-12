require("dotenv").config();

const mongoose = require("mongoose");
const connectToDatabase = require("../src/config/db");
const Service = require("../src/models/Service");
const {
  SANDBOX_TEST_SERVICE,
  assertSandboxDevelopmentEnvironment,
  ensureSandboxTestCatalogService,
  listBookableTeamMembers,
} = require("../src/services/squareService");

async function main() {
  assertSandboxDevelopmentEnvironment();
  await connectToDatabase();

  const { location, item, variation, created } =
    await ensureSandboxTestCatalogService();
  const localService = await Service.findOneAndUpdate(
    { name: SANDBOX_TEST_SERVICE.name },
    {
      $set: {
        name: SANDBOX_TEST_SERVICE.name,
        price: SANDBOX_TEST_SERVICE.priceMoney.amount / 100,
        category: "Threading",
        square: {
          catalogItemId: item.id,
          variationId: variation.id,
          variationVersion: variation.version,
          teamMemberIds: [],
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const teamMembers = await listBookableTeamMembers();

  console.info(
    JSON.stringify({
      created: created ? "created" : "reused",
      catalogItemId: item.id,
      variationId: variation.id,
      variationVersion: variation.version,
      priceMoney: variation.priceMoney,
      durationMs: variation.durationMs,
      locationId: location.id,
      localServiceId: String(localService._id),
      bookableTeamMemberCount: teamMembers.length,
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        message: error.message || "Unable to create the Sandbox test service.",
        ...(error.statusCode && { status: error.statusCode }),
        ...(error.errorCode && { code: error.errorCode }),
        ...(error.details && { details: error.details }),
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
