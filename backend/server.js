require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');

const authRoutes      = require('./routes/auth');
const workerRoutes    = require('./routes/workers');
const complaintRoutes = require('./routes/complaints');
const agentRoutes     = require('./routes/agents');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ──────────────────────────────── */
app.use(cors());
app.use(express.json());

/* ── Routes ──────────────────────────────────── */
app.use('/api/auth',       authRoutes);
app.use('/api/workers',    workerRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/agents',     agentRoutes);

/* ── Health Check ────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'DWRMS Backend',
    time:    new Date().toISOString(),
    db:      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

/* ── 404 handler ─────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

/* ── Global error handler ────────────────────── */
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

/* ── Connect DB & Start ──────────────────────── */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(`✅ MongoDB connected: ${process.env.MONGO_URI}`);
    app.listen(PORT, () => {
      console.log(`🚀 DWRMS Backend running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
