require("dotenv").config();

const {
  SANDBOX_TEST_SERVICE,
  assertSandboxDevelopmentEnvironment,
  ensureSandboxTestCatalogService,
  listBookableTeamMembers,
} = require("../src/services/squareService");

async function main() {
  assertSandboxDevelopmentEnvironment();

  const { location, item, variation, created } =
    await ensureSandboxTestCatalogService();
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
  });
