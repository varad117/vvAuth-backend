require('dotenv').config();
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

async function test() {
 try {
  const res = await fetch("http://127.0.0.1:3000/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  const data = await res.json();
  output.innerText = data.answer || "No reply available.";
} catch (err) {
  output.innerText = "AI service error (possibly quota exceeded).";
}

}

test();
