require('dotenv').config();
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');

const User          = require('./models/User');
const Worker        = require('./models/Worker');
const Employer      = require('./models/Employer');
const Complaint     = require('./models/Complaint');
const JobAllocation = require('./models/JobAllocation');
const AgentLog      = require('./models/AgentLog');

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── Clear existing data ──────────────────────
  await Promise.all([
    User.deleteMany({}),
    Worker.deleteMany({}),
    Employer.deleteMany({}),
    Complaint.deleteMany({}),
    JobAllocation.deleteMany({}),
    AgentLog.deleteMany({})
  ]);
  console.log('🗑️  Cleared existing data');

  // ── Create Users ─────────────────────────────
  const [adminUser, emp1User, emp2User, w1User, w2User, w3User, w4User] = await User.insertMany([
    { name: 'Admin Singh',       email: 'admin@dwrms.gov',    passwordHash: await bcrypt.hash('admin123',   ROUNDS), role: 'admin'    },
    { name: 'Rahul Mehta',       email: 'rahul@example.com',  passwordHash: await bcrypt.hash('employer1',  ROUNDS), role: 'employer' },
    { name: 'Priya Sharma',      email: 'priya@example.com',  passwordHash: await bcrypt.hash('employer2',  ROUNDS), role: 'employer' },
    { name: 'Sunita Devi',       email: 'sunita@example.com', passwordHash: await bcrypt.hash('worker123',  ROUNDS), role: 'worker'   },
    { name: 'Ramesh Kumar',      email: 'ramesh@example.com', passwordHash: await bcrypt.hash('worker123',  ROUNDS), role: 'worker'   },
    { name: 'Meena Bai',         email: 'meena@example.com',  passwordHash: await bcrypt.hash('worker123',  ROUNDS), role: 'worker'   },
    { name: 'Arvind Verma',      email: 'arvind@example.com', passwordHash: await bcrypt.hash('worker123',  ROUNDS), role: 'worker'   }
  ]);
  console.log('👤 Users created');

  // ── Create Employer Profiles ─────────────────
  const [emp1, emp2] = await Employer.insertMany([
    { userId: emp1User._id, name: 'Rahul Mehta',  phone: '+91-9876543210', location: 'Mumbai',    verified: true,  jobsPosted: 3 },
    { userId: emp2User._id, name: 'Priya Sharma', phone: '+91-9123456789', location: 'Delhi',     verified: true,  jobsPosted: 1 }
  ]);
  console.log('🏠 Employer profiles created');

  // ── Create Worker Profiles ───────────────────
  const [w1, w2, w3, w4] = await Worker.insertMany([
    {
      userId: w1User._id, name: 'Sunita Devi',  phone: '+91-9012345678',
      skills: ['Cooking', 'Cleaning', 'Childcare'], experience: 5,
      rating: 4.8, trustScore: 85, availability: true, location: 'Mumbai'
    },
    {
      userId: w2User._id, name: 'Ramesh Kumar', phone: '+91-9011223344',
      skills: ['Driving', 'Gardening'], experience: 3,
      rating: 4.2, trustScore: 72, availability: true, location: 'Mumbai'
    },
    {
      userId: w3User._id, name: 'Meena Bai',   phone: '+91-9988776655',
      skills: ['Cooking', 'Elder Care', 'Cleaning'], experience: 8,
      rating: 4.9, trustScore: 92, availability: false, location: 'Delhi'
    },
    {
      userId: w4User._id, name: 'Arvind Verma', phone: '+91-9876001234',
      skills: ['Plumbing', 'Electrical', 'Carpentry'], experience: 10,
      rating: 4.5, trustScore: 60, availability: true, flagged: true, location: 'Delhi'
    }
  ]);
  console.log('👷 Worker profiles created');

  // ── Create Job Allocations ───────────────────
  const [job1, job2] = await JobAllocation.insertMany([
    {
      workerId:     w1._id,   workerName:   w1.name,
      employerId:   emp1._id, employerName: emp1.name,
      jobType:      'Cooking', location: 'Mumbai',
      status:       'Active',  salary: 12000, aiAssigned: true
    },
    {
      workerId:     w3._id,   workerName:   w3.name,
      employerId:   emp2._id, employerName: emp2.name,
      jobType:      'Elder Care', location: 'Delhi',
      status:       'Completed',  salary: 15000, aiAssigned: true
    }
  ]);
  console.log('💼 Job allocations created');

  // ── Create Complaints ────────────────────────
  await Complaint.insertMany([
    {
      workerId:    w4._id, workerName:  w4.name,
      filedById:   emp1User._id, filedByName: emp1.name,
      text:    'Worker attempted to steal household items. Fraud suspected.',
      type:     'Fraud', priority: 'High', action: 'Flag'
    },
    {
      workerId:    w2._id, workerName:  w2.name,
      filedById:   emp1User._id, filedByName: emp1.name,
      text:    'Worker arrived 2 hours late on multiple occasions.',
      type:     'Delay', priority: 'Medium', action: 'Warn'
    }
  ]);
  console.log('⚠️  Complaints created');

  // ── Create Agent Logs ────────────────────────
  await AgentLog.insertMany([
    { icon: '📄', agent: 'Data Extraction Agent',   title: 'Worker registration form processed',   detail: 'Extracted: Sunita Devi | Skills: Cooking, Cleaning | Location: Mumbai' },
    { icon: '🔀', agent: 'Job Allocation Agent',    title: 'Assigned Sunita Devi to Cooking job',   detail: 'Employer: Rahul Mehta | Score: 123' },
    { icon: '⚖️', agent: 'Complaint Resolution Agent', title: 'High priority complaint auto-flagged', detail: 'Worker: Arvind Verma | Action: Flag | TrustScore reduced by 20' },
    { icon: '🔀', agent: 'Job Allocation Agent',    title: 'Assigned Meena Bai to Elder Care job', detail: 'Employer: Priya Sharma | Score: 141' }
  ]);
  console.log('🤖 Agent logs created');

  console.log('\n✅ Seed complete! Login credentials:');
  console.log('   Admin:    admin@dwrms.gov     / admin123');
  console.log('   Employer: rahul@example.com   / employer1');
  console.log('   Employer: priya@example.com   / employer2');
  console.log('   Worker:   sunita@example.com  / worker123');
  console.log('   Worker:   ramesh@example.com  / worker123');
  console.log('   Worker:   meena@example.com   / worker123');
  console.log('   Worker:   arvind@example.com  / worker123');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
