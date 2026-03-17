const express       = require('express');
const Worker        = require('../models/Worker');
const Employer      = require('../models/Employer');
const JobAllocation = require('../models/JobAllocation');
const AgentLog      = require('../models/AgentLog');
const { verifyToken, requireRole } = require('../middleware/auth');
const { runRegistrationAgent }     = require('../services/ai');

const router = express.Router();

/* ─────────────────────────────────────────────
   GET /api/agents/logs  — fetch all agent activity logs
   Access: admin
───────────────────────────────────────────── */
router.get('/logs', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const logs = await AgentLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent logs.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/agents/extract-text — Registration AI Agent
   Extracts skills + experience from free-form text using Gemini.
   Access: worker, employer, admin
───────────────────────────────────────────── */
router.post('/extract-text', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'text is required.' });
    }

    let result, aiPowered = false;
    try {
      result     = await runRegistrationAgent(text);
      aiPowered  = true;
    } catch (aiErr) {
      console.warn('[agents/extract-text] AI unavailable, using regex fallback:', aiErr.message);
      result = regexExtract(text);
    }

    await AgentLog.create({
      icon:   '📄',
      agent:  'Registration Agent',
      title:  `Extracted worker profile from text`,
      detail: `Skills: ${result.skills.join(', ') || 'None'} | Experience: ${result.experience} yrs | AI: ${aiPowered ? '✅ Gemini' : '⚠️ Regex fallback'}`
    });

    res.json({ ...result, aiPowered });
  } catch (err) {
    console.error('[agents/extract-text]', err);
    res.status(500).json({ error: 'Extraction failed.' });
  }
});

/* Regex fallback for registration extraction */
const SKILL_KEYWORDS = {
  'Cooking':          ['cook','cooking','chef','kitchen','food','meal','bake'],
  'Babysitting':      ['babysit','baby','child','children','toddler','nanny','kids'],
  'Driving':          ['drive','driver','driving','chauffeur','car','vehicle'],
  'Cleaning':         ['cleaning work','housekeeping','mop','household cleaning','home cleaning'],
  'Elderly Care':     ['elderly','senior','old age','elder','aged','geriatric'],
  'Gardening':        ['garden','gardening','plant','lawn','outdoor'],
  'Carpenter':        ['carpenter','carpentry','wood','furniture','cabinet'],
  'Painter':          ['paint','painter','painting','wall paint','colour','coloring'],
  'Tile & Flooring':  ['tile','tiling','flooring','floor','marble','grout'],
  'Plumber':          ['plumb','plumber','plumbing','pipe','drainage','tap','faucet'],
  'Electrician':      ['electric','electrician','wiring','circuit','switch','fuse'],
  'Welder':           ['weld','welder','welding','fabricat'],
  'Cement Worker':    ['cement','concrete','mason','masonry','plaster','construction'],
  'Road Worker':      ['road','highway','bitumen','asphalt','tar','paving'],
  'Security Guard':   ['security guard','watchman','bouncer','patrol','security work'],
  'Sweeper':          ['sweeper','sweeping','sanitation worker','garbage','waste collection','jhadu'],
  'Packers & Movers': ['packer','mover','moving','shifting','loading','unloading','packers'],
  'Laundry & Ironing':['laundry','ironing','iron clothes','wash clothes','dry clean','press clothes'],
};

