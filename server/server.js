require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Resend } = require('resend');   // npm install resend
const { User, OTP } = require('./models/User'); // Your Mongoose models
const OpenAI = require("openai"); // Updated import style

// ---------- Initialize ----------
const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

app.use(cors());
app.use(bodyParser.json());

// ---------- MongoDB Connection ----------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err.message));

// -------------------- SEND OTP --------------------
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

  const otp = crypto.randomInt(100000, 999999).toString();
  const expires = Date.now() + 5 * 60 * 1000; // 5 min expiry

  try {
    await OTP.findOneAndUpdate(
      { email },
      { code: otp, expires, verified: false },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'OTP sent successfully to your Gmail!' });

    resend.emails.send({
      from: 'V.V Maharashtra Board <onboarding@resend.dev>',
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`
    }).then(() => console.log(`✅ OTP email sent to ${email}`))
      .catch(err => console.error(`❌ Failed to send OTP email:`, err.message));

  } catch (err) {
    console.error(`❌ /send-otp error:`, err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// ---------- VERIFY OTP ----------
app.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ success: false, message: "Email & OTP required" });

  try {
    const record = await OTP.findOne({ email });
    if (!record) return res.status(400).json({ success: false, message: "OTP not sent" });
    if (Date.now() > record.expires) return res.status(400).json({ success: false, message: "OTP expired" });
    if (record.code !== code) return res.status(400).json({ success: false, message: "Invalid OTP" });

    record.verified = true;
    record.otpToken = crypto.randomBytes(16).toString('hex');
    await record.save();

    res.json({ success: true, message: "OTP verified successfully", otpToken: record.otpToken });
  } catch (err) {
    console.error("❌ Verify OTP error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- REGISTER ----------
app.post('/register', async (req, res) => {
  const { name, email, password, otpToken } = req.body;
  if (!name || !email || !password || !otpToken)
    return res.status(400).json({ success: false, message: "All fields required" });

  try {
    const record = await OTP.findOne({ email });
    if (!record || !record.verified || record.otpToken !== otpToken)
      return res.status(400).json({ success: false, message: "OTP verification failed" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, passwordHash });
    await newUser.save();
    await OTP.deleteOne({ email });

    res.json({ success: true, message: "Registration successful" });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- LOGIN ----------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, message: "Login successful", user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------- AI ASK ENDPOINT ----------
app.post("/ask", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ answer: "No question provided." });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: question }],
      max_tokens: 500
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer });

  } catch (err) {
    console.error("❌ AI error:", err.message);
    res.status(500).json({ answer: "Error generating answer." });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
