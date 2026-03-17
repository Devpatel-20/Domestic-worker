const mongoose = require('mongoose');

const JobAllocationSchema = new mongoose.Schema({
  workerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  workerName:   { type: String },
  employerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true },
  employerName: { type: String },
  jobType:      { type: String, required: true, trim: true },          // e.g. "Cooking", "Cleaning"
  location:     { type: String, default: '' },
  startDate:    { type: Date, default: Date.now },
  endDate:      { type: Date, default: null },
  status:       {
    type: String,
    enum: ['Pending', 'Active', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  salary:       { type: Number, default: 0, min: 0 },                  // monthly in INR
  aiAssigned:   { type: Boolean, default: false },                     // true if assigned by AI agent
  notes:        { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('JobAllocation', JobAllocationSchema);
