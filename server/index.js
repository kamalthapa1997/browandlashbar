require("dotenv").config();

const app = require("./src/app");
const connectToDatabase = require("./src/config/db");
const bootstrapAdmin = require("./src/bootstrap/bootstrapAdmin");

const port = process.env.PORT || 5001;

async function startServer() {
  await connectToDatabase();
  await bootstrapAdmin();

  const server = app.listen(port);

  server.on("listening", () => {
    console.log(`Server listening on port ${port}`);
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
