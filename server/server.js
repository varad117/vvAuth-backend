// ===== Imports =====
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' }); // Load .env once

// ===== App Setup =====
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

// ===== Debug: Check if .env is working =====
console.log("MONGO_URI from env:", process.env.MONGO_URI);
console.log("EMAIL_USER from env:", process.env.EMAIL_USER);
console.log("EMAIL_PASS loaded:", !!process.env.EMAIL_PASS);

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

// ===== Load User Model =====
const User = require('./models/User');

// ===== In-Memory OTP Store =====
const otpStore = {}; // { email: { code, expires, verified, otpToken } }

// ===== Send OTP =====
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ success: false, message: 'Email is required.' });

  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = Date.now() + 5 * 60 * 1000;

  otpStore[email] = { code: otp, expires };

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `V.V Maharashtra Board <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP is ${otp}. It expires in 5 minutes.`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'OTP sent to Gmail.' });
  } catch (err) {
    console.error("❌ Nodemailer error:", err.message);
    if (err.response) console.error("SMTP response:", err.response);
    res.json({ success: false, message: 'Failed to send OTP.' });
  }
});

// ===== Verify OTP =====
app.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const record = otpStore[email];

  if (!email || !code) return res.json({ success: false, message: 'Email and OTP code are required.' });
  if (!record) return res.json({ success: false, message: 'No OTP sent.' });
  if (Date.now() > record.expires) return res.json({ success: false, message: 'OTP expired.' });
  if (record.code !== code) return res.json({ success: false, message: 'Invalid OTP.' });

  const otpToken = crypto.randomBytes(16).toString('hex');
  otpStore[email].verified = true;
  otpStore[email].otpToken = otpToken;

  res.json({ success: true, message: 'OTP verified.', otpToken });
});

// ===== Register User =====
app.post('/register', async (req, res) => {
  const { name, email, password, otpToken } = req.body;
  const record = otpStore[email];

  if (!name || !email || !password || !otpToken) {
    return res.json({ success: false, message: 'All fields are required.' });
  }

  if (!record || !record.verified || record.otpToken !== otpToken) {
    return res.json({ success: false, message: 'OTP verification failed.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: 'User already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, passwordHash });
    await newUser.save();

    delete otpStore[email];

    res.json({ success: true, message: 'Registration successful.' });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ===== Login User =====
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log("🔐 Login attempt:", email);

  if (!email || !password) {
    return res.json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.warn("⚠️ User not found:", email);
      return res.json({ success: false, message: 'User not found.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      console.warn("⚠️ Incorrect password for:", email);
      return res.json({ success: false, message: 'Incorrect password.' });
    }

    res.json({
      success: true,
      message: 'Login successful.',
      user: { name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ===== Start Server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

async function handleLogin() {
  setLoading(true); // disable button

  try {
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });

    const data = await response.json();
    setLoading(false); // re-enable button

    if (data.success) {
      alert("✅ Login successful!");
      // Redirect to dashboard or save user info
      console.log("Logged in user:", data.user);
    } else {
      alert(data.message); // shows "User not found" or "Incorrect password"
    }
  } catch (err) {
    setLoading(false);
    console.error("Login request failed:", err);
    alert("Server error during login."); // only shows once
  }
}


function handleModalClose() {
  setShowErrorModal(false); // ✅ prevents looping
}

app.get('/', (req, res) => {
  res.send('vvAuth backend is live and secure 🔐🚀');
});