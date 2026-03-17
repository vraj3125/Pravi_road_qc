const Inspection = require('../models/Inspection');
const GPSLog = require('../models/GPSLog');
const Alert = require('../models/Alert');
const User = require('../models/User');
const Project = require('../models/Project');
const Segment = require('../models/Segment');

// @desc    Get inspection reports (with filters)
// @route   GET /api/admin/reports
exports.getReports = async (req, res) => {
  try {
    const { project_id, engineer_id, status, from_date, to_date, page = 1, limit = 20 } = req.query;

    const query = {};
    if (project_id) query.project_id = project_id;
    if (engineer_id) query.engineer_id = engineer_id;
    if (status) query.validation_status = status;
    if (from_date || to_date) {
      query.timestamp = {};
      if (from_date) query.timestamp.$gte = new Date(from_date);
      if (to_date) query.timestamp.$lte = new Date(to_date);
    }

    const total = await Inspection.countDocuments(query);
    const inspections = await Inspection.find(query)
      .populate('engineer_id', 'name email')
      .populate('project_id', 'road_name')
      .populate('segment_id', 'segment_number')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: inspections,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get GPS path for a project/engineer
// @route   GET /api/admin/gps-path/:projectId
exports.getGPSPath = async (req, res) => {
  try {
    const { engineer_id } = req.query;
    const query = { project_id: req.params.projectId };
    if (engineer_id) query.engineer_id = engineer_id;

    const gpsLogs = await GPSLog.find(query)
      .populate('engineer_id', 'name email')
      .sort({ started_at: -1 });

    res.json({ success: true, data: gpsLogs });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Create alert manually
// @route   POST /api/admin/alerts
exports.createAlert = async (req, res) => {
  try {
    const { type, message, engineer_id, project_id, severity } = req.body;

    const alert = await Alert.create({
      type,
      message,
      engineer_id,
      project_id,
      severity: severity || 'medium'
    });

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get all alerts
// @route   GET /api/admin/alerts
exports.getAlerts = async (req, res) => {
  try {
    const { resolved, severity, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (resolved !== undefined) query.resolved = resolved === 'true';
    if (severity) query.severity = severity;

    const total = await Alert.countDocuments(query);
    const alerts = await Alert.find(query)
      .populate('engineer_id', 'name email')
      .populate('project_id', 'road_name')
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: alerts,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Resolve alert
// @route   PUT /api/admin/alerts/:id/resolve
exports.resolveAlert = async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Dashboard stats
// @route   GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const [
      totalProjects,
      activeProjects,
      totalEngineers,
      totalInspections,
      validInspections,
      flaggedInspections,
      unresolvedAlerts
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'engineer' }),
      Inspection.countDocuments(),
      Inspection.countDocuments({ validation_status: 'valid' }),
      Inspection.countDocuments({ validation_status: { $in: ['flagged', 'rejected'] } }),
      Alert.countDocuments({ resolved: false })
    ]);

    res.json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        totalEngineers,
        totalInspections,
        validInspections,
        flaggedInspections,
        unresolvedAlerts
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get all engineers
// @route   GET /api/admin/engineers
exports.getEngineers = async (req, res) => {
  try {
    const engineers = await User.find({ role: 'engineer' }).select('-password');
    res.json({ success: true, data: engineers });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
