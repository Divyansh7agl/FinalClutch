import fs from 'node:fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const key = envLocal.match(/GROQ_API_KEY=(.+)/)[1].trim();

const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: 'You are an interview coach. Provide:\nSUMMARY: ...\nIMPROVEMENTS: ...\nMOTIVATION: ...\nSCORES: {"clarity": 80, "composure": 80, "structure": 80, "confidence": 80}' },
      { role: 'user', content: 'Candidate explained sliding window.' }
    ],
    max_tokens: 850
  })
});

const data = await res.json();
console.log('--- CONTENT ---');
console.log(data.choices?.[0]?.message?.content);
console.log('--- REASONING LENGTH ---');
console.log(data.choices?.[0]?.message?.reasoning?.length);
