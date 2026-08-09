const bcrypt = require("bcryptjs");

const Admin = require("../models/Admin");

const RESET_PASSWORD_FLAG = "ADMIN_RESET_PASSWORD";

function shouldResetPassword() {
  return process.env[RESET_PASSWORD_FLAG] === "true";
}

async function migrateLegacyAdmin(rawAdmin) {
  if (!rawAdmin.password) return false;

  try {
    bcrypt.getRounds(rawAdmin.password);
  } catch {
    throw new Error(
      "Existing admin credential is not a bcrypt hash and cannot be migrated automatically.",
    );
  }

  await Admin.collection.updateOne(
    { _id: rawAdmin._id },
    {
      $set: {
        passwordHash: rawAdmin.password,
        role: "admin",
        sessionVersion: rawAdmin.sessionVersion || 0,
        singletonKey: "primary",
      },
      $unset: { password: "" },
    },
  );

  return true;
}

async function resetExistingAdminPassword(admin, password) {
  if (!password) {
    throw new Error(
      `${RESET_PASSWORD_FLAG}=true requires ADMIN_PASSWORD.`,
    );
  }

  const passwordChanged = !(await admin.comparePassword(password));

  if (!passwordChanged) {
    return;
  }

  await Admin.updateOne(
    { _id: admin._id, singletonKey: "primary" },
    {
      $set: { passwordHash: await Admin.hashPassword(password) },
      $inc: { sessionVersion: 1 },
    },
  );

  console.log("Administrator password was reset");
}

async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const adminCount = await Admin.countDocuments();

  if (adminCount > 1) {
    throw new Error("More than one administrator record exists. Refusing to start.");
  }

  if (adminCount === 1) {
    const rawAdmin = await Admin.collection.findOne({});
    await migrateLegacyAdmin(rawAdmin);

    if (shouldResetPassword()) {
      const admin = await Admin.findById(rawAdmin._id).select(
        "+passwordHash +sessionVersion",
      );
      await resetExistingAdminPassword(admin, password);
    }

    return;
  }

  if (!username || !password) {
    throw new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD are required to initialize the administrator.",
    );
  }

  const passwordHash = await Admin.hashPassword(password);
  await Admin.create({ username, passwordHash, role: "admin" });
  console.log("Initial administrator account created");
}

module.exports = bootstrapAdmin;
