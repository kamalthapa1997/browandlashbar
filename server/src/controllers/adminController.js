const Admin = require("../models/Admin");
const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");
const createHttpError = require("../utils/httpError");
const { validateLoginPayload } = require("../utils/validators");

const sessionCookieName = "admin_session";
const sessionMaxAge = Number(process.env.SESSION_COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: sessionMaxAge,
    path: "/",
  };
}

function clearSessionCookie(response) {
  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

const loginAdmin = asyncHandler(async (request, response) => {
  const { username, password } = validateLoginPayload(request.body);
  const admin = await Admin.findOne({ username }).select(
    "+passwordHash +sessionVersion",
  );

  if (!admin || !(await admin.comparePassword(password))) {
    throw createHttpError(401, "Invalid credentials.");
  }

  response.cookie(sessionCookieName, generateToken(admin), sessionCookieOptions());
  response.json({
    admin: {
      id: admin._id,
      username: admin.username,
      role: admin.role,
    },
  });
});

const getSession = asyncHandler(async (request, response) => {
  response.json({
    admin: {
      id: request.admin._id,
      username: request.admin.username,
      role: request.admin.role,
    },
  });
});

const logoutAdmin = asyncHandler(async (request, response) => {
  await Admin.updateOne(
    { _id: request.admin._id },
    { $inc: { sessionVersion: 1 } },
  );
  clearSessionCookie(response);
  response.status(204).end();
});

module.exports = { getSession, loginAdmin, logoutAdmin };
