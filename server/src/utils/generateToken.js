const jwt = require("jsonwebtoken");

function generateToken(admin) {
  return jwt.sign(
    {
      adminId: admin._id.toString(),
      role: admin.role,
      sessionVersion: admin.sessionVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

module.exports = generateToken;
