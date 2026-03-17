const router = require('express').Router();
const { 
  getReports, getGPSPath, createAlert, getAlerts, 
  resolveAlert, getDashboard, getEngineers 
} = require('../controllers/adminController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

// All admin routes require admin role
router.use(auth, rbac('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', getDashboard);

// GET /api/admin/reports
router.get('/reports', getReports);

// GET /api/admin/gps-path/:projectId
router.get('/gps-path/:projectId', getGPSPath);

// POST /api/admin/alerts
router.post('/alerts', createAlert);

// GET /api/admin/alerts
router.get('/alerts', getAlerts);

// PUT /api/admin/alerts/:id/resolve
router.put('/alerts/:id/resolve', resolveAlert);

// GET /api/admin/engineers
router.get('/engineers', getEngineers);

module.exports = router;
