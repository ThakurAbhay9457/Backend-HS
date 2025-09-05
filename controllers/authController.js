const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
// const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const twilio = require('twilio');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const studentSignupSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
  hostel: z.enum([
    'block1', 'block2', 'block3', 'block4',
    'block5', 'block6', 'block7', 'block8'
  ]),
  bedType: z.enum(['4 bedded', '3 bedded', '2 bedded', '1 bedded']),
  roomNumber: z.number()
});

const adminSignupSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  adminKey: z.string()
});

// Twilio config (replace with your credentials or use env)
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const OTPs = {};
const RESET_OTPs = {};

// Email transporter (Mailtrap/Gmail/SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Google OAuth setup (replace with your credentials or use env)
// passport.use(new GoogleStrategy({
//   clientID: process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   callbackURL: '/api/auth/google/callback',
// }, async (accessToken, refreshToken, profile, done) => {
//   try {
//     let student = await Student.findOne({ 'socialLinks.google': profile.id });
//     if (!student) {
//       student = await Student.create({
//         name: profile.displayName,
//         email: profile.emails[0].value,
//         socialLinks: { google: profile.id },
//         isVerified: true
//       });
//     }
//     return done(null, student);
//   } catch (err) {
//     return done(err, null);
//   }
// }));

exports.studentSignup = async (req, res) => {
  try {
    const data = studentSignupSchema.parse(req.body);
    const existing = await Student.findOne({ email: data.email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const hashed = await bcrypt.hash(data.password, 10);
    const student = await Student.create({ ...data, password: hashed });
    res.status(201).json({ message: 'Signup successful' });
  } catch (err) {
    res.status(400).json({ message: err.errors ? err.errors : err.message });
  }
};

exports.adminSignup = async (req, res) => {
  try {
    const data = adminSignupSchema.parse(req.body);
    
    // Check admin key (you can set this in your .env file)
    const validAdminKey = process.env.ADMIN_KEY || 'your-secret-admin-key';
    if (data.adminKey !== validAdminKey) {
      return res.status(400).json({ message: 'Invalid admin key' });
    }
    
    const existing = await Admin.findOne({ username: data.username });
    if (existing) return res.status(400).json({ message: 'Username already exists' });
    
    const hashed = await bcrypt.hash(data.password, 10);
    const admin = await Admin.create({ 
      username: data.username, 
      password: hashed 
    });
    
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.errors ? err.errors : err.message });
  }
};

exports.studentSignin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const student = await Student.findOne({ email });
    if (!student) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, student.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: student._id,
        name: student.name,
        email: student.email,
        hostelName: student.hostel,
        roomNumber: student.roomNumber,
        isAdmin: false
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.adminSignin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: admin._id,
        name: admin.username,
        email: null,
        hostelName: null,
        roomNumber: null,
        isAdmin: true
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Password reset: request
exports.requestPasswordReset = async (req, res) => {
  try {
    const { identifier, role } = req.body; // identifier: email for students, username for admins
    if (!identifier || !role || !['student', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    if (role === 'student') {
      const student = await Student.findOne({ email: identifier });
      if (!student) return res.status(200).json({ message: 'If the account exists, an email was sent' });
      student.resetToken = token;
      student.resetTokenExpiresAt = expiresAt;
      await student.save();
    } else {
      const admin = await Admin.findOne({ username: identifier });
      if (!admin) return res.status(200).json({ message: 'If the account exists, an email was sent' });
      admin.resetToken = token;
      admin.resetTokenExpiresAt = expiresAt;
      await admin.save();
    }

    // In a real app, send email/SMS. For now, return token for testing.
    res.json({ message: 'Reset token generated', token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Password reset: confirm
exports.confirmPasswordReset = async (req, res) => {
  try {
    const { role, identifier, token, newPassword } = req.body;
    if (!identifier || !role || !token || !newPassword) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    if (role === 'student') {
      const student = await Student.findOne({ email: identifier, resetToken: token, resetTokenExpiresAt: { $gt: new Date() } });
      if (!student) return res.status(400).json({ message: 'Invalid or expired token' });
      student.password = await bcrypt.hash(newPassword, 10);
      student.resetToken = undefined;
      student.resetTokenExpiresAt = undefined;
      await student.save();
    } else {
      const admin = await Admin.findOne({ username: identifier, resetToken: token, resetTokenExpiresAt: { $gt: new Date() } });
      if (!admin) return res.status(400).json({ message: 'Invalid or expired token' });
      admin.password = await bcrypt.hash(newPassword, 10);
      admin.resetToken = undefined;
      admin.resetTokenExpiresAt = undefined;
      await admin.save();
    }

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Password reset via OTP (students by phone)
exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });
    const student = await Student.findOne({ email });
    if (!student) return res.status(200).json({ message: 'If the account exists, an OTP was sent' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 1000 * 60 * 10; // 10 minutes
    RESET_OTPs[email] = { otp, expiresAt };
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await transporter.sendMail({
          from: process.env.MAIL_FROM || 'no-reply@example.com',
          to: email,
          subject: 'Your password reset OTP',
          text: `Your OTP is ${otp}. It expires in 10 minutes.`,
        });
      }
    } catch (mailErr) {
      console.error('Mail send error:', mailErr.message);
    }
    // Return OTP as well for dev/testing visibility
    res.json({ message: 'OTP generated and emailed (if configured)', otp });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.confirmPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Invalid request' });
    const record = RESET_OTPs[email];
    if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    const student = await Student.findOne({ email });
    if (!student) return res.status(400).json({ message: 'Account not found' });
    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();
    delete RESET_OTPs[email];
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// exports.googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });
// exports.googleCallback = [
//   passport.authenticate('google', { session: false, failureRedirect: '/' }),
//   (req, res) => {
//     const token = jwt.sign({ id: req.user._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '7d' });
//     res.redirect(`/auth-success?token=${token}`); // Or send token as JSON
//   }
// ];

exports.phoneSignup = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone required' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    OTPs[phone] = otp;
    await twilioClient.messages.create({
      body: `Your OTP is ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    res.json({ message: 'OTP sent' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (OTPs[phone] !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    let student = await Student.findOne({ phone });
    if (!student) {
      student = await Student.create({ phone, isVerified: true });
    } else {
      student.isVerified = true;
      await student.save();
    }
    delete OTPs[phone];
    const token = jwt.sign({ id: student._id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}; 