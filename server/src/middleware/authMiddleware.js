const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");
const asyncHandler = require("../utils/asyncHandler");
const createHttpError = require("../utils/httpError");

const protect = asyncHandler(async (request, response, next) => {
  const authorization = request.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    throw createHttpError(401, "Authorization token is required");
  }

  const token = authorization.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw createHttpError(401, "Authorization token has expired");
    }

    throw createHttpError(401, "Authorization token is invalid");
  }

  const admin = await Admin.findById(decoded.adminId).select("-password");

  if (!admin) {
    throw createHttpError(401, "Admin not found");
  }

  request.admin = admin;
  next();
});

module.exports = { protect };
