const express = require("express");
const cors = require("cors");

const adminRoutes = require("./routes/adminRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const reviewsRoutes = require("./routes/reviewsRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.use("/api/admin", adminRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reviews", reviewsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
