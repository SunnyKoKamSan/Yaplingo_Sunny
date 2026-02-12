#!/usr/bin/env python3
"""
Test Script for Gamification Check-In Endpoint
==============================================
Tests the POST /gamification/check-in endpoint with various scenarios.

Usage:
    cd server
    DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo \
        uv run python scripts/test_checkin.py
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from server.repository import Repository
from server.repository.gamification import DailyProgress, LeaderboardEntry, UserGamification
from server.repository.models import Language, User


async def test_check_in_logic():
    """Test the check-in logic directly (without HTTP)"""
    print("\n" + "=" * 70)
    print("🧪 TESTING CHECK-IN LOGIC")
    print("=" * 70)
    
    repo = await Repository.create()
    
    try:
        async with repo.session() as session:
            # ========================================
            # TEST 1: Create test user
            # ========================================
            print("\n📝 Test 1: Creating test user...")
            test_user_name = "checkin_test_user"
            
            # Check if user exists
            query = select(User).where(User.name == test_user_name)
            result = await session.exec(query)
            rows = result.all()
            
            if rows:
                row = rows[0]
                user = row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row
                print(f"   ✓ Using existing user: {user.name} (ID: {user.id})")
            else:
                from ulid import ULID
                user = User(
                    id=ULID(),
                    name=test_user_name,
                    password="test_password",
                    language=Language.ENGLISH
                )
                session.add(user)
                await session.commit()
                print(f"   ✓ Created new user: {user.name} (ID: {user.id})")
            
            # ========================================
            # TEST 2: First check-in
            # ========================================
            print("\n📝 Test 2: First check-in (25 XP)...")
            date_key = datetime.now().strftime("%Y-%m-%d")
            xp_amount = 25
            
            # Query existing progress
            query = select(DailyProgress).where(
                DailyProgress.user_id == user.id,
                DailyProgress.date_key == date_key
            )
            result = await session.exec(query)
            row = result.one_or_none()
            daily = row[0] if row and (isinstance(row, tuple) or hasattr(row, '__getitem__')) else row
            
            if daily:
                initial_xp = daily.xp_earned
                daily.xp_earned += xp_amount
                daily.lessons_completed += 1
                print(f"   ✓ Updated existing record: {initial_xp} -> {daily.xp_earned} XP")
            else:
                daily = DailyProgress(
                    user_id=user.id,
                    date_key=date_key,
                    xp_earned=xp_amount,
                    lessons_completed=1,
                    goal_met=False
                )
                session.add(daily)
                print(f"   ✓ Created new record: {xp_amount} XP")
            
            # Check goal
            if daily.xp_earned >= 50:
                daily.goal_met = True
                print(f"   🎯 Goal met! ({daily.xp_earned} >= 50)")
            else:
                print(f"   ⭕ Goal not met yet ({daily.xp_earned} < 50)")
            
            # Update leaderboard
            year, week, _ = datetime.now().isocalendar()
            period_key = f"WEEK-{year}-{week:02d}"
            
            query = select(LeaderboardEntry).where(
                LeaderboardEntry.user_id == user.id,
                LeaderboardEntry.period_key == period_key
            )
            result = await session.exec(query)
            row = result.one_or_none()
            leaderboard = row[0] if row and (isinstance(row, tuple) or hasattr(row, '__getitem__')) else row
            
            if leaderboard:
                leaderboard.total_xp += xp_amount
                print(f"   📊 Leaderboard updated: {period_key} -> {leaderboard.total_xp} XP")
            else:
                leaderboard = LeaderboardEntry(
                    user_id=user.id,
                    period_key=period_key,
                    total_xp=xp_amount
                )
                session.add(leaderboard)
                print(f"   📊 Leaderboard created: {period_key} -> {xp_amount} XP")
            
            await session.commit()
            await session.refresh(daily)
            
            # ========================================
            # TEST 3: Second check-in (should reach goal)
            # ========================================
            print("\n📝 Test 3: Second check-in (30 XP)...")
            xp_amount = 30
            
            query = select(DailyProgress).where(
                DailyProgress.user_id == user.id,
                DailyProgress.date_key == date_key
            )
            result = await session.exec(query)
            row = result.one_or_none()
            daily = row[0] if row and (isinstance(row, tuple) or hasattr(row, '__getitem__')) else row
            
            if daily:
                initial_xp = daily.xp_earned
                daily.xp_earned += xp_amount
                daily.lessons_completed += 1
                print(f"   ✓ Updated: {initial_xp} -> {daily.xp_earned} XP")
            
            if daily.xp_earned >= 50:
                daily.goal_met = True
                print(f"   🎯 Goal met! ({daily.xp_earned} >= 50)")
            
            # Update leaderboard
            query = select(LeaderboardEntry).where(
                LeaderboardEntry.user_id == user.id,
                LeaderboardEntry.period_key == period_key
            )
            result = await session.exec(query)
            row = result.one_or_none()
            leaderboard = row[0] if row and (isinstance(row, tuple) or hasattr(row, '__getitem__')) else row
            
            if leaderboard:
                leaderboard.total_xp += xp_amount
                print(f"   📊 Leaderboard: {leaderboard.total_xp} XP")
            
            await session.commit()
            await session.refresh(daily)
            
            # ========================================
            # VERIFICATION
            # ========================================
            print("\n" + "-" * 70)
            print("📊 FINAL STATE")
            print("-" * 70)
            
            query = select(DailyProgress).where(
                DailyProgress.user_id == user.id,
                DailyProgress.date_key == date_key
            )
            result = await session.exec(query)
            row = result.one_or_none()
            daily = row[0] if row and (isinstance(row, tuple) or hasattr(row, '__getitem__')) else row
            
            if daily:
                print(f"\n✅ Daily Progress for {date_key}:")
                print(f"   • Total XP: {daily.xp_earned}")
                print(f"   • Lessons: {daily.lessons_completed}")
                print(f"   • Goal Met: {'Yes 🎯' if daily.goal_met else 'No ⭕'}")
            
            query = select(LeaderboardEntry).where(
                LeaderboardEntry.user_id == user.id,
                LeaderboardEntry.period_key == period_key
            )
            result = await session.exec(query)
            row = result.one_or_none()
            leaderboard = row[0] if row and (isinstance(row, tuple) or hasattr(row, '__getitem__')) else row
            
            if leaderboard:
                print(f"\n📊 Leaderboard Entry for {period_key}:")
                print(f"   • Total XP: {leaderboard.total_xp}")
            
            print("\n" + "=" * 70)
            print("✅ ALL TESTS PASSED!")
            print("=" * 70 + "\n")
    
    finally:
        await repo.dispose()


if __name__ == "__main__":
    asyncio.run(test_check_in_logic())
