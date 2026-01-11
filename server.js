// server.js - Real AI Integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURATION ---
// Yahan apni OpenAI Key dalo (ya Environment Variable use karo)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // 👈 Sirf ye likho. String mat dalo.
});

// --- API 1: Analyze Symptoms (Powered by GPT) ---
app.post('/api/analyze', async (req, res) => {
    const { text } = req.body;
    console.log(`🤖 AI Analyzing: ${text}`);

    if (!text) return res.json({ risk: "Error", advice: "No input provided." });

    try {
        // GPT Prompt Engineering (Doctor Persona)
        const prompt = `
        Act as a Senior Consultant Doctor in India.
        Patient Symptoms: "${text}"
        
        Provide response in JSON format:
        {
            "risk": "Low/Medium/High",
            "diagnosis": "Possible Differential Diagnosis (DDx)",
            "medicine": "Suggested generic medicines with dosage (India specific)",
            "advice": "Next steps or tests",
            "specialist_needed": true/false
        }
        Keep it concise.
        `;

        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: prompt }],
            model: "gpt-3.5-turbo", // Ya gpt-4 agar budget hai
            response_format: { type: "json_object" },
        });

        const aiResponse = JSON.parse(completion.choices[0].message.content);
        
        // Send actual AI response to Extension
        res.json({
            risk: aiResponse.risk,
            advice: `<strong>DDx:</strong> ${aiResponse.diagnosis}<br><br><strong>Rx:</strong> ${aiResponse.medicine}<br><br><strong>Plan:</strong> ${aiResponse.advice}`,
            specialist_needed: aiResponse.specialist_needed
        });

    } catch (error) {
        console.error("OpenAI Error:", error);
        res.json({ risk: "Error", advice: "AI brain is currently busy.", specialist_needed: false });
    }
});

// --- API 2: Check Patient (Real DB connection logic needed here) ---
app.post('/api/check-patient', (req, res) => {
    const { phone } = req.body;
    
    // TODO: Yahan hum tumhare Firebase/SQL se connect karenge
    // Abhi ke liye Dummy rakhte hain taaki extension na tute
    if (phone === "9876543210") {
        res.json({ 
            status: "found", 
            data: { name: "Ramesh Kumar (Demo)", age: 45, gender: "M", history: "Diabetes", last_visit: "Yesterday" } 
        });
    } else {
        res.json({ status: "new", message: "No record found." });
    }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ SaathiMed Brain (AI Enabled) running on port ${PORT}`);
});
