# 🏛️ DWRMS — AI-Powered Domestic Worker Registration & Management System

A full-stack web application for managing domestic and contract workers, built with **Node.js + Express + MongoDB** backend and a vanilla **HTML/CSS/JS** frontend. Powered by **Google Gemini AI** agents.

## ✨ Features

### 👥 Three Role System
| Role | Access |
|---|---|
| **Worker** | Register profile, AI-assisted profile filling, view dashboard |
| **Employer / Govt. Official** | Post jobs, AI job allocation, manage workers, file complaints, release workers |
| **Admin** | Full registry management, flag/unflag workers, view AI agent activity logs |

### 🤖 AI Agents (Gemini 2.0 Flash)
- **Registration Agent** — Extracts name, skills, experience, phone, location, availability from free-text description
- **Job Allocation Agent** — Finds the best available worker based on skills, trust score, and rating
- **Complaint Resolution Agent** — Classifies complaints by type, priority, and action (Flag/Warn/Ignore) automatically

### 🔒 Security
- JWT-based authentication
- Role-Based Access Control (RBAC) on every route
- bcrypt password hashing

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- A [Gemini API key](https://aistudio.google.com/apikey) (free)

### 1. Clone the repo
```bash
git clone https://github.com/Devpatel-20/Domestic-worker
cd Domestic-worker
```

### 2. Set up the backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
MONGO_URI=mongodb://localhost:27017/dwrms_db
JWT_SECRET=your_jwt_secret_here
PORT=3001
BCRYPT_ROUNDS=10
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Seed the database (optional)
```bash
npm run seed
```
This creates sample users, workers, employers, jobs, complaints, and agent logs with test login credentials.

### 4. Start the backend
```bash
npm start
```
Backend runs at `http://localhost:3001`

### 5. Serve the frontend
From the project root:
```bash
python3 -m http.server 8081
```
Open `http://localhost:8081` in your browser.

---

## 🗂️ Project Structure

```
dwrms/
├── index.html              # Frontend — single-page app
├── style.css               # Government-website aesthetic CSS
├── app.js                  # Frontend JS — API calls, AI agents, UI logic
└── backend/
    ├── server.js           # Express entry point
    ├── seed.js             # Database seeder
    ├── models/
    │   ├── User.js
    │   ├── Worker.js
    │   ├── Employer.js
    │   ├── Complaint.js
    │   ├── JobAllocation.js
    │   └── AgentLog.js
    ├── routes/
    │   ├── auth.js         # Register / Login / /me
    │   ├── workers.js      # Worker CRUD + flag/unflag
    │   ├── complaints.js   # File & manage complaints (AI classified)
    │   └── agents.js       # Job allocator, extract-text, logs
    ├── middleware/
    │   └── auth.js         # JWT verify + requireRole
    └── services/
        └── ai.js           # Gemini AI agents (Registration + Complaint)
```

---

## 🔑 Test Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@dwrms.gov` | `admin123` |
| Employer | `rahul@example.com` | `employer1` |
| Worker | `sunita@example.com` | `worker123` |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/workers` | List all workers |
| PATCH | `/api/workers/me` | Update own profile |
| PATCH | `/api/workers/:id/flag` | Flag/unflag worker (admin) |
| POST | `/api/complaints` | File complaint (AI classified) |
| GET | `/api/complaints/mine` | My complaints (employer) |
| POST | `/api/agents/extract-text` | Registration AI Agent |
| POST | `/api/agents/allocate` | Job Allocation AI Agent |
| GET | `/api/agents/logs` | Agent activity log (admin) |
| GET | `/api/agents/jobs/mine` | My job allocations (employer) |
| PATCH | `/api/agents/jobs/:id` | Update job status / release worker |

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (custom Gov. design), Vanilla JS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB + Mongoose
- **Auth**: JWT + bcryptjs
- **AI**: Google Gemini 2.0 Flash API

---

## 📄 License

MIT
