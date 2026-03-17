const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  project_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  segment_number: {
    type: Number,
    required: true
  },
  coordinates: {
    start: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    end: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    }
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'flagged'],
    default: 'pending'
  },
  completed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completed_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Compound index for fast lookups
segmentSchema.index({ project_id: 1, segment_number: 1 });

module.exports = mongoose.model('Segment', segmentSchema);
