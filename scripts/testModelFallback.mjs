import fs from 'node:fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const key = envLocal.match(/GROQ_API_KEY=(.+)/)[1].trim();

for (const model of ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b']) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an interview coach. Give a 1 sentence review.' },
          { role: 'user', content: 'Candidate explained sliding window.' }
        ],
        max_tokens: 150
      })
    });
    const data = await res.json();
    console.log(`Model [${model}]: status=${res.status}`);
    if (res.ok) {
      console.log('  content:', data.choices?.[0]?.message?.content || '(empty)');
      console.log('  reasoning:', data.choices?.[0]?.message?.reasoning?.slice(0, 50) || '(none)');
    } else {
      console.log('  error:', data.error?.message);
    }
  } catch (err) {
    console.log(`Model [${model}]: threw ${err.message}`);
  }
}
