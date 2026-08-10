const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");
const asyncHandler = require("../utils/asyncHandler");
const createHttpError = require("../utils/httpError");

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

async function authenticateRequest(request) {
  const token = getCookie(request, "admin_session");

  if (!token) {
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }

  const admin = await Admin.findById(decoded.adminId).select(
    "+sessionVersion role username",
  );

  if (
    !admin ||
    admin.role !== "admin" ||
    decoded.role !== "admin" ||
    admin.sessionVersion !== decoded.sessionVersion
  ) {
    return null;
  }

  return admin;
}

const optionalAuth = asyncHandler(async (request, _response, next) => {
  request.admin = await authenticateRequest(request);
  next();
});

const requireAuth = asyncHandler(async (request, _response, next) => {
  const admin = await authenticateRequest(request);

  if (!admin) {
    throw createHttpError(401, "Authentication is required");
  }

  request.admin = admin;
  next();
});

function requireAdmin(request, _response, next) {
  if (request.admin?.role !== "admin") {
    next(createHttpError(403, "Administrator access is required"));
    return;
  }

  next();
}

module.exports = { optionalAuth, requireAuth, requireAdmin };
