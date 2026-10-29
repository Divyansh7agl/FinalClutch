import { execSync } from 'child_process';

const log = execSync('git log -p --all', { maxBuffer: 100 * 1024 * 1024 }).toString();

const patterns = [
  { name: 'gsk_ prefix (Groq API keys)', regex: /gsk_[A-Za-z0-9_-]+/g },
  { name: 'AIza prefix (Google/Gemini API keys)', regex: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: 'AQ. prefix (Google token/key format)', regex: /AQ\.[0-9A-Za-z_-]{20,}/g },
  { name: 'VITE_GROQ_API_KEY with value', regex: /VITE_GROQ_API_KEY\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{15,}['"]?/g },
  { name: 'VITE_GEMINI_API_KEY with value', regex: /VITE_GEMINI_API_KEY\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{15,}['"]?/g },
  { name: 'GROQ_API_KEY with value', regex: /GROQ_API_KEY\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{15,}['"]?/g },
  { name: 'GEMINI_API_KEY with value', regex: /GEMINI_API_KEY\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{15,}['"]?/g },
  { name: 'General api key string', regex: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{25,}['"]/gi }
];

console.log('=== AUDIT 1: PATTERN SEARCH IN GIT LOG DIFFS ===');
for (const p of patterns) {
  const matches = log.match(p.regex);
  if (matches) {
    console.log(`[ALERT] Pattern ${p.name}: FOUND ${matches.length} occurrences:`);
    console.log([...new Set(matches)]);
  } else {
    console.log(`[CLEAN] Pattern ${p.name}: 0 matches`);
  }
}

console.log('\n=== AUDIT 2: ALL COMMITTED FILES EVER IN TREE ===');
const allFilesRaw = execSync('git log --all --pretty=format: --name-only', { maxBuffer: 10 * 1024 * 1024 }).toString();
const allFiles = [...new Set(allFilesRaw.split('\n').map(s => s.trim()).filter(Boolean))];
const envFiles = allFiles.filter(f => f.includes('.env'));
console.log('Committed .env files ever:', envFiles.length > 0 ? envFiles : 'None');

console.log('\n=== AUDIT 3: SEARCHING COMMIT MESSAGES ===');
const commitMessages = execSync('git log --all --format="%h %s"').toString();
const keyMentions = commitMessages.split('\n').filter(line => /gsk|AIza|key|secret/i.test(line));
console.log('Commits mentioning key/secret:', keyMentions);

console.log('\n=== AUDIT 4: SEARCHING ALL COMMITTED BLOBS DIRECTLY (git grep) ===');
try {
  const grepGsk = execSync('git grep -i "gsk_" $(git rev-list --all)', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  console.log('git grep gsk_:', grepGsk.trim() || 'None');
} catch (e) {
  console.log('git grep gsk_: None');
}

try {
  const grepAiza = execSync('git grep -i "AIza" $(git rev-list --all)', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
  console.log('git grep AIza:', grepAiza.trim() || 'None');
} catch (e) {
  console.log('git grep AIza: None');
}

console.log('\n=== AUDIT 5: COMPREHENSIVE ADDED LINES CANDIDATE DETECTOR ===');
const lines = log.split('\n');
const candidates = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  const match = line.match(/(key|secret|token|auth|bearer|gemini|groq)\s*[:=]\s*['"]?([a-zA-Z0-9_\-\.]{15,})['"]?/i);
  if (match) {
    candidates.push({ line: line.trim(), val: match[2] });
  }
}
console.log('Candidate assignments found:', candidates.length);
candidates.forEach(c => console.log(' ->', c.line));
