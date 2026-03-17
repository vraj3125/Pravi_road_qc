const GPSLog = require('../models/GPSLog');

// Helper: Calculate distance between two GPS points (Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// @desc    Log GPS coordinates
// @route   POST /api/gps/log
exports.logGPS = async (req, res) => {
  try {
    const { session_id, latitude, longitude, accuracy } = req.body;

    if (!session_id || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'session_id, latitude, and longitude are required' });
    }

    const gpsLog = await GPSLog.findOne({ session_id });
    if (!gpsLog) {
      return res.status(404).json({ error: 'GPS session not found. Start an inspection first.' });
    }

    const newPoint = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: parseFloat(accuracy) || 0,
      timestamp: new Date()
    };

    // Calculate distance from last point
    let addedDistance = 0;
    if (gpsLog.path_coordinates.length > 0) {
      const lastPoint = gpsLog.path_coordinates[gpsLog.path_coordinates.length - 1];
      addedDistance = calculateDistance(
        lastPoint.latitude, lastPoint.longitude,
        newPoint.latitude, newPoint.longitude
      );
    }

    gpsLog.path_coordinates.push(newPoint);
    gpsLog.total_distance_meters += addedDistance;
    await gpsLog.save();

    // Emit real-time GPS update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`project-${gpsLog.project_id}`).emit('engineer-location', {
        engineerId: req.user._id,
        engineerName: req.user.name,
        coordinates: newPoint,
        totalDistance: gpsLog.total_distance_meters,
        pointCount: gpsLog.path_coordinates.length
      });
    }

    res.json({
      success: true,
      data: {
        point_index: gpsLog.path_coordinates.length,
        total_distance_meters: Math.round(gpsLog.total_distance_meters),
        added_distance_meters: Math.round(addedDistance)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get GPS path for a session
// @route   GET /api/gps/path/:sessionId
exports.getGPSPath = async (req, res) => {
  try {
    const gpsLog = await GPSLog.findOne({ session_id: req.params.sessionId })
      .populate('engineer_id', 'name email');

    if (!gpsLog) {
      return res.status(404).json({ error: 'GPS log not found' });
    }

    res.json({ success: true, data: gpsLog });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
