const router = require('express').Router();
const { 
  createProject, getProjects, getProject, 
  updateProject, assignEngineer, createProjectValidation 
} = require('../controllers/projectController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');

// GET /api/projects — all users (filtered by role)
router.get('/', auth, getProjects);

// GET /api/projects/:id
router.get('/:id', auth, getProject);

// POST /api/projects — admin only
router.post('/', auth, rbac('admin'), createProjectValidation, validate, createProject);

// PUT /api/projects/:id — admin only
router.put('/:id', auth, rbac('admin'), updateProject);

// PUT /api/projects/:id/assign — admin only
router.put('/:id/assign', auth, rbac('admin'), assignEngineer);

module.exports = router;
