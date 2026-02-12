#!/bin/bash
# Helper script to run seeding and verification with the correct DATABASE_URL
# Usage: ./run_seed.sh

# Change to the server directory
cd "$(dirname "$0")/.."

# Set the database URL for localhost (Docker container exposed port)
export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo"

echo "🌱 Running gamification seeding script..."
echo ""

uv run python scripts/seed_gamification.py

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Running verification script..."
echo ""

uv run python scripts/verify_gamification.py
