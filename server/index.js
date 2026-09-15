require("dotenv").config();

const connectToDatabase = require("./src/config/db");
const bootstrapAdmin = require("./src/bootstrap/bootstrapAdmin");
const { syncLegacyGalleryCategories } = require("./src/services/galleryCategoryService");
const { validateEnvironment } = require("./src/config/environment");
const {
  startSquareTokenLifecycle,
  stopSquareTokenLifecycle,
} = require("./src/services/squareTokenLifecycleService");
const { getListenHost } = require("./src/config/serverBinding");

const port = process.env.PORT || 5001;
const host = getListenHost();

async function startServer() {
  try {
    validateEnvironment();
  } catch (error) {
    console.error(`Configuration Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const app = require("./src/app");
  await connectToDatabase();
  await syncLegacyGalleryCategories();
  await bootstrapAdmin();

  const server = app.listen(port, host);
  startSquareTokenLifecycle();

  server.on("close", stopSquareTokenLifecycle);

  server.on("listening", () => {
    console.log(`Server listening on ${host || "default interface"}:${port}`);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Please free the port or set a different PORT in your .env.`,
      );
      process.exit(1);
    }

    console.error("Server Error: Unable to start the server.");
    process.exit(1);
  });
}

startServer().catch(() => {
  console.error("Server Error: Unable to start the application.");
  process.exit(1);
});
