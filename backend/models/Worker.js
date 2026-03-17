const mongoose = require('mongoose');

const WorkerSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, default: '' },
  skills:       { type: [String], default: [] },
  experience:   { type: Number, default: 0, min: 0 },
  rating:       { type: Number, default: 4.0, min: 0, max: 5 },
  trustScore:   { type: Number, default: 50, min: 0, max: 100 },
  availability: { type: Boolean, default: true },
  flagged:      { type: Boolean, default: false },
  location:     { type: String, default: 'Not specified' },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Worker', WorkerSchema);
