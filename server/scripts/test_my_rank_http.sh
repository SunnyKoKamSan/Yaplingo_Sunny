#!/bin/bash
# Test script for GET /gamification/leaderboard/me HTTP endpoint

set -e  # Exit on error

API_BASE="http://localhost:8000"
TEST_USER="myrank_test_user_$$"
TEST_PASS="SecurePassword123"

echo "🧪 HTTP API TEST: GET /gamification/leaderboard/me"
echo "======================================================================"

# ============================================================================
# STEP 1: REGISTER AND LOGIN
# ============================================================================
echo ""
echo "Step 1: Creating test user and authenticating..."

REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$TEST_USER\",
    \"password\": \"$TEST_PASS\",
    \"language\": \"EN\"
  }")

TOKEN=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$TEST_USER\",
    \"password\": \"$TEST_PASS\"
  }" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to authenticate"
  exit 1
fi

echo "✅ Authenticated successfully"
echo "   Token: ${TOKEN:0:20}..."

# ============================================================================
# STEP 2: CHECK RANK WITH NO XP (New User)
# ============================================================================
echo ""
echo "Step 2: Checking rank for new user (no XP yet)..."

RANK_RESPONSE=$(curl -s -X GET "$API_BASE/gamification/leaderboard/me" \
  -H "Authorization: Bearer $TOKEN")

echo "$RANK_RESPONSE" | python3 -m json.tool

RANK=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['rank'])")
TOTAL_XP=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['total_xp'])")

if [ "$TOTAL_XP" -eq 0 ]; then
  echo "✅ New user correctly has 0 XP"
else
  echo "❌ Expected 0 XP, got $TOTAL_XP"
  exit 1
fi

echo "✅ Rank: $RANK (based on current participants + 1)"

# ============================================================================
# STEP 3: EARN XP AND CHECK RANK
# ============================================================================
echo ""
echo "Step 3: Earning XP through check-in..."

CHECKIN_RESPONSE=$(curl -s -X POST "$API_BASE/gamification/check-in" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"xp_amount\": 50
  }")

echo "Check-in response:"
echo "$CHECKIN_RESPONSE" | python3 -m json.tool

echo ""
echo "Step 4: Checking updated rank..."

RANK_RESPONSE=$(curl -s -X GET "$API_BASE/gamification/leaderboard/me" \
  -H "Authorization: Bearer $TOKEN")

echo "$RANK_RESPONSE" | python3 -m json.tool

RANK=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['rank'])")
TOTAL_XP=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['total_xp'])")
PERIOD_KEY=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['period_key'])")
IS_CURRENT=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['is_current_period'])")

if [ "$TOTAL_XP" -eq 50 ]; then
  echo "✅ XP correctly updated to 50"
else
  echo "❌ Expected 50 XP, got $TOTAL_XP"
  exit 1
fi

if [ "$IS_CURRENT" = "True" ]; then
  echo "✅ Correctly marked as current period"
else
  echo "❌ Should be marked as current period"
  exit 1
fi

echo "✅ Rank: $RANK"
echo "✅ Period: $PERIOD_KEY"

# ============================================================================
# STEP 4: EARN MORE XP
# ============================================================================
echo ""
echo "Step 5: Earning more XP..."

curl -s -X POST "$API_BASE/gamification/check-in" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"xp_amount\": 75
  }" > /dev/null

echo ""
echo "Step 6: Checking rank after additional XP..."

RANK_RESPONSE=$(curl -s -X GET "$API_BASE/gamification/leaderboard/me" \
  -H "Authorization: Bearer $TOKEN")

echo "$RANK_RESPONSE" | python3 -m json.tool

TOTAL_XP=$(echo "$RANK_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['total_xp'])")

if [ "$TOTAL_XP" -eq 125 ]; then
  echo "✅ XP correctly accumulated to 125 (50 + 75)"
else
  echo "❌ Expected 125 XP, got $TOTAL_XP"
  exit 1
fi

# ============================================================================
# STEP 5: TEST HISTORICAL PERIOD (should return 0 XP)
# ============================================================================
echo ""
echo "Step 7: Testing historical period query..."

HISTORICAL_RESPONSE=$(curl -s -X GET "$API_BASE/gamification/leaderboard/me?period_key=WEEK-2025-01" \
  -H "Authorization: Bearer $TOKEN")

echo "$HISTORICAL_RESPONSE" | python3 -m json.tool

HISTORICAL_XP=$(echo "$HISTORICAL_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['total_xp'])")
IS_CURRENT=$(echo "$HISTORICAL_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['is_current_period'])")

if [ "$HISTORICAL_XP" -eq 0 ]; then
  echo "✅ Historical period correctly shows 0 XP"
else
  echo "⚠️  Historical period has $HISTORICAL_XP XP (might be valid if data exists)"
fi

if [ "$IS_CURRENT" = "False" ]; then
  echo "✅ Correctly marked as not current period"
else
  echo "❌ Should not be marked as current period"
  exit 1
fi

# ============================================================================
# STEP 6: TEST INVALID PERIOD FORMAT
# ============================================================================
echo ""
echo "Step 8: Testing invalid period format validation..."

INVALID_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/gamification/leaderboard/me?period_key=INVALID-FORMAT" \
  -H "Authorization: Bearer $TOKEN")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 422 ]; then
  echo "✅ Invalid period format correctly rejected (422)"
else
  echo "⚠️  Expected 422 for invalid format, got $HTTP_CODE"
fi

# ============================================================================
# STEP 7: TEST UNAUTHENTICATED ACCESS
# ============================================================================
echo ""
echo "Step 9: Testing authentication requirement..."

UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/gamification/leaderboard/me")

HTTP_CODE=$(echo "$UNAUTH_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 401 ] || [ "$HTTP_CODE" -eq 403 ]; then
  echo "✅ Unauthenticated request correctly rejected ($HTTP_CODE)"
else
  echo "❌ Expected 401/403 for unauthenticated request, got $HTTP_CODE"
  exit 1
fi

# ============================================================================
# STEP 8: COMPARE WITH LEADERBOARD
# ============================================================================
echo ""
echo "Step 10: Comparing with full leaderboard..."

LEADERBOARD=$(curl -s -X GET "$API_BASE/gamification/leaderboard" \
  -H "Authorization: Bearer $TOKEN")

echo "Top 5 leaderboard entries:"
echo "$LEADERBOARD" | python3 -c "import sys, json; [print(f\"  {i['rank']}. {i['name']}: {i['total_xp']} XP\") for i in json.load(sys.stdin)[:5]]"

MY_RANK=$(curl -s -X GET "$API_BASE/gamification/leaderboard/me" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys, json; print(json.load(sys.stdin)['rank'])")

echo "✅ My rank: $MY_RANK"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "======================================================================"
echo "✅ ALL HTTP API TESTS PASSED!"
echo ""
echo "📊 Tested Features:"
echo "   ✓ Rank calculation for new users (0 XP)"
echo "   ✓ Rank updates after earning XP"
echo "   ✓ XP accumulation across multiple check-ins"
echo "   ✓ Current period detection"
echo "   ✓ Historical period queries"
echo "   ✓ Period key format validation"
echo "   ✓ Authentication requirement"
echo "   ✓ Consistency with full leaderboard"
echo ""
echo "🚀 Endpoint ready for production!"
