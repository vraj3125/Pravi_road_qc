const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  road_name: {
    type: String,
    required: [true, 'Road name is required'],
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Polygon', 'LineString'],
      default: 'Polygon'
    },
    coordinates: {
      type: [[[Number]]],
      required: true
    }
  },
  total_segments: {
    type: Number,
    required: [true, 'Total segments is required'],
    min: 1
  },
  assigned_engineers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused'],
    default: 'active'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Index for geo queries
projectSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Project', projectSchema);
