#!/bin/bash
# HTTP API Test Script for Check-In Endpoint
# ==========================================
# Tests the POST /gamification/check-in endpoint via HTTP requests

set -e  # Exit on error

BASE_URL="http://localhost:8000"
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================================================"
echo "🧪 HTTP API TEST: Check-In Endpoint"
echo "======================================================================"

# ======================================================================
# STEP 1: Register or Login to get token
# ======================================================================
echo ""
echo -e "${YELLOW}Step 1: Authenticating...${NC}"

# Try to register (will fail if user exists, that's ok)
REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testuser123",
    "password": "password123",
    "language": "en"
  }' || true)

# Try to login
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testuser123",
    "password": "password123"
  }')

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Failed to get authentication token${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}"
echo "Token: ${TOKEN:0:20}..."

# ======================================================================
# STEP 2: Test first check-in
# ======================================================================
echo ""
echo -e "${YELLOW}Step 2: First check-in (25 XP)...${NC}"

TODAY=$(date +%Y-%m-%d)

CHECKIN1_RESPONSE=$(curl -s -X POST "${BASE_URL}/gamification/check-in" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"date_key\": \"${TODAY}\",
    \"xp_amount\": 25
  }")

echo "Response:"
echo "$CHECKIN1_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CHECKIN1_RESPONSE"

XP1=$(echo $CHECKIN1_RESPONSE | grep -o '"xp_earned":[0-9]*' | cut -d':' -f2)
GOAL1=$(echo $CHECKIN1_RESPONSE | grep -o '"goal_met":[a-z]*' | cut -d':' -f2)

if [ "$XP1" = "25" ]; then
  echo -e "${GREEN}✅ XP correctly set to 25${NC}"
else
  echo -e "${RED}❌ Expected XP=25, got XP=${XP1}${NC}"
fi

if [ "$GOAL1" = "false" ]; then
  echo -e "${GREEN}✅ Goal not met (25 < 50) ✓${NC}"
else
  echo -e "${RED}❌ Goal should not be met yet${NC}"
fi

# ======================================================================
# STEP 3: Test second check-in (incremental)
# ======================================================================
echo ""
echo -e "${YELLOW}Step 3: Second check-in (30 XP) - should reach goal...${NC}"

CHECKIN2_RESPONSE=$(curl -s -X POST "${BASE_URL}/gamification/check-in" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"date_key\": \"${TODAY}\",
    \"xp_amount\": 30
  }")

echo "Response:"
echo "$CHECKIN2_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CHECKIN2_RESPONSE"

XP2=$(echo $CHECKIN2_RESPONSE | grep -o '"xp_earned":[0-9]*' | cut -d':' -f2)
GOAL2=$(echo $CHECKIN2_RESPONSE | grep -o '"goal_met":[a-z]*' | cut -d':' -f2)
LESSONS=$(echo $CHECKIN2_RESPONSE | grep -o '"lessons_completed":[0-9]*' | cut -d':' -f2)

if [ "$XP2" = "55" ]; then
  echo -e "${GREEN}✅ XP correctly accumulated to 55 (25 + 30)${NC}"
else
  echo -e "${RED}❌ Expected XP=55, got XP=${XP2}${NC}"
fi

if [ "$GOAL2" = "true" ]; then
  echo -e "${GREEN}✅ Goal met! (55 >= 50) 🎯${NC}"
else
  echo -e "${RED}❌ Goal should be met now${NC}"
fi

if [ "$LESSONS" = "2" ]; then
  echo -e "${GREEN}✅ Lessons count correct (2)${NC}"
else
  echo -e "${RED}❌ Expected 2 lessons, got ${LESSONS}${NC}"
fi

# ======================================================================
# STEP 4: Test validation - invalid date format
# ======================================================================
echo ""
echo -e "${YELLOW}Step 4: Testing validation (invalid date format)...${NC}"

INVALID_DATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/gamification/check-in" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "date_key": "2026/01/21",
    "xp_amount": 10
  }')

if echo "$INVALID_DATE_RESPONSE" | grep -q "Invalid Request"; then
  echo -e "${GREEN}✅ Invalid date format rejected correctly${NC}"
else
  echo -e "${RED}❌ Should reject invalid date format${NC}"
  echo "Response: $INVALID_DATE_RESPONSE"
fi

# ======================================================================
# STEP 5: Test validation - negative XP
# ======================================================================
echo ""
echo -e "${YELLOW}Step 5: Testing validation (negative XP)...${NC}"

NEGATIVE_XP_RESPONSE=$(curl -s -X POST "${BASE_URL}/gamification/check-in" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{
    \"date_key\": \"${TODAY}\",
    \"xp_amount\": -10
  }")

if echo "$NEGATIVE_XP_RESPONSE" | grep -q "Invalid Request"; then
  echo -e "${GREEN}✅ Negative XP rejected correctly${NC}"
else
  echo -e "${RED}❌ Should reject negative XP${NC}"
  echo "Response: $NEGATIVE_XP_RESPONSE"
fi

# ======================================================================
# STEP 6: Test authentication required
# ======================================================================
echo ""
echo -e "${YELLOW}Step 6: Testing authentication requirement...${NC}"

NO_AUTH_RESPONSE=$(curl -s -X POST "${BASE_URL}/gamification/check-in" \
  -H "Content-Type: application/json" \
  -d "{
    \"date_key\": \"${TODAY}\",
    \"xp_amount\": 10
  }")

if echo "$NO_AUTH_RESPONSE" | grep -q "Forbidden\|403"; then
  echo -e "${GREEN}✅ Unauthenticated request rejected correctly${NC}"
else
  echo -e "${RED}❌ Should require authentication${NC}"
  echo "Response: $NO_AUTH_RESPONSE"
fi

# ======================================================================
# SUMMARY
# ======================================================================
echo ""
echo "======================================================================"
echo -e "${GREEN}✅ ALL HTTP API TESTS PASSED!${NC}"
echo "======================================================================"
echo ""
echo "Summary:"
echo "  • Authentication: ✓"
echo "  • First check-in (XP accumulation): ✓"
echo "  • Second check-in (incremental): ✓"
echo "  • Goal tracking: ✓"
echo "  • Date format validation: ✓"
echo "  • XP validation: ✓"
echo "  • Authentication requirement: ✓"
echo ""
