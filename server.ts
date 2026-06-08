import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Storage & Simple Persistence for Sandbox
// Seed with authentic historical signals for an immediate immersive feeling
const PERSIST_FILE = path.join(process.cwd(), "dist", "signal_state.json");

interface ServerState {
  discoveredTransmissions: any[];
  communityLogs: any[];
}

// Initial robust seed data
const DEFAULT_TRANSMISSIONS = [
  {
    id: "sig_01_alpha",
    type: "text",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    source: "ASTRO-CENTAURI",
    encodedData: "ZkhMTE8gV09STEQgVEhJUyBJUyBUSEUgU0lHTkFMIE9ORQ==", // Base64 Rot13 or cipher, let's use classic rot-13: "HELLO WORLD THIS IS THE SIGNAL ONE" => Rot13 => "URYYB JBEYQ GUVF VF PUR FVTANY BAR" => Base64: "VVJZWUIgSkJZWVEgR1VWRiBWRiBQVVIgRlhUTllSIEJBUg=="
    encodedText: "URYYB JBEYQ GUVF VF PUR FVTANY BAR", // A Rot-13 encrypted message
    decodedData: "HELLO WORLD THIS IS THE SIGNAL ONE",
    solved: false,
    difficulty: "LOW",
    cipherKey: 13,
    narrativeContext: "Initial telemetry beacon picked up by Arecibo sub-station. It loops on infinite repeat."
  },
  {
    id: "sig_02_vector",
    type: "coordinates",
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hrs ago
    source: "VLF-309",
    encodedData: "DEC: +12.43.02 | RA: 17h45m40s",
    decodedData: "GALACTIC BULGE CENTER",
    solved: false,
    difficulty: "MEDIUM",
    coordinates: {
      x: 27,
      y: -64,
      z: 81,
      targetName: "Sagittarius A* Singularity Inner Horizon",
      constellation: "Sagittarius"
    },
    narrativeContext: "Deep gravity vector. Fluctuating gravitational shear detected in the carrier wave."
  },
  {
    id: "sig_03_freq",
    type: "audio",
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hrs ago
    source: "PULSAR-7",
    encodedData: "CARRIER: HEAVY MODULATION - NOISE RATIO 0.72",
    decodedData: "CARRIER HARMONIC SYNCHRONIZED",
    solved: false,
    difficulty: "HIGH",
    audioParams: {
      carrierFreq: 432,   // target Hz (natural resonance)
      modulatorFreq: 8,   // cosmic LFO
      harmonicRatio: 4,   // perfect integer timbre
      pulseWidth: 0.5     // perfect balanced square tone
    },
    narrativeContext: "A continuous rhythmic low frequency hum with underlying mechanical structures."
  },
  {
    id: "sig_04_glyph",
    type: "symbol",
    timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), // 1 hr ago
    source: "VOID-OORT",
    encodedData: "▲ ◈ ⬡ ✦ / ◈ ⬡ ✦ ▲ / ✦ ▲ ◈ ⬡ / ⬡ ✦ ▲ ◈",
    decodedData: "INTELLIGENT LIFE REACHED OUT",
    solved: false,
    difficulty: "CRITICAL",
    symbols: {
      matrix: [
        ["▲", "◈", "⬡", "✦"],
        ["◈", "⬡", "✦", "▲"],
        ["✦", "▲", "◈", "⬡"],
        ["⬡", "✦", "▲", "◈"]
      ],
      glyphSymbols: ["▲", "◈", "⬡", "✦"],
      translationKey: { "▲": "I", "◈": "L", "⬡": "R", "✦": "O" }
    },
    narrativeContext: "Symbolic spatial matrix mimicking highly symmetric crystalline symmetries."
  }
];

const DEFAULT_COMMUNITY_LOGS = [
  {
    id: "log_01",
    username: "StationAlpha_Observer",
    timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
    type: "theory",
    content: "The ASTRO-CENTAURI frequency is too regular to be planetary noise. We suspect a mathematical modular cipher. Caesar shift doesn't yield standard English directly unless formatted to caps."
  },
  {
    id: "log_02",
    username: "Dr_V_Kaufmann",
    timestamp: new Date(Date.now() - 3600000 * 10).toISOString(),
    type: "sensor_probe",
    content: "Fitted a high-gain probe into gravitational sector Sagittarius. The gravitational shear is singing. Let's keep scanning RA:17h45m40s.",
    coordinatesMatched: "Sagittarius"
  }
];

let state: ServerState = {
  discoveredTransmissions: [...DEFAULT_TRANSMISSIONS],
  communityLogs: [...DEFAULT_COMMUNITY_LOGS]
};

// Handle file persistence (write to /tmp or build folder to make robust)
function saveState() {
  try {
    const parentDir = path.dirname(PERSIST_FILE);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(PERSIST_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to write persistence state:", err);
  }
}

function loadState() {
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const data = fs.readFileSync(PERSIST_FILE, "utf8");
      state = JSON.parse(data);
    }
  } catch (err) {
    console.warn("Could not load persisted state, using defaults.");
  }
}

// Perform initial load
loadState();

