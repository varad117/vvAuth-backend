const mongoose = require("mongoose");

// User Schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String
});

const User = mongoose.model("User", userSchema);

// OTP Schema
const otpSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  code: String,
  expires: Date,
  verified: Boolean,
  otpToken: String
});

const OTP = mongoose.model("OTP", otpSchema);

module.exports = { User, OTP };
