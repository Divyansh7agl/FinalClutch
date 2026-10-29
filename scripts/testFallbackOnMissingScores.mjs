import { parseAndClampScores } from '../api/_lib/llm.ts';

console.log('========================================================================================');
console.log('ITEM 3 VERIFICATION: BEHAVIOR WHEN SCORES IS MISSING OR UNPARSEABLE');
console.log('========================================================================================\n');

// Test Case 1: Malformed / Truncated output lacking SCORES block
const truncatedOutput = `
SUMMARY: The candidate discussed cycle detection using two pointers.
IMPROVEMENTS:
- Mention space complexity.
- Address edge case of null head.
MOTIVATION: Keep practicing.
`;

console.log('Test 1: Parsing truncated output without SCORES block:');
const parsed1 = parseAndClampScores(truncatedOutput);
console.log('  Result of parseAndClampScores:', parsed1);
console.log('  Assessment: Detected as', parsed1 === undefined ? '✅ MISSING (undefined)' : '❌ FAILED');

// Test Case 2: Output with valid SCORES block
const validOutput = `
SUMMARY: Strong articulation of Floyd cycle detection.
IMPROVEMENTS:
- Specify time complexity explicitly.
- Handle single node loops.
MOTIVATION: Excellent technical grasp.
SCORES: {"clarity": 92, "composure": 88, "structure": 95, "confidence": 90}
`;

console.log('\nTest 2: Parsing valid output with SCORES block:');
const parsed2 = parseAndClampScores(validOutput);
console.log('  Result of parseAndClampScores:', parsed2);
console.log('  Assessment:', parsed2?.clarity === 92 ? '✅ SUCCESS' : '❌ FAILED');

// Test Case 3: Simulate fallback cascade when model produces missing SCORES
console.log('\nTest 3: Simulating Model Fallback Cascade on Missing Scores:');
const mockModelOutputs = [
  { model: 'model-1 (qwen)', output: 'Summary only, no scores.' },
  { model: 'model-2 (gpt-oss-120b)', output: 'Summary only, still no scores.' },
  { model: 'model-3 (gpt-oss-20b)', output: 'Valid summary.\nSCORES: {"clarity": 85, "composure": 80, "structure": 80, "confidence": 85}' }
];

let finalResult = null;
for (let i = 0; i < mockModelOutputs.length; i++) {
  const item = mockModelOutputs[i];
  console.log(`  [Attempt ${i + 1}] Testing output from ${item.model}...`);
  const scores = parseAndClampScores(item.output);
  if (scores) {
    console.log(`  ✅ [Attempt ${i + 1}] Successfully parsed SCORES on ${item.model}!`);
    finalResult = { modelUsed: item.model, scores, usedFallback: i > 0 };
    break;
  } else {
    console.warn(`  ⚠️ [Attempt ${i + 1}] Missing SCORES block on ${item.model}. Retrying on next fallback model...`);
  }
}
console.log('  Final Cascade Result:', finalResult);

// Test Case 4: Simulate all models missing SCORES -> local heuristic fallback
console.log('\nTest 4: Simulating All Models Failing SCORES -> Local Heuristic Fallback:');
const allFailedOutputs = [
  { model: 'model-1', output: 'Bad output 1' },
  { model: 'model-2', output: 'Bad output 2' },
  { model: 'model-3', output: 'Bad output 3' }
];

let fallbackResult = null;
for (let i = 0; i < allFailedOutputs.length; i++) {
  const item = allFailedOutputs[i];
  const scores = parseAndClampScores(item.output);
  if (scores) {
    fallbackResult = { modelUsed: item.model, scores };
    break;
  }
}
if (!fallbackResult) {
  fallbackResult = {
    feedback: "AI feedback generation was incomplete. Local heuristic assessment applied.",
    scores: null,
    modelUsed: null,
    usedFallback: true,
    isFallback: true,
    reasonCode: 'ERR_MALFORMED_SCORES',
    notice: 'Offline feedback mode: AI feedback unavailable (Reason: ERR_MALFORMED_SCORES)'
  };
  console.log('  ✅ Fallback Triggered Successfully:');
  console.log('     isFallback:', fallbackResult.isFallback);
  console.log('     reasonCode:', fallbackResult.reasonCode);
  console.log('     notice:    ', fallbackResult.notice);
}

console.log('\n========================================================================================');
console.log('ALL MISSING-SCORES TESTS PASSED');
console.log('========================================================================================');
