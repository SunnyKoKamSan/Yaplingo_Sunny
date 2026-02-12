#!/bin/bash
set -e

DB_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo"

echo "🧪 Running All Gamification Tests..."
echo "====================================="

echo -e "\n✅ Test 1: HTTP Integration Test"
./test_correctness.sh

echo -e "\n✅ Test 2: Verify Gamification"
DATABASE_URL=$DB_URL uv run python verify_gamification.py

echo -e "\n✅ Test 3: Leaderboard Tests"
DATABASE_URL=$DB_URL uv run python test_leaderboard.py

echo -e "\n✅ Test 4: UTC Streak Tests"
DATABASE_URL=$DB_URL uv run python test_utc_streak.py

echo -e "\n✅ Test 5: UTC Leaderboard Tests"
DATABASE_URL=$DB_URL uv run python test_utc_leaderboard.py

echo -e "\n✅ Test 6: Full Gamification Suite"
DATABASE_URL=$DB_URL uv run python test_gamification.py

echo -e "\n🎉 All Tests Passed!"
