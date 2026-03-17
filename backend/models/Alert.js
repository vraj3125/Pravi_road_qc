const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['no_movement', 'duplicate_image', 'segment_skipped', 'time_violation', 'geo_fence_breach', 'suspicious_activity'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  engineer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  inspection_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inspection'
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  resolved: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

alertSchema.index({ engineer_id: 1 });
alertSchema.index({ project_id: 1 });

module.exports = mongoose.model('Alert', alertSchema);
