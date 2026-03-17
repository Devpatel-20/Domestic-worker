const express = require('express');
const Worker  = require('../models/Worker');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

/* ─────────────────────────────────────────────
   GET /api/workers  — list all workers
   Access: admin, employer
───────────────────────────────────────────── */
router.get('/', verifyToken, requireRole('admin', 'employer'), async (req, res) => {
  try {
    const { skill, location, available, flagged } = req.query;
    const filter = {};

    if (skill)     filter.skills    = { $in: [skill] };
    if (location)  filter.location  = new RegExp(location, 'i');
    if (available !== undefined) filter.availability = available === 'true';
    if (flagged   !== undefined) filter.flagged      = flagged   === 'true';

    const workers = await Worker.find(filter).sort({ trustScore: -1 });
    res.json(workers);
  } catch (err) {
    console.error('[workers/list]', err);
    res.status(500).json({ error: 'Failed to fetch workers.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/workers/me  — worker views own profile
   Access: worker
───────────────────────────────────────────── */
router.get('/me', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const worker = await Worker.findOne({ userId: req.user.id });
    if (!worker) return res.status(404).json({ error: 'Worker profile not found.' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/workers/:id  — get single worker
   Access: admin, employer
───────────────────────────────────────────── */
router.get('/:id', verifyToken, requireRole('admin', 'employer'), async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found.' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch worker.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/workers  — admin manually adds worker
   Access: admin
───────────────────────────────────────────── */
router.post('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, phone, skills, experience, location } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required.' });
    }
    const worker = await Worker.create({ name, phone, skills, experience, location });
    res.status(201).json(worker);
  } catch (err) {
    console.error('[workers/create]', err);
    res.status(500).json({ error: 'Failed to create worker.' });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/workers/me  — worker updates own profile
   Access: worker
───────────────────────────────────────────── */
router.patch('/me', verifyToken, requireRole('worker'), async (req, res) => {
  try {
    const allowed = ['skills', 'experience', 'availability', 'location', 'phone'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const worker = await Worker.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true }
    );
    if (!worker) return res.status(404).json({ error: 'Worker profile not found.' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/workers/:id/flag  — toggle flag
   Access: admin
───────────────────────────────────────────── */
router.patch('/:id/flag', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found.' });

    worker.flagged = !worker.flagged;
    await worker.save();

    res.json({ message: `Worker ${worker.flagged ? 'flagged' : 'unflagged'} successfully.`, worker });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update flag.' });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/workers/:id  — admin updates any worker
   Access: admin
───────────────────────────────────────────── */
router.patch('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['skills', 'experience', 'availability', 'location', 'rating', 'trustScore', 'flagged', 'phone'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const worker = await Worker.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!worker) return res.status(404).json({ error: 'Worker not found.' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update worker.' });
  }
});

/* ─────────────────────────────────────────────
   DELETE /api/workers/:id
   Access: admin
───────────────────────────────────────────── */
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found.' });
    res.json({ message: 'Worker deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete worker.' });
  }
});

module.exports = router;
