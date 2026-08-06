require("dotenv").config();

const app = require("./src/app");
const connectToDatabase = require("./src/config/db");
const bootstrapAdmin = require("./src/bootstrap/bootstrapAdmin");

const port = process.env.PORT || 5001;

async function startServer() {
  await connectToDatabase();
  await bootstrapAdmin();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
