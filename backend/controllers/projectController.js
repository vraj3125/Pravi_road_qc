const { body } = require('express-validator');
const Project = require('../models/Project');
const Segment = require('../models/Segment');

// Validation rules
exports.createProjectValidation = [
  body('road_name').trim().notEmpty().withMessage('Road name is required'),
  body('total_segments').isInt({ min: 1 }).withMessage('Total segments must be at least 1'),
  body('location.coordinates').isArray().withMessage('Location coordinates are required')
];

// @desc    Create a new road project (Admin only)
// @route   POST /api/projects
exports.createProject = async (req, res) => {
  try {
    const { road_name, location, total_segments, assigned_engineers } = req.body;

    const project = await Project.create({
      road_name,
      location: location || {
        type: 'Polygon',
        coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]
      },
      total_segments,
      assigned_engineers: assigned_engineers || [],
      created_by: req.user._id
    });

    // Auto-create segments if coordinates provided
    if (req.body.segments && req.body.segments.length > 0) {
      const segmentDocs = req.body.segments.map((seg, index) => ({
        project_id: project._id,
        segment_number: index + 1,
        coordinates: seg.coordinates
      }));
      await Segment.insertMany(segmentDocs);
    } else {
      // Create placeholder segments
      const segmentDocs = [];
      for (let i = 1; i <= total_segments; i++) {
        segmentDocs.push({
          project_id: project._id,
          segment_number: i,
          coordinates: {
            start: { latitude: 0, longitude: 0 },
            end: { latitude: 0, longitude: 0 }
          }
        });
      }
      await Segment.insertMany(segmentDocs);
    }

    const populatedProject = await Project.findById(project._id)
      .populate('assigned_engineers', 'name email')
      .populate('created_by', 'name email');

    res.status(201).json({ success: true, data: populatedProject });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get all projects (filtered by role)
// @route   GET /api/projects
exports.getProjects = async (req, res) => {
  try {
    let query = {};
    
    // Engineers see only assigned projects
    if (req.user.role === 'engineer') {
      query.assigned_engineers = req.user._id;
    }

    const projects = await Project.find(query)
      .populate('assigned_engineers', 'name email')
      .populate('created_by', 'name email')
      .sort({ created_at: -1 });

    // Attach segment progress to each project
    const projectsWithProgress = await Promise.all(
      projects.map(async (project) => {
        const segments = await Segment.find({ project_id: project._id });
        const completed = segments.filter(s => s.status === 'completed').length;
        return {
          ...project.toObject(),
          segments_completed: completed,
          progress: Math.round((completed / project.total_segments) * 100)
        };
      })
    );

    res.json({ success: true, data: projectsWithProgress });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get single project with segments
// @route   GET /api/projects/:id
exports.getProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('assigned_engineers', 'name email')
      .populate('created_by', 'name email');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const segments = await Segment.find({ project_id: project._id })
      .sort({ segment_number: 1 });

    res.json({ 
      success: true, 
      data: { ...project.toObject(), segments } 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Update project (Admin)
// @route   PUT /api/projects/:id
exports.updateProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Assign engineer to project (Admin)
// @route   PUT /api/projects/:id/assign
exports.assignEngineer = async (req, res) => {
  try {
    const { engineer_id } = req.body;
    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { assigned_engineers: engineer_id } },
      { new: true }
    ).populate('assigned_engineers', 'name email');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
