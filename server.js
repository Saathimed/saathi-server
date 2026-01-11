const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Allow requests from anywhere (Extension support)
app.use(cors());
app.use(bodyParser.json());

// --- MOCK DATABASE (असली में यह MongoDB/Firebase होगा) ---
const patients = {
    "9876543210": { name: "Ramesh Kumar", age: 45, gender: "M", history: "Diabetes, Hypertension", last_visit: "10 Aug 2024" },
    "9988776655": { name: "Sita Devi", age: 32, gender: "F", history: "Anemia", last_visit: "02 Sep 2024" }
};

// Root Route (Check karne ke liye ki server zinda hai ya nahi)
app.get('/', (req, res) => {
    res.send("✅ SaathiMed Brain is Active & Running!");
});

// --- API 1: Check Patient Profile ---
app.post('/api/check-patient', (req, res) => {
    const { phone } = req.body;
    console.log(`🔎 Searching: ${phone}`);

    if (patients[phone]) {
        res.json({ status: "found", data: patients[phone] });
    } else {
        res.json({ status: "new", message: "No record found." });
    }
});

// --- API 2: Onboard Patient ---
app.post('/api/onboard', (req, res) => {
    const { phone } = req.body;
    console.log(`📲 Onboarding: ${phone}`);
    // Future: Yahan SMS/WhatsApp API integrate hoga
    res.json({ success: true, message: "Link sent." });
});

// --- API 3: AI Analysis (Simple Logic) ---
app.post('/api/analyze', (req, res) => {
    const { text } = req.body;
    if (!text) return res.json({ risk: "Unknown", advice: "No text provided." });
    
    const lowerText = text.toLowerCase();
    let risk = "Low";
    let advice = "General observation required. Monitor vitals.";
    let specialist_needed = false;

    // Basic Rule Engine
    if (lowerText.includes("chest") || lowerText.includes("sweating") || lowerText.includes("breath")) {
        risk = "HIGH (Cardiac Risk)";
        advice = "Immediate ECG required. Do not delay. Refer to Cardiologist.";
        specialist_needed = true;
    } else if (lowerText.includes("fever") && lowerText.includes("joint")) {
        risk = "Medium (Possible Dengue)";
        advice = "Check Platelet count. Ensure Hydration.";
    } else if (lowerText.includes("sugar") || lowerText.includes("dizzy")) {
        risk = "Medium (Hypoglycemia Risk)";
        advice = "Check RBS immediately. Give glucose if low.";
    }

    res.json({ risk, advice, specialist_needed });
});

// Start Server (Render uses process.env.PORT)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});