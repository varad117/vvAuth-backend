const mongoose = require('mongoose'); // ✅ only once

// -------------------- User Schema --------------------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  premium: { type: Boolean, default: false } // optional
}, { timestamps: true });

// -------------------- OTP Schema --------------------
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  verified: { type: Boolean, default: false },
  otpToken: { type: String },
  createdAt: { type: Date, default: Date.now, expires: 300 } // auto-expire 5 min
});

// -------------------- Models --------------------
const User = mongoose.model('User', userSchema);
const OTP = mongoose.model('OTP', otpSchema);

module.exports = { User, OTP };
