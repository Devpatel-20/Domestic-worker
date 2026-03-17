const mongoose = require('mongoose');

const EmployerSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, default: '' },
  address:      { type: String, default: '' },
  location:     { type: String, default: 'Not specified' },
  jobsPosted:   { type: Number, default: 0 },
  verified:     { type: Boolean, default: false },
  govtIdNumber: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Employer', EmployerSchema);
