const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Generate 4-digit OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// --- VALIDATORS ---

exports.registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

exports.verifyOtpValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
];

exports.loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

exports.forgotPasswordValidation = [
  body('email').isEmail().withMessage('Valid email is required')
];

exports.resetPasswordValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
];

// --- CONTROLLERS ---

// @desc    Register user & send OTP
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    let user = await User.findOne({ email });
    if (user && user.is_verified) {
      return res.status(400).json({ error: 'User already exists and is verified. Please log in.' });
    }

    const otp = generateOTP();
    const otp_expiry = new Date(Date.now() + 10 * 60 * 1000); 

    if (user && !user.is_verified) {
      // Update unverified user
      user.name = name;
      user.password = password;
      user.otp = otp;
      user.otp_expiry = otp_expiry;
      await user.save();
    } else {
      // Create new unverified user
      user = await User.create({ 
        name, email, password, role: role || 'engineer', otp, otp_expiry
      });
    }

    // Send actual email OTP
    try {
      await sendEmail({
        email: user.email,
        subject: 'Road Inspector - Verification OTP',
        message: `Your registration Verification Code (OTP) is: ${otp}\n\nIt expires in 10 minutes.`,
      });
      console.log(`\n\n[EMAIL DELIVERED] => OTP for ${email} sent successfully.\n\n`);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Email could not be sent. Check backend server console or SMTP config.' });
    }

    res.json({ success: true, message: 'OTP sent to email successfully for registration' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Verify OTP for Registration
// @route   POST /api/auth/verify-register
exports.verifyRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.is_verified) return res.status(400).json({ error: 'User is already verified' });
    
    if (user.otp !== otp) return res.status(401).json({ error: 'Invalid OTP' });
    if (new Date() > user.otp_expiry) return res.status(401).json({ error: 'OTP has expired' });

    user.is_verified = true;
    user.otp = undefined;
    user.otp_expiry = undefined;
    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id, name: user.name, email: user.email, role: user.role, token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Login (Password check) & send OTP
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_verified) return res.status(401).json({ error: 'Please verify your account first. Register again to resend OTP.' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    const otp = generateOTP();
    user.otp = otp;
    user.otp_expiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send actual email OTP
    try {
      await sendEmail({
        email: user.email,
        subject: 'Road Inspector - Login MFA OTP',
        message: `Your login Two-Factor Authentication Code is: ${otp}\n\nIt expires in 10 minutes.`,
      });
      console.log(`\n\n[EMAIL DELIVERED] => MFA OTP for ${email} sent successfully.\n\n`);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Email could not be sent. Check backend server console or SMTP config.' });
    }

    res.json({ success: true, message: 'Password verified. OTP sent to email for MFA.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Verify OTP for Login
// @route   POST /api/auth/verify-login
exports.verifyLogin = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.is_verified) return res.status(401).json({ error: 'Account not verified' });

    if (user.otp !== otp) return res.status(401).json({ error: 'Invalid OTP' });
    if (new Date() > user.otp_expiry) return res.status(401).json({ error: 'OTP has expired' });

    user.otp = undefined;
    user.otp_expiry = undefined;
    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id, name: user.name, email: user.email, role: user.role, token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Forgot Password (Send OTP)
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = generateOTP();
    user.otp = otp;
    user.otp_expiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send actual email OTP
    try {
      await sendEmail({
        email: user.email,
        subject: 'Road Inspector - Password Reset',
        message: `You requested a password reset. Your OTP is: ${otp}\n\nIt expires in 10 minutes.`,
      });
      console.log(`\n\n[EMAIL DELIVERED] => Password Reset OTP for ${email} sent successfully.\n\n`);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Email could not be sent. Check backend server console or SMTP config.' });
    }

    res.json({ success: true, message: 'OTP sent to email for password reset' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Reset Password using OTP
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.otp !== otp) return res.status(401).json({ error: 'Invalid OTP' });
    if (new Date() > user.otp_expiry) return res.status(401).json({ error: 'OTP has expired' });

    user.password = newPassword;
    user.otp = undefined;
    user.otp_expiry = undefined;
    await user.save(); // Password will be hashed by pre-save middleware

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
