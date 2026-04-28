import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { jsonrepair } from "jsonrepair";

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    "https://yashwanthhudumula.github.io"
  ],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 5000;
app.get("/", (req, res) => {
  res.send("🚀 MindMap AI Backend is running!");
});
/**
 * 🎯 MODEL SELECTION: 
 * Your dashboard shows 'Gemini 2.5 Flash' has a 10K daily limit.
 * Using v1beta to ensure the newest models are recognized.
 */
// 1. Switch to the v1beta endpoint to unlock newer model visibility
const API_VERSION = 'v1beta'; 

// 2. Use the model ID that matches your 10K daily limit dashboard
const MODEL_NAME = 'gemini-2.5-flash'; 

const GEMINI_URL = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

/**
 * 🧠 1. Mind Map Prompt Generation
 */
function createPrompt(topic) {
  return `You are a mind map generator. Return ONLY valid JSON.
Generate a mind map for the topic: "${topic}"

The JSON must follow this exact structure:
{
  "nodes": [
    { "id": "1", "label": "${topic}", "level": 0 },
    { "id": "2", "label": "Subtopic 1", "level": 1 },
    { "id": "3", "label": "Subtopic 2", "level": 1 },
    { "id": "4", "label": "Subtopic 3", "level": 1 },
    { "id": "5", "label": "Subtopic 4", "level": 1 },
    { "id": "6", "label": "Subtopic 5", "level": 1 }
  ],
  "edges": [
    { "from": "1", "to": "2" },
    { "from": "1", "to": "3" },
    { "from": "1", "to": "4" },
    { "from": "1", "to": "5" },
    { "from": "1", "to": "6" }
  ]
}

Rules:
- Replace "Subtopic 1...5" with real, meaningful subtopics for "${topic}"
- Return ONLY the JSON object, no markdown.`;
}

/**
 * 🔧 2. Helpers
 */
function safeParseJSON(text) {
  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(jsonrepair(cleaned));
  } catch (e) {
    console.error("Parse error:", text);
    throw new Error("Failed to parse AI response.");
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 1000));
}

/**
 * 🔥 3. AI Service Call
 */
async function callGemini(prompt, retries = 3, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(GEMINI_URL, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      });
      return safeParseJSON(response.data.candidates[0].content.parts[0].text);
    } catch (err) {
      if (err.response?.status === 429 && attempt < retries) {
        console.warn(`Attempt ${attempt} limited. Retrying...`);
        await sleep(delayMs);
        delayMs *= 2;
      } else {
        throw err;
      }
    }
  }
}

/**
 * 🚀 4. The Route
 */
app.post("/generate", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Topic required" });

    const prompt = createPrompt(topic);
    const data = await callGemini(prompt);
    res.json(data);
  } catch (err) {
    console.error("Backend error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data?.error?.message || err.message 
    });
  }
});

/**
 * 🔍 5. Expand Prompt
 */
function createExpandPrompt(label) {
  return `You are a mind map expander. Return ONLY valid JSON.
Expand the concept: "${label}"

Return exactly this structure:
{
  "nodes": [
    { "id": "1", "label": "${label}", "level": 0 },
    { "id": "2", "label": "Aspect 1", "level": 1 },
    { "id": "3", "label": "Aspect 2", "level": 1 },
    { "id": "4", "label": "Aspect 3", "level": 1 }
  ],
  "edges": [
    { "from": "1", "to": "2" },
    { "from": "1", "to": "3" },
    { "from": "1", "to": "4" }
  ]
}

Rules:
- Replace "Aspect 1...3" with real, meaningful sub-aspects of "${label}"
- Labels must be max 3 words
- Return ONLY the JSON object, no markdown.`;
}

/**
 * 🚀 5. Expand Route
 */
app.post("/expand", async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: "Label required" });

    const prompt = createExpandPrompt(label);
    const data = await callGemini(prompt);
    res.json(data);
  } catch (err) {
    console.error("Expand error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({
      error: err.response?.data?.error?.message || err.message
    });
  }
});

app.listen(PORT, () => console.log(`Server live on port ${PORT} using ${MODEL_NAME}`));
