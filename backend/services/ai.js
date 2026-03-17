/**
 * ai.js — Gemini AI Service
 * Sends prompts to Gemini 2.0 Flash and returns parsed JSON.
 * Uses Node.js native fetch (v18+).
 */

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

/**
 * callGemini(prompt)
 * Sends a prompt to Gemini and returns the raw text response.
 */
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     0.1,   // low temp for deterministic JSON output
        maxOutputTokens: 256
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API error (${res.status})`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

/**
 * parseJSON(text)
 * Safely parses JSON from Gemini output, stripping markdown code fences if present.
 */
function parseJSON(text) {
  // Strip ```json ... ``` or ``` ... ``` wrappers Gemini sometimes adds
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

/* ─────────────────────────────────────────────
   AGENT 1: REGISTRATION AGENT
   Extracts skills and experience from free text.
───────────────────────────────────────────── */
const REGISTRATION_PROMPT = `You are an AI that extracts structured worker information.

Extract the following from the input:
- name (full name as string, "" if not found)
- skills (array, only from this exact list: Cooking, Babysitting, Driving, Cleaning, Elderly Care, Gardening, Carpenter, Painter, Tile & Flooring, Plumber, Electrician, Welder, Cement Worker, Road Worker, Security Guard, Sweeper, Packers & Movers, Laundry & Ironing)
- experience (number in years, 0 if not mentioned)
- phone (10-digit Indian mobile number as string, "" if not found)
- location (city or area name as string, "" if not found)
- availability (true if person says they are available, false if unavailable, true by default)

Rules:
- Only return valid JSON
- Do not infer or guess skills — only include skills explicitly mentioned
- Do not add explanation

Input: {{user_input}}`;

async function runRegistrationAgent(userInput) {
  const prompt = REGISTRATION_PROMPT.replace('{{user_input}}', userInput);
  const text   = await callGemini(prompt);
  const result = parseJSON(text);
  return {
    name:         typeof result.name         === 'string'  ? result.name.trim()     : '',
    skills:       Array.isArray(result.skills)             ? result.skills          : [],
    experience:   typeof result.experience   === 'number'  ? result.experience      : 0,
    phone:        typeof result.phone        === 'string'  ? result.phone.trim()    : '',
    location:     typeof result.location     === 'string'  ? result.location.trim() : '',
    availability: result.availability === false             ? false                  : true
  };
}

/* ─────────────────────────────────────────────
   AGENT 2: COMPLAINT AGENT
   Classifies a complaint into type/priority/action.
───────────────────────────────────────────── */
const COMPLAINT_PROMPT = `You are an AI complaint analyzer.

Classify the complaint into:
- type (Fraud, Misconduct, Delay, Other)
- priority (High, Medium, Low)
- action (Flag, Warn, Ignore)

Rules:
- Fraud = money issues, cheating
- Misconduct = bad behavior
- Delay = late or no-show
- Only return JSON

Input: {{complaint_text}}`;

const VALID_TYPES     = ['Fraud', 'Misconduct', 'Delay', 'Other'];
const VALID_PRIORITY  = ['High', 'Medium', 'Low'];
const VALID_ACTIONS   = ['Flag', 'Warn', 'Ignore'];

async function runComplaintAgent(complaintText) {
  const prompt = COMPLAINT_PROMPT.replace('{{complaint_text}}', complaintText);
  const text   = await callGemini(prompt);
  const result = parseJSON(text);

  // Validate and sanitise fields
  const type     = VALID_TYPES.includes(result.type)         ? result.type     : 'Other';
  const priority = VALID_PRIORITY.includes(result.priority)  ? result.priority : 'Low';
  const action   = VALID_ACTIONS.includes(result.action)     ? result.action   : 'Ignore';

  return { type, priority, action };
}

module.exports = { runRegistrationAgent, runComplaintAgent };
