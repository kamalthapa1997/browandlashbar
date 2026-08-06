const Admin = require("../models/Admin");
const asyncHandler = require("../utils/asyncHandler");
const generateToken = require("../utils/generateToken");
const { validateLoginPayload } = require("../utils/validators");

const loginAdmin = asyncHandler(async (request, response) => {
  const { username, password } = validateLoginPayload(request.body);

  const admin = await Admin.findOne({ username });
  if (!admin || !(await admin.comparePassword(password))) {
    throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
  }

  response.json({
    token: generateToken(admin._id),
    admin: {
      id: admin._id,
      username: admin.username,
    },
  });
});

module.exports = { loginAdmin };
