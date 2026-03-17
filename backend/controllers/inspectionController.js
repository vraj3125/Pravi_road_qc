const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');
const Inspection = require('../models/Inspection');
const Segment = require('../models/Segment');
const GPSLog = require('../models/GPSLog');
const Alert = require('../models/Alert');

// Minimum time per segment in minutes
const MIN_TIME_PER_SEGMENT = 2;

// Helper: Calculate distance between two GPS points (Haversine formula)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Helper: Generate image hash for duplicate detection
const generateImageHash = (buffer) => {
  return crypto.createHash('md5').update(buffer).digest('hex');
};

// @desc    Start inspection session
// @route   POST /api/inspection/start
exports.startInspection = async (req, res) => {
  try {
    const { project_id, segment_id } = req.body;

    // Check segment exists and is not already completed
    const segment = await Segment.findById(segment_id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }
    if (segment.status === 'completed') {
      return res.status(400).json({ error: 'Segment already completed' });
    }

    // Check previous segments are completed (no skipping)
    if (segment.segment_number > 1) {
      const previousSegment = await Segment.findOne({
        project_id: segment.project_id,
        segment_number: segment.segment_number - 1
      });
      if (previousSegment && previousSegment.status !== 'completed') {
        return res.status(400).json({ 
          error: `Cannot skip segments. Complete segment ${previousSegment.segment_number} first.` 
        });
      }
    }

    // Generate session ID
    const session_id = `sess_${Date.now()}_${req.user._id}`;

    // Mark segment as in progress
    segment.status = 'in_progress';
    await segment.save();

    // Create GPS log for this session
    await GPSLog.create({
      engineer_id: req.user._id,
      project_id,
      session_id,
      path_coordinates: []
    });

    res.json({
      success: true,
      data: {
        session_id,
        segment: segment,
        started_at: new Date(),
        message: 'Inspection session started. Begin GPS tracking.'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Upload inspection image to Cloudinary
// @route   POST /api/inspection/upload
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { session_id, latitude, longitude } = req.body;

    // Generate hash for duplicate detection
    const imageHash = generateImageHash(req.file.buffer);

    // Check for duplicate images in this session
    const existingInspections = await Inspection.find({ session_id });
    for (const inspection of existingInspections) {
      for (const img of inspection.images) {
        if (img.hash === imageHash) {
          // Create alert
          await Alert.create({
            type: 'duplicate_image',
            message: `Duplicate image detected in session ${session_id}`,
            engineer_id: req.user._id,
            severity: 'high'
          });
          return res.status(400).json({ error: 'Duplicate image detected. Upload a unique image.' });
        }
      }
    }

    // Upload to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'road-inspections',
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const result = await uploadPromise;

    res.json({
      success: true,
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        hash: imageHash,
        gps: {
          latitude: parseFloat(latitude) || 0,
          longitude: parseFloat(longitude) || 0
        },
        captured_at: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Image upload failed: ' + error.message });
  }
};

// @desc    Submit inspection for a segment
// @route   POST /api/inspection/submit
exports.submitInspection = async (req, res) => {
  try {
    const {
      project_id,
      segment_id,
      session_id,
      gps_location,
      images,
      inspection_data,
      started_at
    } = req.body;

    // ========== VALIDATION CHECKS ==========

    // 1. Check images exist
    if (!images || images.length === 0) {
      await Alert.create({
        type: 'suspicious_activity',
        message: `Inspection submitted without images for segment ${segment_id}`,
        engineer_id: req.user._id,
        project_id,
        severity: 'critical'
      });
      return res.status(400).json({ error: 'At least one image is required for inspection submission' });
    }

    // 2. Check GPS movement
    const gpsLog = await GPSLog.findOne({ session_id });
    if (gpsLog && gpsLog.path_coordinates.length > 1) {
      const coords = gpsLog.path_coordinates;
      let totalMovement = 0;
      for (let i = 1; i < coords.length; i++) {
        totalMovement += calculateDistance(
          coords[i - 1].latitude, coords[i - 1].longitude,
          coords[i].latitude, coords[i].longitude
        );
      }

      if (totalMovement < 5) { // Less than 5 meters total movement
        await Alert.create({
          type: 'no_movement',
          message: `No GPS movement detected during inspection session ${session_id}. Total movement: ${totalMovement.toFixed(2)}m`,
          engineer_id: req.user._id,
          project_id,
          severity: 'critical'
        });
        return res.status(400).json({ 
          error: 'Inspection rejected: No GPS movement detected. You must physically inspect the road segment.' 
        });
      }
    } else if (!gpsLog || gpsLog.path_coordinates.length === 0) {
      await Alert.create({
        type: 'no_movement',
        message: `No GPS data recorded for session ${session_id}`,
        engineer_id: req.user._id,
        project_id,
        severity: 'critical'
      });
      return res.status(400).json({ error: 'Inspection rejected: No GPS tracking data found. Enable location services.' });
    }

    // 3. Check minimum time threshold
    const sessionStart = new Date(started_at);
    const durationMinutes = (Date.now() - sessionStart.getTime()) / (1000 * 60);
    if (durationMinutes < MIN_TIME_PER_SEGMENT) {
      await Alert.create({
        type: 'time_violation',
        message: `Inspection completed too quickly (${durationMinutes.toFixed(1)} min) for session ${session_id}`,
        engineer_id: req.user._id,
        project_id,
        severity: 'high'
      });
      return res.status(400).json({ 
        error: `Inspection rejected: Minimum ${MIN_TIME_PER_SEGMENT} minutes required per segment. Time spent: ${durationMinutes.toFixed(1)} minutes.` 
      });
    }

    // 4. Check for duplicate image hashes
    const imageHashes = images.map(img => img.hash);
    const uniqueHashes = new Set(imageHashes);
    if (uniqueHashes.size !== imageHashes.length) {
      await Alert.create({
        type: 'duplicate_image',
        message: `Duplicate images in submission for session ${session_id}`,
        engineer_id: req.user._id,
        project_id,
        severity: 'high'
      });
      return res.status(400).json({ error: 'Duplicate images detected in submission' });
    }

    // ========== CREATE INSPECTION ==========
    const inspection = await Inspection.create({
      engineer_id: req.user._id,
      project_id,
      segment_id,
      session_id,
      gps_location,
      images,
      inspection_data,
      started_at: sessionStart,
      duration_minutes: durationMinutes,
      validation_status: 'valid'
    });

    // Broadcast to admin via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`project-${project_id}`).emit('inspection-submitted', {
        inspectionId: inspection._id,
        engineerId: req.user._id,
        engineerName: req.user.name,
        segmentId: segment_id,
        timestamp: new Date()
      });
    }

    res.status(201).json({ success: true, data: inspection });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Mark segment as complete
// @route   PUT /api/inspection/segment/:id/complete
exports.completeSegment = async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    // Check that an inspection exists for this segment
    const inspection = await Inspection.findOne({
      segment_id: segment._id,
      engineer_id: req.user._id,
      validation_status: 'valid'
    });

    if (!inspection) {
      return res.status(400).json({ error: 'No valid inspection found for this segment. Submit inspection first.' });
    }

    segment.status = 'completed';
    segment.completed_by = req.user._id;
    segment.completed_at = new Date();
    await segment.save();

    // End GPS log session
    await GPSLog.findOneAndUpdate(
      { session_id: inspection.session_id },
      { ended_at: new Date() }
    );

    res.json({ success: true, data: segment });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
