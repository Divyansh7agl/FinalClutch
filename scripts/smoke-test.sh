#!/usr/bin/env bash
# ==============================================================================
# FinalClutch Vercel Deployment Smoke Test Suite
#
# Usage:
#   bash scripts/smoke-test.sh [TARGET_URL]
# Example:
#   bash scripts/smoke-test.sh https://finalclutch.vercel.app
#   bash scripts/smoke-test.sh http://localhost:5173
# ==============================================================================

TARGET="${1:-http://localhost:5173}"
# Strip trailing slash if present
TARGET="${TARGET%/}"

echo "================================================================================"
echo "Starting FinalClutch API Smoke Tests against: $TARGET"
echo "================================================================================"
echo ""

PASSED=0
FAILED=0

run_test() {
  local test_name="$1"
  local expected_status="$2"
  local curl_cmd="$3"

  echo "--------------------------------------------------------------------------------"
  echo "TEST: $test_name"
  echo "EXPECTED STATUS: $expected_status"

  # Execute curl and get status code plus response body
  local response
  response=$(eval "$curl_cmd -s -w '\n%{http_code}'")
  local status_code
  status_code=$(echo "$response" | tail -n 1)
  local body
  body=$(echo "$response" | sed '$d')

  echo "ACTUAL STATUS:   $status_code"
  echo "RESPONSE BODY (first 200 chars):"
  echo "${body:0:200}..."

  if [ "$status_code" -eq "$expected_status" ]; then
    echo "RESULT: PASSED"
    PASSED=$((PASSED + 1))
  else
    echo "RESULT: FAILED (Expected $expected_status, got $status_code)"
    FAILED=$((FAILED + 1))
  fi
  echo ""
}

# 1. /api/retrieve - action: questions
run_test "1. /api/retrieve (Action: questions)" 200 \
  "curl -X POST '$TARGET/api/retrieve' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"action\":\"questions\",\"query\":\"Explain React useEffect dependency array stale closures\",\"k\":2}'"

# 2. /api/retrieve - action: rubric
run_test "2. /api/retrieve (Action: rubric by id)" 200 \
  "curl -X POST '$TARGET/api/retrieve' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"action\":\"rubric\",\"questionId\":\"react-04\"}'"

# 3. /api/interview - action: generate-questions
run_test "3. /api/interview (Action: generate-questions)" 200 \
  "curl -X POST '$TARGET/api/interview' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"action\":\"generate-questions\",\"payload\":{\"context\":\"React & Node\",\"count\":2,\"difficulty\":\"medium\"}}'"

# 4. /api/interview - action: next-question
run_test "4. /api/interview (Action: next-question)" 200 \
  "curl -X POST '$TARGET/api/interview' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"action\":\"next-question\",\"payload\":{\"history\":[{\"question\":\"What is a closure?\",\"answer\":\"A function inside another function retaining outer variables.\"}],\"difficulty\":\"medium\"}}'"

# 5. /api/interview - action: followup
run_test "5. /api/interview (Action: followup)" 200 \
  "curl -X POST '$TARGET/api/interview' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"action\":\"followup\",\"payload\":{\"previousQuestion\":\"How does B-tree indexing work?\",\"previousAnswer\":\"It keeps keys sorted.\",\"difficulty\":\"hard\"}}'"

# 6. /api/interview - action: feedback
run_test "6. /api/interview (Action: feedback)" 200 \
  "curl -X POST '$TARGET/api/interview' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"action\":\"feedback\",\"payload\":{\"transcript\":\"I used a sliding window technique.\",\"delay\":2100,\"fillerCount\":1,\"confidenceScore\":85,\"responses\":[{\"questionText\":\"Longest substring without duplicates\",\"transcript\":\"Sliding window with two pointers.\",\"delay\":2100,\"fillerCount\":1}]}}'"

# 7. /api/tts
run_test "7. /api/tts (Audio synthesis)" 200 \
  "curl -X POST '$TARGET/api/tts' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{\"text\":\"Welcome to your interview.\"}'"

# 8. Bad Origin / CORS rejection
run_test "8. Security: Bad Origin Rejection" 403 \
  "curl -X POST '$TARGET/api/retrieve' \
    -H 'Content-Type: application/json' \
    -H 'Origin: https://malicious-attacker-site.com' \
    -d '{\"action\":\"questions\",\"query\":\"DSA\"}'"

# 9. Oversized Body Rejection (> 64 KB)
# Generate ~70 KB payload of padding
OVERSIZED_PAYLOAD="{\"action\":\"feedback\",\"payload\":{\"transcript\":\"$(head -c 70000 < /dev/zero | tr '\0' 'A')\"}}"
run_test "9. Security: Oversized Body Cap (Expect 413)" 413 \
  "curl -X POST '$TARGET/api/interview' \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '$OVERSIZED_PAYLOAD'"

# 10. Rate limit breach (Rapid consecutive requests on /api/interview)
echo "--------------------------------------------------------------------------------"
echo "TEST: 10. Security: Rate Limit Breach (/api/interview per-IP cap)"
echo "Sending rapid requests to trigger 429..."
BREACH_STATUS=0
for i in {1..18}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$TARGET/api/interview" \
    -H 'Content-Type: application/json' \
    -H 'Origin: $TARGET' \
    -d '{"action":"followup","payload":{"previousQuestion":"test","previousAnswer":"test"}}')
  echo "  Burst Request $i: Status $STATUS"
  if [ "$STATUS" -eq 429 ] || [ "$STATUS" -eq 503 ]; then
    BREACH_STATUS=$STATUS
    break
  fi
done

if [ "$BREACH_STATUS" -eq 429 ] || [ "$BREACH_STATUS" -eq 503 ]; then
  echo "RESULT: PASSED (Rate limiter triggered with status $BREACH_STATUS)"
  PASSED=$((PASSED + 1))
else
  echo "RESULT: FAILED (Did not receive 429 or 503 in rapid burst)"
  FAILED=$((FAILED + 1))
fi

echo ""
echo "================================================================================"
echo "SMOKE TEST SUMMARY"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "================================================================================"
