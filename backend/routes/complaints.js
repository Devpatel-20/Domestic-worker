const express       = require('express');
const Complaint     = require('../models/Complaint');
const Worker        = require('../models/Worker');
const AgentLog      = require('../models/AgentLog');
const { verifyToken, requireRole } = require('../middleware/auth');
const { runComplaintAgent }        = require('../services/ai');

const router = express.Router();

/* ─────────────────────────────────────────────
   POST /api/complaints  — file a new complaint
   Access: employer, admin
───────────────────────────────────────────── */
router.post('/', verifyToken, requireRole('employer', 'admin'), async (req, res) => {
  try {
    const { workerId, text } = req.body;
    if (!workerId || !text) {
      return res.status(400).json({ error: 'workerId and text are required.' });
    }

    const worker = await Worker.findById(workerId);
    if (!worker) return res.status(404).json({ error: 'Worker not found.' });

    // ── Real AI Agent classification (falls back to regex if key not set) ──
    let type, priority, action, aiPowered = false;
    try {
      ({ type, priority, action } = await runComplaintAgent(text));
      aiPowered = true;
    } catch (aiErr) {
      console.warn('[complaints] AI agent unavailable, using regex fallback:', aiErr.message);
      type     = regexType(text);
      priority = regexPriority(type, text);
      action   = regexAction(priority);
    }

    const complaint = await Complaint.create({
      workerId,
      workerName:  worker.name,
      filedById:   req.user.id,
      filedByName: req.user.name,
      text,
      type,
      priority,
      action
    });

    // Apply action to worker automatically
    if (action === 'Flag') {
      worker.flagged    = true;
      worker.trustScore = Math.max(0, worker.trustScore - 20);
      await worker.save();
    } else if (action === 'Warn') {
      worker.trustScore = Math.max(0, worker.trustScore - 10);
      await worker.save();
    }

    await AgentLog.create({
      icon:   '⚖️',
      agent:  'Complaint Resolution Agent',
      title:  `Complaint filed against ${worker.name}`,
      detail: `Type: ${type} | Priority: ${priority} | Action: ${action} | AI: ${aiPowered ? '✅ Gemini' : '⚠️ Regex fallback'}`
    });

    res.status(201).json({ ...complaint.toObject(), aiPowered });
  } catch (err) {
    console.error('[complaints/create]', err);
    res.status(500).json({ error: 'Failed to file complaint.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/complaints  — list all complaints
   Access: admin
───────────────────────────────────────────── */
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { priority, action, type } = req.query;
    const filter = {};
    if (priority) filter.priority = priority;
    if (action)   filter.action   = action;
    if (type)     filter.type     = type;

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaints.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/complaints/worker/:workerId  — complaints about a specific worker
   Access: admin
───────────────────────────────────────────── */
router.get('/worker/:workerId', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const complaints = await Complaint.find({ workerId: req.params.workerId }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch complaints.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/complaints/mine  — complaints filed by current user
   Access: employer
───────────────────────────────────────────── */
router.get('/mine', verifyToken, requireRole('employer'), async (req, res) => {
  try {
    const complaints = await Complaint.find({ filedById: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your complaints.' });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/complaints/:id  — admin overrides action
   Access: admin
───────────────────────────────────────────── */
router.patch('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { action, priority } = req.body;
    const updates = {};
    if (action)   updates.action   = action;
    if (priority) updates.priority = priority;

    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update complaint.' });
  }
});

/* ─────────────────────────────────────────────
   DELETE /api/complaints/:id
   Access: admin
───────────────────────────────────────────── */
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    res.json({ message: 'Complaint dismissed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete complaint.' });
  }
});

/* ─────────────────────────────────────────────
   Regex fallback helpers (used when Gemini is unavailable)
───────────────────────────────────────────── */
function regexType(text) {
  if (/fraud|scam|steal|theft|money|advance|cheat/i.test(text)) return 'Fraud';
  if (/rude|misbehav|harass|assault|threat|violence|abuse/i.test(text)) return 'Misconduct';
  if (/late|delay|absent|didn.t come|not show|miss/i.test(text)) return 'Delay';
  return 'Other';
}
function regexPriority(type, text) {
  if (type === 'Fraud' || type === 'Misconduct') return 'High';
  if (type === 'Delay' || /repeated|multiple|serious|urgent/i.test(text)) return 'Medium';
  return 'Low';
}
function regexAction(priority) {
  if (priority === 'High')   return 'Flag';
  if (priority === 'Medium') return 'Warn';
  return 'Ignore';
}

module.exports = router;
