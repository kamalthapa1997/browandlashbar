const express = require("express");
const { getReviews } = require("../controllers/reviewsController");

const router = express.Router();

router.get("/", getReviews);

module.exports = router;
