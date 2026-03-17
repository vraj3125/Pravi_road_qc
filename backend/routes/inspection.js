const router = require('express').Router();
const { startInspection, uploadImage, submitInspection, completeSegment } = require('../controllers/inspectionController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const upload = require('../middleware/upload');

// POST /api/inspection/start
router.post('/start', auth, rbac('engineer'), startInspection);

// POST /api/inspection/upload — single image upload
router.post('/upload', auth, rbac('engineer'), upload.single('image'), uploadImage);

// POST /api/inspection/submit
router.post('/submit', auth, rbac('engineer'), submitInspection);

// PUT /api/inspection/segment/:id/complete
router.put('/segment/:id/complete', auth, rbac('engineer'), completeSegment);

module.exports = router;
