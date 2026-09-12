require("dotenv").config();

const mongoose = require("mongoose");
const connectToDatabase = require("../src/config/db");
const {
  assertSandboxDevelopmentSeeding,
  listLocations,
  seedSandboxDevelopmentToken,
} = require("../src/services/squareService");

async function main() {
  const accessToken = process.env.SQUARE_SANDBOX_ACCESS_TOKEN;

  assertSandboxDevelopmentSeeding();
  await connectToDatabase();
  await seedSandboxDevelopmentToken(accessToken);

  // This runs through the normal encrypted-token client path. It validates that
  // the test token can authenticate without ever printing it.
  const locations = await listLocations();
  console.info(`Sandbox connection seeded and verified with ${locations.length} active location(s).`);
}

main()
  .catch((error) => {
    console.error(error.message || "Unable to seed the Sandbox connection.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
