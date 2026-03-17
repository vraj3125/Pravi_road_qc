const router = require('express').Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// Registration
router.post('/register', authController.registerValidation, validate, authController.register);
router.post('/verify-register', authController.verifyOtpValidation, validate, authController.verifyRegister);

// Login (MFA)
router.post('/login', authController.loginValidation, validate, authController.login);
router.post('/verify-login', authController.verifyOtpValidation, validate, authController.verifyLogin);

// Forgot Password
router.post('/forgot-password', authController.forgotPasswordValidation, validate, authController.forgotPassword);
router.post('/reset-password', authController.resetPasswordValidation, validate, authController.resetPassword);

// User Profile
router.get('/me', auth, authController.getMe);

module.exports = router;
