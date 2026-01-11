// server.js - Fully Integrated with Firebase & OpenAI
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const admin = require('firebase-admin');

// --- 1. FIREBASE CONNECTION (The Bridge) ---
// Local testing ke liye file use karega, Render ke liye ENV use karega
let serviceAccount;

if (process.env.FIREBASE_PRIVATE_KEY) {
    // Render (Production) Logic
    serviceAccount = {
        "type": "service_account",
        "project_id": process.env.FIREBASE_PROJECT_ID,
        "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
        "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        "client_email": process.env.FIREBASE_CLIENT_EMAIL,
        "client_id": process.env.FIREBASE_CLIENT_ID,
    };
} else {
    // Local Logic (Laptop)
    try {
        serviceAccount = require('./firebase-key.json');
    } catch (e) {
        console.error("❌ Error: firebase-key.json nahi mila. Local testing fail ho sakti hai.");
    }
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("🔥 Firebase Connected Successfully!");
}

const db = admin.firestore();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

app.use(cors());
app.use(bodyParser.json());

// ✅ Browser Testing Route (Add this)
app.get('/', (req, res) => {
    res.send("🚀 SaathiMed Server is LIVE! WhatsApp Bot is listening on /api/whatsapp-webhook");
});

// --- API 1: EXTENSION - CHECK PATIENT (Real DB) ---
app.post('/api/check-patient', async (req, res) => {
    const { phone } = req.body;
    console.log(`🔎 Searching Database for: ${phone}`);

    try {
        // Firebase me 'users' ya 'patients' collection check karega
        const userRef = db.collection('patients').doc(phone);
        const doc = await userRef.get();

        if (doc.exists) {
            const data = doc.data();
            // Data format karke bhejo
            res.json({
                status: "found",
                data: {
                    name: data.name || "Unknown",
                    age: data.age || "--",
                    gender: data.gender || "--",
                    history: data.medical_history || "No records found",
                    last_visit: data.last_visit_date || "New"
                }
            });
        } else {
            res.json({ status: "new", message: "Patient not in database." });
        }
    } catch (error) {
        console.error("Firebase Error:", error);
        res.status(500).json({ status: "error" });
    }
});

// --- API 2: EXTENSION - ONBOARD PATIENT (Write to DB) ---
app.post('/api/onboard', async (req, res) => {
    const { phone } = req.body;
    
    try {
        // Naya patient document banao
        await db.collection('patients').doc(phone).set({
            phone: phone,
            created_at: new Date().toISOString(),
            onboarding_status: "PENDING_VIA_WHATSAPP", // Flag taaki WhatsApp bot pakad le
            medical_history: "None yet"
        }, { merge: true });

        console.log(`✅ New Patient Created via Extension: ${phone}`);
        
        // Future: Send WhatsApp "Hi" message here
        res.json({ success: true, message: "Profile Created. WhatsApp link sent." });

    } catch (error) {
        console.error("Onboard Error:", error);
        res.status(500).json({ success: false });
    }
});

// --- API 3: WHATSAPP BOT (Syncs with Firebase) ---
app.post('/api/whatsapp-webhook', async (req, res) => {
    const { phone, text } = req.body;
    
    try {
        const userRef = db.collection('patients').doc(phone);
        const doc = await userRef.get();
        let userData = doc.exists ? doc.data() : null;

        // SCENARIO 1: New User (Not in DB)
        if (!userData) {
            await sendReply(phone, "नमस्ते! SaathiMed में आपका स्वागत है।\nकृप्या अपना पूरा नाम बताएं?");
            // Temp create doc to track state
            await userRef.set({ phone: phone, bot_state: "ASK_NAME" });
            return res.json({ status: "reply_sent" });
        }

        // SCENARIO 2: Registration Flow
        if (userData.bot_state === "ASK_NAME") {
            await userRef.update({ name: text, bot_state: "ASK_AGE" });
            await sendReply(phone, `धन्यवाद ${text}! अब अपनी उम्र (Age) बताएं?`);
            return res.json({ status: "reply_sent" });
        }

        if (userData.bot_state === "ASK_AGE") {
            await userRef.update({ age: text, bot_state: "REGISTERED" });
            await sendReply(phone, "✅ आपका हेल्थ कार्ड बन गया है! अब आप डॉक्टर से कनेक्टेड हैं।");
            return res.json({ status: "registered" });
        }

        // SCENARIO 3: AI Advice (Using Context from DB)
        if (userData.bot_state === "REGISTERED" || !userData.bot_state) {
            
            // 🔥 Context from Real DB
            const context = `Name: ${userData.name}, Age: ${userData.age}, History: ${userData.medical_history}`;
            
            const gptResponse = await openai.chat.completions.create({
                messages: [{ 
                    role: "system", 
                    content: `You are SaathiMed AI. Context: ${context}. User asks: "${text}". Reply in Hindi/Hinglish safely.` 
                }],
                model: "gpt-3.5-turbo",
            });

            await sendReply(phone, gptResponse.choices[0].message.content);
        }

        res.json({ success: true });

    } catch (error) {
        console.error("Bot Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Helper Function
async function sendReply(phone, msg) {
    console.log(`📤 WhatsApp to ${phone}: ${msg}`);
    // Interakt Code will go here
}

// --- API 4: DOCTOR SYNC (Update DB & Notify) ---
app.post('/api/doctor-update', async (req, res) => {
    const { phone, diagnosis, medicine } = req.body;
    
    try {
        // 1. Update Firebase
        await db.collection('patients').doc(phone).update({
            medical_history: admin.firestore.FieldValue.arrayUnion({
                date: new Date().toISOString(),
                diagnosis: diagnosis,
                rx: medicine
            }),
            last_visit_date: new Date().toISOString()
        });

        // 2. Notify Patient
        await sendReply(phone, `👨‍⚕️ डॉक्टर अपडेट: आपको '${diagnosis}' डिटेक्ट हुआ है।\nदवा: ${medicine}\nआराम करें।`);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 SaathiMed Connected to Firebase on port ${PORT}`);
});