function regexExtract(text) {
  const lower = text.toLowerCase();

  // Name — extract after "my name is", stop before stop-words
  const STOP = ['with','and','from','having','who','at','in','i','my','the'];
  let name = '';
  const nameMatch = text.match(/(?:my\s+name\s+is|name\s*[:\-])\s+(.+)/i);
  if (nameMatch) {
    const words = nameMatch[1].trim().split(/\s+/);
    const nameWords = [];
    for (const w of words) {
      if (STOP.includes(w.toLowerCase())) break;
      nameWords.push(w);
    }
    name = nameWords.join(' ').replace(/[,\.]+$/, '').replace(/\b\w/g, c => c.toUpperCase());
  }

  // Skills
  const skills = Object.entries(SKILL_KEYWORDS)
    .filter(([, kws]) => kws.some(kw => lower.includes(kw)))
    .map(([skill]) => skill);

  // Experience — "7 years", "7 yr", "7yrs"
  const yearMatch  = lower.match(/(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/);
  const yearMatch2 = yearMatch || lower.match(/(\d+)\s*(?:years?|yrs?)/);
  const experience = yearMatch2 ? parseInt(yearMatch2[1]) : 0;

  // Phone — 10-digit Indian mobile number
  const phoneMatch = text.match(/(?:\+91[-\s]?|0)?([6-9]\d{9})/);
  const phone      = phoneMatch ? phoneMatch[1] : '';

  // Location — only after explicit phrases
  const locPatterns = [
    /(?:my\s+)?location\s+is\s+([A-Za-z][A-Za-z\s]{1,24}?)(?:\s+and|\s*,|\.|\s*$)/i,
    /(?:from|based\s+in|living\s+in|belong\s+to|located\s+in)\s+([A-Za-z][A-Za-z\s]{1,24}?)(?:\s+and|\s*,|\.|\s*$)/i,
    /city\s+(?:is\s+)?([A-Za-z][A-Za-z\s]{1,24}?)(?:\s+and|\s*,|\.|\s*$)/i,
  ];
  let location = '';
  for (const pat of locPatterns) {
    const m = text.match(pat);
    if (m) { location = m[1].trim().replace(/\b\w/g, c => c.toUpperCase()); break; }
  }

  // Availability — "available" = true, "not available" / "unavailable" = false
  const availability = /\bnot\s+available\b|\bunavailable\b/i.test(text) ? false : true;

  return { name, skills, experience, phone, location, availability };
}

/* ─────────────────────────────────────────────
   POST /api/agents/allocate  — AI Job Allocation Agent
   Finds best available worker for employer's job request
   Access: employer, admin
───────────────────────────────────────────── */
router.post('/allocate', verifyToken, requireRole('employer', 'admin'), async (req, res) => {
  try {
    const { jobType, location, salary } = req.body;
    if (!jobType) {
      return res.status(400).json({ error: 'jobType is required.' });
    }

    // Find matching employer profile
    const employer = await Employer.findOne({ userId: req.user.id });
    if (!employer && req.user.role === 'employer') {
      return res.status(404).json({ error: 'Employer profile not found.' });
    }

    // Step 1 — fetch available, unflagged workers who actually have the required skill
    const skillRegex = new RegExp(jobType, 'i');
    const query = { availability: true, flagged: false, skills: skillRegex };
    if (location) query.location = new RegExp(location, 'i');

    let candidates = await Worker.find(query);

    // Step 2 — if location filter gave 0, relax it and try without location
    let relaxedLocation = false;
    if (candidates.length === 0 && location) {
      const relaxedQuery = { availability: true, flagged: false, skills: skillRegex };
      candidates = await Worker.find(relaxedQuery);
      relaxedLocation = candidates.length > 0;
    }

    // Step 3 — if still 0, return a clear, specific error
    if (candidates.length === 0) {
      const totalWithSkill   = await Worker.countDocuments({ skills: skillRegex });
      const flaggedWithSkill = await Worker.countDocuments({ skills: skillRegex, flagged: true });
      const busyWithSkill    = await Worker.countDocuments({ skills: skillRegex, availability: false, flagged: false });

      let reason = `No registered worker found with the skill "${jobType}". Nobody in the system offers this service yet.`;
      if (totalWithSkill > 0) {
        reason = `No available worker found for "${jobType}" right now.`;
        if (flaggedWithSkill > 0) reason += ` ${flaggedWithSkill} worker(s) with this skill are flagged.`;
        if (busyWithSkill   > 0) reason += ` ${busyWithSkill} worker(s) are currently assigned to another job.`;
        reason += ' Please try again later or contact the administrator.';
      }

      await AgentLog.create({
        icon:   '❌',
        agent:  'Job Allocation Agent',
        title:  `No worker found for "${jobType}"`,
        detail: `Employer: ${req.user.name} | Location: ${location || 'Any'} | ${reason}`
      });

      return res.status(404).json({ error: reason, jobType, totalWithSkill });
    }

    // Step 4 — rank matched candidates by trustScore + rating
    candidates = candidates
      .map(w => ({ worker: w, score: w.trustScore + w.rating * 10 }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0].worker;

    // Create allocation
    const allocation = await JobAllocation.create({
      workerId:     best._id,
      workerName:   best.name,
      employerId:   employer ? employer._id : null,
      employerName: req.user.name,
      jobType,
      location:     location || best.location,
      salary:       salary || 0,
      status:       'Pending',
      aiAssigned:   true,
      notes:        relaxedLocation ? `Location relaxed — no worker in "${location}", assigned nearest available.` : ''
    });

    // Mark worker as unavailable
    best.availability = false;
    await best.save();

    await AgentLog.create({
      icon:   '🔀',
      agent:  'Job Allocation Agent',
      title:  `Assigned ${best.name} to ${jobType} job`,
      detail: `Employer: ${req.user.name} | Location: ${location || 'Any'} | Score: ${candidates[0].score}${relaxedLocation ? ' | Location relaxed' : ''}`
    });

    res.status(201).json({ allocation, worker: best, relaxedLocation });
  } catch (err) {
    console.error('[agents/allocate]', err);
    res.status(500).json({ error: 'Allocation failed.' });
  }
});

/* ─────────────────────────────────────────────
   POST /api/agents/extract  — Data Extraction Agent
   Simulates OCR/AI extraction from registration data
   Access: admin
───────────────────────────────────────────── */
router.post('/extract', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { rawText } = req.body; // raw text from document / form
    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required.' });
    }

    // Simple regex-based extraction simulation
    const nameMatch     = rawText.match(/name[:\s]+([A-Za-z\s]+)/i);
    const phoneMatch    = rawText.match(/phone[:\s]+([\d\s+\-()]{7,15})/i);
    const skillsMatch   = rawText.match(/skills?[:\s]+([A-Za-z,\s]+)/i);
    const locationMatch = rawText.match(/(?:location|city|address)[:\s]+([A-Za-z\s,]+)/i);
    const expMatch      = rawText.match(/experience[:\s]+(\d+)/i);

    const extracted = {
      name:       nameMatch     ? nameMatch[1].trim()                        : null,
      phone:      phoneMatch    ? phoneMatch[1].trim()                       : null,
      skills:     skillsMatch   ? skillsMatch[1].split(',').map(s => s.trim()) : [],
      location:   locationMatch ? locationMatch[1].trim()                   : null,
      experience: expMatch      ? parseInt(expMatch[1])                     : 0
    };

    // Log agent activity
    await AgentLog.create({
      icon:   '📄',
      agent:  'Data Extraction Agent',
      title:  'Extracted worker data from document',
      detail: `Name: ${extracted.name || 'N/A'} | Skills: ${extracted.skills.join(', ') || 'N/A'}`
    });

    res.json({ extracted });
  } catch (err) {
    console.error('[agents/extract]', err);
    res.status(500).json({ error: 'Extraction failed.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/agents/jobs  — list all job allocations
   Access: admin
───────────────────────────────────────────── */
router.get('/jobs', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const jobs = await JobAllocation.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs.' });
  }
});

/* ─────────────────────────────────────────────
   GET /api/agents/jobs/mine  — employer sees own allocations
   Access: employer
───────────────────────────────────────────── */
router.get('/jobs/mine', verifyToken, requireRole('employer'), async (req, res) => {
  try {
    const employer = await Employer.findOne({ userId: req.user.id });
    if (!employer) return res.status(404).json({ error: 'Employer profile not found.' });

    const jobs = await JobAllocation.find({ employerId: employer._id }).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your jobs.' });
  }
});

/* ─────────────────────────────────────────────
   PATCH /api/agents/jobs/:id  — update job status
   Access: admin, employer
───────────────────────────────────────────── */
router.patch('/jobs/:id', verifyToken, requireRole('admin', 'employer'), async (req, res) => {
  try {
    const { status } = req.body;
    const job = await JobAllocation.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    // If completed/cancelled, make worker available again
    if (status === 'Completed' || status === 'Cancelled') {
      await Worker.findByIdAndUpdate(job.workerId, { $set: { availability: true } });
    }

    await AgentLog.create({
      icon:   '📋',
      agent:  'Job Allocation Agent',
      title:  `Job status updated to ${status}`,
      detail: `Worker: ${job.workerName} | Employer: ${job.employerName}`
    });

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update job.' });
  }
});

module.exports = router;
