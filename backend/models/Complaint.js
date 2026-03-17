const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  workerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  workerName: { type: String },
  filedById:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filedByName:{ type: String },
  text:       { type: String, required: true },
  type:       { type: String, enum: ['Fraud', 'Misconduct', 'Delay', 'Other'], default: 'Other' },
  priority:   { type: String, enum: ['High', 'Medium', 'Low'], default: 'Low' },
  action:     { type: String, enum: ['Flag', 'Warn', 'Ignore'], default: 'Ignore' }
}, { timestamps: true });

module.exports = mongoose.model('Complaint', ComplaintSchema);
