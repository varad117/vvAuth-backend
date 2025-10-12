// -------------------- Load Environment Variables --------------------
require('dotenv').config({ path: __dirname + '/../.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Resend } = require('resend');

const User = require('./module/user'); // server/module/user.js
const OTP = require('./module/otp');   // server/module/otp.js


const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// -------------------- Middleware --------------------
app.use(cors());
app.use(helmet());
app.use(bodyParser.json());

// -------------------- MongoDB Connection --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err.message));

// -------------------- OTP Sending --------------------
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

  try {
    await OTP.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false },
      { upsert: true, new: true }
    );

    // Respond immediately to the user
    res.json({ success: true, message: 'OTP is being sent. Please check your email.' });

    // Send email in the background
    const response = await resend.emails.send({
      from: 'V.V Maharashtra Board <onboarding@resend.dev>',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is ${otp}. It expires in 5 minutes.`
    });

    if (response.error) {
      console.error(`❌ Resend API error for ${email}:`, response.error);
    } else {
      console.log(`✅ OTP email sent to ${email}`);
    }

  } catch (err) {
    console.error(`❌ Failed to process /send-otp for ${email}:`, err.message);
  }
});

// -------------------- OTP Verification --------------------
app.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code)
    return res.status(400).json({ success: false, message: 'Email and OTP are required.' });

  try {
    const record = await OTP.findOne({ email });
    if (!record) return res.status(400).json({ success: false, message: 'No OTP sent.' });
    if (Date.now() > record.expires) return res.status(400).json({ success: false, message: 'OTP expired.' });
    if (record.code !== code) return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    record.verified = true;
    record.otpToken = crypto.randomBytes(16).toString('hex');
    await record.save();

    res.json({ success: true, message: 'OTP verified.', otpToken: record.otpToken });
  } catch (err) {
    console.error(`❌ OTP verification error for ${email}:`, err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// -------------------- Registration --------------------
app.post('/register', async (req, res) => {
  const { name, email, password, otpToken } = req.body;
  if (!name || !email || !password || !otpToken)
    return res.status(400).json({ success: false, message: 'All fields are required.' });

  try {
    const record = await OTP.findOne({ email });
    if (!record || !record.verified || record.otpToken !== otpToken)
      return res.status(400).json({ success: false, message: 'OTP verification failed.' });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, message: 'User already exists.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, passwordHash });
    await newUser.save();
    await OTP.deleteOne({ email });

    console.log(`📝 User registered: ${email}`);
    res.json({ success: true, message: 'Registration successful.' });
  } catch (err) {
    console.error(`❌ Register route error for ${email}:`, err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// -------------------- Login --------------------
app.post('/login', async (req, res) => {
  const email = req.body.email?.trim();
  const password = req.body.password?.trim();

  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password are required.' });

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: 'User not found.' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(400).json({ success: false, message: 'Incorrect password.' });

    res.json({
      success: true,
      message: 'Login successful.',
      user: { name: user.name, email: user.email }
    });
  } catch (err) {
    console.error(`❌ Login route error for ${email}:`, err.message);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
      error: err.message || 'Unknown error'
    });
  }
});

// -------------------- Health Check --------------------
app.get('/', (req, res) => {
  res.send('✅ vvAuth backend is live and secure.');
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// -------------------- Start Server --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