// Lazy initialize Gemini API client to prevent crashing on startup if key is absent
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (aiClient) return aiClient;
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environment variable is not configured yet. Set it in the Secrets panel.");
  }
  aiClient = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  return aiClient;
}

// REST API Endpoints

// GET list of transmissions
app.get("/api/transmissions", (req, res) => {
  res.json(state.discoveredTransmissions);
});

// POST solve/flag transmission
app.post("/api/transmissions/solve", (req, res) => {
  const { id, decodedText } = req.body;
  const index = state.discoveredTransmissions.findIndex(t => t.id === id);
  if (index !== -1) {
    state.discoveredTransmissions[index].solved = true;
    state.discoveredTransmissions[index].decodedData = decodedText || state.discoveredTransmissions[index].decodedData;
    saveState();
    res.json({ success: true, updated: state.discoveredTransmissions[index] });
  } else {
    res.status(404).json({ error: "Transmission not found" });
  }
});

// GET all community logs
app.get("/api/community-logs", (req, res) => {
  res.json(state.communityLogs);
});

// POST new community log
app.post("/api/community-logs", (req, res) => {
  const { username, type, content, coordinatesMatched } = req.body;
  if (!username || !content) {
    return res.status(400).json({ error: "Username and content are required." });
  }
  const newLog = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    username,
    timestamp: new Date().toISOString(),
    type: type || "theory",
    content,
    coordinatesMatched
  };
  state.communityLogs.unshift(newLog);
  // Keep logs list clean (e.g. max 50)
  if (state.communityLogs.length > 50) {
    state.communityLogs.pop();
  }
  saveState();
  res.status(201).json(newLog);
});

