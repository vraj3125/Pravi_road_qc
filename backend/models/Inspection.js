const mongoose = require('mongoose');

const inspectionSchema = new mongoose.Schema({
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
  segment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment',
    required: true
  },
  gps_location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number }
  },
  images: [{
    url: { type: String, required: true },
    public_id: { type: String },
    hash: { type: String },
    gps: {
      latitude: Number,
      longitude: Number
    },
    captured_at: { type: Date, default: Date.now }
  }],
  inspection_data: {
    thickness: {
      type: Number,
      required: [true, 'Road thickness is required']
    },
    material_quality: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor', 'very_poor'],
      required: [true, 'Material quality rating is required']
    },
    defects: {
      type: String,
      default: 'none'
    }
  },
  session_id: {
    type: String,
    required: true
  },
  started_at: {
    type: Date,
    required: true
  },
  submitted_at: {
    type: Date,
    default: Date.now
  },
  duration_minutes: {
    type: Number
  },
  validation_status: {
    type: String,
    enum: ['valid', 'flagged', 'rejected'],
    default: 'valid'
  },
  validation_notes: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Indexes
inspectionSchema.index({ engineer_id: 1, project_id: 1 });
inspectionSchema.index({ session_id: 1 });

module.exports = mongoose.model('Inspection', inspectionSchema);
