const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 12;

const adminSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "primary",
      immutable: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
      required: true,
    },
    sessionVersion: {
      type: Number,
      default: 0,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

adminSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

adminSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

module.exports = mongoose.model("Admin", adminSchema);
