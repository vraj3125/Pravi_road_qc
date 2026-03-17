const router = require('express').Router();
const { logGPS, getGPSPath } = require('../controllers/gpsController');
const auth = require('../middleware/auth');

// POST /api/gps/log
router.post('/log', auth, logGPS);

// GET /api/gps/path/:sessionId
router.get('/path/:sessionId', auth, getGPSPath);

module.exports = router;
