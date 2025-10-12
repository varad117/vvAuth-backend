// server/models/OTP.js
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  expires: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  otpToken: { type: String }
}, { timestamps: true });

module.exports = mongoose.models.OTP || mongoose.model('OTP', otpSchema);
