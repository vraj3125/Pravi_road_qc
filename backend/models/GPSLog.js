const mongoose = require('mongoose');

const gpsLogSchema = new mongoose.Schema({
  engineer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  session_id: {
    type: String,
    required: true
  },
  path_coordinates: [{
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    timestamp: { type: Date, default: Date.now }
  }],
  total_distance_meters: {
    type: Number,
    default: 0
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date
  }
});

// Index for efficient queries
gpsLogSchema.index({ engineer_id: 1, session_id: 1 });
gpsLogSchema.index({ project_id: 1 });

module.exports = mongoose.model('GPSLog', gpsLogSchema);
