const router = require('express').Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');

// Registration
router.post('/register', authController.registerValidation, validate, authController.register);

// Login
router.post('/login', authController.loginValidation, validate, authController.login);

// User Profile
router.get('/me', auth, authController.getMe);

module.exports = router;
