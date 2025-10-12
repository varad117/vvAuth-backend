const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: String,
  expires: Number,
  verified: Boolean,
  otpToken: String
});

module.exports = mongoose.model('OTP', OTPSchema);