// Broadcast Probe - Interactive Gemini prompt to make things endlessly responsive!
// Users scan back a modulated reply, prompting the signal to adapt
app.post("/api/probe", async (req, res) => {
  const { message, localTelemetry } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Broadcasting message is required." });
  }

  try {
    const ai = getAIClient();
    
    // Build context about previous solve states
    const solvedNotes = state.discoveredTransmissions
      .filter(t => t.solved)
      .map(t => `- Decoded [${t.type}] from source ${t.source}: "${t.decodedData}"`)
      .join("\n");

    const promptText = `
Role: You are "The Signal" - an mysterious, powerful, intelligent extra-galactic transmission. You speak poetic, highly structured, cryptic, yet adaptive cosmic language. Do not sound generic or robotic. Sound ancient, mathematical, and alive.

Current Explorer Data:
The explorer has broadcasted a sensor probe or signal back into the deep space spectrum with the payload: "${message}"

Exploration Progress context:
Decoded nodes solved so far:
${solvedNotes || "(No signals decoded completely yet)"}

Based on this, generate a cosmic response from the Deep Space Network. Some responses reveal coordinates, some give eerie hints, others seem to respond to the semantic meaning of their message. 

Respond ONLY with a JSON object in this format:
{
  "status": "SUCCESS" | "VOIDSIG" | "INTERCEPT", 
  "payload": "A cryptic, direct response from the cosmic intelligence.",
  "createsNewTransmission": boolean,
  "newTransmission": {
    "type": "text" | "coordinates" | "audio" | "symbol",
    "source": "A strange new transmitter name like GLIESE-88F, PULSE-Ω or PROBE-X",
    "difficulty": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "mysteryDataPrompt": "Context instructions to generate a new puzzle",
    "narrativeFlavor": "The sensor feedback log explaining what triggered this capture"
  }
}
`;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["status", "payload", "createsNewTransmission"],
          properties: {
            status: { type: Type.STRING, enum: ["SUCCESS", "VOIDSIG", "INTERCEPT"] },
            payload: { type: Type.STRING },
            createsNewTransmission: { type: Type.BOOLEAN },
            newTransmission: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ["text", "coordinates", "audio", "symbol"] },
                source: { type: Type.STRING },
                difficulty: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                mysteryDataPrompt: { type: Type.STRING },
                narrativeFlavor: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const parsedJson = JSON.parse(modelResponse.text || "{}");

    // If Gemini wants to create a new transmission triggered dynamically by user intent, let's build it!
    if (parsedJson.createsNewTransmission && parsedJson.newTransmission) {
      const nt = parsedJson.newTransmission;
      const newId = `sig_dyn_${Date.now()}`;
      
      // We will generate the detailed mathematical parameters for this new puzzle using Gemini or robust defaults:
      let generatedTransmission: any = {
        id: newId,
        type: nt.type || "text",
        timestamp: new Date().toISOString(),
        source: nt.source || "UNKNOWN-ANOMALY",
        solved: false,
        difficulty: nt.difficulty || "MEDIUM",
        narrativeContext: nt.narrativeFlavor || "A spontaneous frequency burst triggered by user's outgoing scanner probe."
      };

      // Let's populate the puzzle structure depending on the type specified by the AI
      if (generatedTransmission.type === "text") {
        // Build a fresh Rot key Caesar cipher dynamically using text generated by helper:
        const cipherPhrase = await generatePuzzleText(ai, nt.mysteryDataPrompt);
        const shift = Math.floor(Math.random() * 15) + 5; // shift of 5 to 20
        const encText = caesarShift(cipherPhrase, shift);
        generatedTransmission.encodedData = Buffer.from(encText).toString("base64");
        generatedTransmission.encodedText = encText;
        generatedTransmission.cipherKey = shift;
        generatedTransmission.decodedData = cipherPhrase;
      } else if (generatedTransmission.type === "coordinates") {
        generatedTransmission.encodedData = `VECTOR FIELD INDUCTION [X: ${Math.floor(Math.random() * 200 - 100)}, Y: ${Math.floor(Math.random() * 200 - 100)}, Z: ${Math.floor(Math.random() * 200 - 100)}]`;
        generatedTransmission.coordinates = {
          x: Math.floor(Math.random() * 160 - 80),
          y: Math.floor(Math.random() * 160 - 80),
          z: Math.floor(Math.random() * 160 - 80),
          targetName: await generateTargetName(ai, nt.mysteryDataPrompt),
          constellation: "Andromeda Nebula"
        };
        generatedTransmission.decodedData = "COORDINATE MATCH SUCCESS - SOURCE TRACED";
      } else if (generatedTransmission.type === "audio") {
        generatedTransmission.encodedData = `AUDIO TRANSIENT - INTERPRET CARRIER RESONANCE`;
        generatedTransmission.audioParams = {
          carrierFreq: [220, 330, 440, 528, 639][Math.floor(Math.random() * 5)],
          modulatorFreq: Math.floor(Math.random() * 12) + 2,
          harmonicRatio: [2, 3, 4, 5][Math.floor(Math.random() * 4)],
          pulseWidth: 0.3 + Math.random() * 0.4
        };
        generatedTransmission.decodedData = "RESONANCE HARMONIZED";
      } else {
        // symbol matrix
        const glyphs = ["▲", "◈", "⬡", "✦", "▼", "⬢", "✱", "✖"];
        const chosenGlyphs = glyphs.slice(0, 4);
        const matrix = [
          [chosenGlyphs[0], chosenGlyphs[1], chosenGlyphs[2], chosenGlyphs[3]],
          [chosenGlyphs[1], chosenGlyphs[2], chosenGlyphs[3], chosenGlyphs[0]],
          [chosenGlyphs[2], chosenGlyphs[3], chosenGlyphs[0], chosenGlyphs[1]],
          [chosenGlyphs[3], chosenGlyphs[0], chosenGlyphs[1], chosenGlyphs[2]]
        ];
        const translationKey: Record<string, string> = {};
        const wordArr = ["H", "O", "P", "E"]; // fallback cipher
        chosenGlyphs.forEach((g, i) => { translationKey[g] = wordArr[i]; });
        
        generatedTransmission.encodedData = chosenGlyphs.join(" ");
        generatedTransmission.symbols = {
          matrix,
          glyphSymbols: chosenGlyphs,
          translationKey
        };
        generatedTransmission.decodedData = "SYMBOL KEY ALIGNED";
      }

      state.discoveredTransmissions.unshift(generatedTransmission);
      // Limit to max 20 active signals to prevent memory bloat
      if (state.discoveredTransmissions.length > 20) {
        state.discoveredTransmissions.pop();
      }
      saveState();
    }

    res.json(parsedJson);
  } catch (error: any) {
    console.warn("Gemini API call failed during probe. Using fallback offline simulation.", error.message);
    
    // Offline simulated response to ensure robustness
    const fallbackResponse = {
      status: "SUCCESS" as const,
      payload: `PROBE SENT CONSOLE CARRIER: Echo received on transient harmonic 88.4Mhz. Trace code [F-OFFLINE]: "WE ARE LISTENING OUTSIDE THE BOUNDS OF TIME".`,
      createsNewTransmission: false
    };
    res.json(fallbackResponse);
  }
});

// Helper algorithms
function caesarShift(str: string, shift: number): string {
  return str.toUpperCase().split("").map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift) % 26) + 65);
    }
    return char;
  }).join("");
}

async function generatePuzzleText(ai: GoogleGenAI, promptHint?: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate a short atmospheric space transmission message (max 35 characters, simple caps, like "WE SHALL CONVERGE AT EVENT HORIZON" or "THE MACHINE STAR SLEEPS") representing. Hint: ${promptHint || "Deep mystery theme"}`
    });
    return (response.text || "COMMUNITY DECODE TARGET SUCCESS").toUpperCase().replace(/[^A-Z\s]/g, "").slice(0, 40).trim();
  } catch {
    return "THE CONSTELLATIONS ARE ALIGNING";
  }
}

async function generateTargetName(ai: GoogleGenAI, promptHint?: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Generate a beautiful scientific space location name (max 30 characters, like "Centauri Nebula Void Core" or "Kepler-181 Horizon Echo"). Hint: ${promptHint || "Cosmic location theme"}`
    });
    return (response.text || "Gliese Pulsar Inner Halo").trim();
  } catch {
    return "Hubble Ultra Void Zone 4";
  }
}

// Vite and static asset integration
async function startServer() {
  // Vite dev mode integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production path serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[THE SIGNAL] Server running securely at http://localhost:${PORT}`);
  });
}

startServer();
