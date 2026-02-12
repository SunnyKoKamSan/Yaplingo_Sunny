#!/usr/bin/env python3
"""
Streak Calculation Test Script
===============================
Tests all scenarios of the streak calculation logic.

Usage:
    cd server
    DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo \
        uv run python scripts/test_streak.py
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from ulid import ULID

from server.repository import Repository
from server.repository.gamification import UserGamification
from server.repository.models import Language, User
from server.core.gamification import update_streak


async def test_streak_scenarios():
    """Test all streak calculation scenarios"""
    print("\n" + "=" * 70)
    print("🧪 STREAK CALCULATION TEST SUITE")
    print("=" * 70)
    
    repo = await Repository.create()
    
    try:
        async with repo.session() as session:
            async with session.begin():
                # Create test user
                test_user = User(
                    id=ULID(),
                    name=f"streak_test_{ULID()}",
                    password="test_password",
                    language=Language.ENGLISH
                )
                session.add(test_user)
                await session.flush()
                user_id = test_user.id
                
                print(f"\n👤 Test User Created: {test_user.name}")
                print(f"   ID: {user_id}")
                
                # ========================================
                # TEST 1: First Ever Check-In
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 1: First Ever Check-In (No Previous Activity)")
                print("-" * 70)
                
                date1 = "2026-01-20"
                streak = await update_streak(session, user_id, date1)
                
                print(f"📅 Check-in Date: {date1}")
                print(f"🔥 Expected Streak: 1")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == 1, f"FAILED: Expected 1, got {streak}"
                print("✅ PASSED: First check-in sets streak to 1")
                
                # Verify database state
                query = select(UserGamification).where(UserGamification.user_id == user_id)
                result = await session.exec(query)
                gamif = result.one()
                assert gamif.current_streak == 1
                assert gamif.last_activity_date == date1
                print(f"✅ DB State: streak={gamif.current_streak}, last_date={gamif.last_activity_date}")
                
                # ========================================
                # TEST 2: Same Day Check-In (No Increment)
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 2: Same Day Check-In (Scenario A)")
                print("-" * 70)
                
                streak = await update_streak(session, user_id, date1)
                
                print(f"📅 Check-in Date: {date1} (same as previous)")
                print(f"🔥 Expected Streak: 1 (unchanged)")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == 1, f"FAILED: Expected 1, got {streak}"
                print("✅ PASSED: Same day does not increment streak")
                
                # ========================================
                # TEST 3: Consecutive Day (Streak Extension)
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 3: Consecutive Day Check-In (Scenario B)")
                print("-" * 70)
                
                date2 = "2026-01-21"
                streak = await update_streak(session, user_id, date2)
                
                print(f"📅 Check-in Date: {date2} (next day)")
                print(f"🔥 Expected Streak: 2 (+1)")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == 2, f"FAILED: Expected 2, got {streak}"
                print("✅ PASSED: Consecutive day increments streak")
                
                # ========================================
                # TEST 4: Another Consecutive Day
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 4: Another Consecutive Day")
                print("-" * 70)
                
                date3 = "2026-01-22"
                streak = await update_streak(session, user_id, date3)
                
                print(f"📅 Check-in Date: {date3}")
                print(f"🔥 Expected Streak: 3 (+1)")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == 3, f"FAILED: Expected 3, got {streak}"
                print("✅ PASSED: Streak continues to increment")
                
                # ========================================
                # TEST 5: Broken Streak (Reset to 1)
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 5: Broken Streak (Scenario C)")
                print("-" * 70)
                
                date4 = "2026-01-25"  # Skip 2 days
                streak = await update_streak(session, user_id, date4)
                
                print(f"📅 Check-in Date: {date4} (gap of 2 days)")
                print(f"🔥 Expected Streak: 1 (reset)")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == 1, f"FAILED: Expected 1, got {streak}"
                print("✅ PASSED: Gap > 1 day resets streak to 1")
                
                # ========================================
                # TEST 6: Time Travel (Past Date - Ignore)
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 6: Time Travel - Past Date (Scenario D)")
                print("-" * 70)
                
                date5 = "2026-01-23"  # Before last_activity_date (2026-01-25)
                streak_before = 1
                streak = await update_streak(session, user_id, date5)
                
                print(f"📅 Check-in Date: {date5} (before last activity)")
                print(f"🔥 Expected Streak: {streak_before} (unchanged)")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == streak_before, f"FAILED: Expected {streak_before}, got {streak}"
                
                # Verify last_activity_date unchanged
                query = select(UserGamification).where(UserGamification.user_id == user_id)
                result = await session.exec(query)
                gamif = result.one()
                assert gamif.last_activity_date == date4, "last_activity_date should not change"
                print("✅ PASSED: Past date is ignored")
                print(f"✅ DB State: last_date still {gamif.last_activity_date}")
                
                # ========================================
                # TEST 7: Rebuild Streak After Reset
                # ========================================
                print("\n" + "-" * 70)
                print("TEST 7: Rebuild Streak After Reset")
                print("-" * 70)
                
                date6 = "2026-01-26"
                streak = await update_streak(session, user_id, date6)
                
                print(f"📅 Check-in Date: {date6} (next day after last)")
                print(f"🔥 Expected Streak: 2 (+1)")
                print(f"🔥 Actual Streak: {streak}")
                assert streak == 2, f"FAILED: Expected 2, got {streak}"
                print("✅ PASSED: Streak rebuilds correctly")
                
                # ========================================
                # FINAL SUMMARY
                # ========================================
                print("\n" + "=" * 70)
                print("📊 FINAL STATE")
                print("=" * 70)
                
                query = select(UserGamification).where(UserGamification.user_id == user_id)
                result = await session.exec(query)
                gamif = result.one()
                
                print(f"\n✅ User: {test_user.name}")
                print(f"   • Current Streak: {gamif.current_streak} days")
                print(f"   • Last Activity: {gamif.last_activity_date}")
                
                print("\n" + "=" * 70)
                print("🎉 ALL STREAK TESTS PASSED!")
                print("=" * 70)
                print("\n📋 Verified Scenarios:")
                print("  ✅ First check-in → streak = 1")
                print("  ✅ Same day → streak unchanged")
                print("  ✅ Consecutive day → streak +1")
                print("  ✅ Gap > 1 day → streak reset to 1")
                print("  ✅ Past date → ignored")
                print("  ✅ Streak rebuilds after reset")
                print("\n")
    
    finally:
        await repo.dispose()


if __name__ == "__main__":
    asyncio.run(test_streak_scenarios())
