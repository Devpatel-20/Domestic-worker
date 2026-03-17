const mongoose = require('mongoose');

const AgentLogSchema = new mongoose.Schema({
  icon:   { type: String, default: '🤖' },
  agent:  { type: String, required: true },
  title:  { type: String, required: true },
  detail: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('AgentLog', AgentLogSchema);
