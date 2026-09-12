const express = require("express");
const cors = require("cors");

const adminRoutes = require("./routes/adminRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const reviewsRoutes = require("./routes/reviewsRoutes");
const faqRoutes = require("./routes/faqRoutes");
const squareRoutes = require("./routes/squareRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

function configureTrustProxy(application, environment = process.env.NODE_ENV) {
  // Production traffic reaches Node only through the local Nginx reverse proxy.
  // Trusting loopback preserves the nearest client address added by Nginx while
  // leaving direct development requests and arbitrary proxy chains untrusted.
  if (environment === "production") application.set("trust proxy", "loopback");
}

const app = express();

configureTrustProxy(app);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(
  express.json({
    verify: (request, _response, buffer) => {
      if (request.originalUrl === "/api/square/webhooks") request.rawBody = buffer;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/api/admin", adminRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/square", squareRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
module.exports.configureTrustProxy = configureTrustProxy;
