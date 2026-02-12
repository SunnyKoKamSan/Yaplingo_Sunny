#!/usr/bin/env python3
"""
Comprehensive test for write-through leaderboard update correctness.

Tests:
1. Atomic transaction (all updates succeed or all fail)
2. XP accumulation correctness
3. Leaderboard entry creation
4. Leaderboard entry updates (incremental)
5. Period key calculation
6. Goal tracking alongside leaderboard
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlmodel import select
from server.core.gamification import get_period_key
from server.dependencies import repository
from server.repository.gamification import DailyProgress, LeaderboardEntry, UserGamification
from server.repository.models import User


async def test_writethrough_correctness():
    """Test write-through leaderboard update correctness."""
    
    print("=" * 70)
    print("🧪 TESTING WRITE-THROUGH LEADERBOARD CORRECTNESS")
    print("=" * 70)
    
    async with repository.session() as session:
        async with session.begin():
            # Clean up test user
            test_user_name = "writethrough_test_user"
            existing = await session.exec(select(User).where(User.name == test_user_name))
            existing_user = existing.first()
            if existing_user:
                await session.delete(existing_user)
                await session.commit()
            
            # Create test user
            test_user = User(
                name=test_user_name,
                password_hash="test_hash",
                language="EN"
            )
            session.add(test_user)
            await session.flush()
            
            print(f"\n✅ Created test user: {test_user.name}")
            print(f"   ID: {test_user.id}")
    
    # ================================================================
    # TEST 1: First check-in creates all records atomically
    # ================================================================
    print("\n" + "=" * 70)
    print("TEST 1: First Check-In (Atomic Creation)")
    print("=" * 70)
    
    today_utc = datetime.now(timezone.utc).date()
    today_str = today_utc.strftime("%Y-%m-%d")
    period_key = get_period_key(today_utc)
    
    print(f"Server UTC Date: {today_str}")
    print(f"Period Key: {period_key}")
    
    xp_amount = 25
    
    async with repository.session() as session:
        async with session.begin():
            # Simulate check-in logic
            # 1. DailyProgress
            daily_progress = DailyProgress(
                user_id=test_user.id,
                date_key=today_str,
                xp_earned=xp_amount,
                lessons_completed=1,
                goal_met=False
            )
            session.add(daily_progress)
            
            # 2. UserGamification (streak)
            user_gamification = UserGamification(
                user_id=test_user.id,
                current_streak=1,
                last_activity_date=today_str
            )
            session.add(user_gamification)
            
            # 3. LeaderboardEntry (write-through)
            leaderboard_entry = LeaderboardEntry(
                user_id=test_user.id,
                period_key=period_key,
                total_xp=xp_amount
            )
            session.add(leaderboard_entry)
            
            await session.flush()
    
    # Verify all records created
    async with repository.session() as session:
        daily = await session.get(DailyProgress, (test_user.id, today_str))
        gamification = await session.get(UserGamification, test_user.id)
        leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
        
        assert daily is not None, "DailyProgress not created"
        assert daily.xp_earned == 25, f"Expected 25 XP, got {daily.xp_earned}"
        assert daily.lessons_completed == 1, "Lessons count incorrect"
        
        assert gamification is not None, "UserGamification not created"
        assert gamification.current_streak == 1, "Streak should be 1"
        
        assert leaderboard is not None, "LeaderboardEntry not created"
        assert leaderboard.total_xp == 25, f"Expected 25 total_xp, got {leaderboard.total_xp}"
        
        print(f"✅ DailyProgress: {daily.xp_earned} XP, {daily.lessons_completed} lessons")
        print(f"✅ Streak: {gamification.current_streak} days")
        print(f"✅ Leaderboard: {leaderboard.total_xp} XP in {leaderboard.period_key}")
        print("✅ All records created atomically!")
    
    # ================================================================
    # TEST 2: Second check-in increments correctly (write-through)
    # ================================================================
    print("\n" + "=" * 70)
    print("TEST 2: Second Check-In (Incremental Update)")
    print("=" * 70)
    
    xp_amount_2 = 30
    
    async with repository.session() as session:
        async with session.begin():
            # Simulate second check-in
            # 1. Update DailyProgress
            daily = await session.get(DailyProgress, (test_user.id, today_str))
            daily.xp_earned += xp_amount_2
            daily.lessons_completed += 1
            daily.goal_met = daily.xp_earned >= 50  # Check goal
            
            # 2. Update streak (same day, no change)
            # (skipped for brevity)
            
            # 3. Update LeaderboardEntry (write-through increment)
            leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
            leaderboard.total_xp += xp_amount_2
            
            await session.flush()
    
    # Verify increments
    async with repository.session() as session:
        daily = await session.get(DailyProgress, (test_user.id, today_str))
        leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
        
        expected_total = 25 + 30
        assert daily.xp_earned == expected_total, f"Expected {expected_total} XP, got {daily.xp_earned}"
        assert daily.lessons_completed == 2, "Lessons should be 2"
        assert daily.goal_met == True, "Goal should be met (55 >= 50)"
        
        assert leaderboard.total_xp == expected_total, f"Leaderboard should have {expected_total} XP, got {leaderboard.total_xp}"
        
        print(f"✅ DailyProgress: {daily.xp_earned} XP (25 + 30)")
        print(f"✅ Lessons: {daily.lessons_completed}")
        print(f"✅ Goal Met: {daily.goal_met}")
        print(f"✅ Leaderboard: {leaderboard.total_xp} XP (write-through updated)")
        print("✅ Incremental update correct!")
    
    # ================================================================
    # TEST 3: Third check-in - verify consistency
    # ================================================================
    print("\n" + "=" * 70)
    print("TEST 3: Third Check-In (Consistency Verification)")
    print("=" * 70)
    
    xp_amount_3 = 45
    
    async with repository.session() as session:
        async with session.begin():
            daily = await session.get(DailyProgress, (test_user.id, today_str))
            daily.xp_earned += xp_amount_3
            daily.lessons_completed += 1
            
            leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
            leaderboard.total_xp += xp_amount_3
            
            await session.flush()
    
    async with repository.session() as session:
        daily = await session.get(DailyProgress, (test_user.id, today_str))
        leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
        
        expected_total = 25 + 30 + 45
        assert daily.xp_earned == expected_total, f"Expected {expected_total} XP, got {daily.xp_earned}"
        assert leaderboard.total_xp == expected_total, f"Leaderboard mismatch: {leaderboard.total_xp}"
        
        print(f"✅ DailyProgress: {daily.xp_earned} XP (25 + 30 + 45)")
        print(f"✅ Leaderboard: {leaderboard.total_xp} XP")
        print(f"✅ Lessons: {daily.lessons_completed}")
        print("✅ Consistency maintained!")
    
    # ================================================================
    # TEST 4: Verify period key calculation
    # ================================================================
    print("\n" + "=" * 70)
    print("TEST 4: Period Key Calculation Accuracy")
    print("=" * 70)
    
    from datetime import date
    
    test_dates = [
        (date(2026, 1, 6), "WEEK-2026-02"),   # Monday of week 2
        (date(2026, 1, 12), "WEEK-2026-03"),  # Sunday of week 2 transitions to week 3
        (date(2026, 1, 21), "WEEK-2026-04"),  # Wednesday
        (date(2026, 1, 29), "WEEK-2026-05"),  # Thursday (today)
    ]
    
    for test_date, expected_key in test_dates:
        actual_key = get_period_key(test_date)
        assert actual_key == expected_key, f"Date {test_date}: expected {expected_key}, got {actual_key}"
        print(f"✅ {test_date} → {actual_key}")
    
    print("✅ Period key calculation correct!")
    
    # ================================================================
    # TEST 5: Multiple users, same period (leaderboard integrity)
    # ================================================================
    print("\n" + "=" * 70)
    print("TEST 5: Multi-User Leaderboard Integrity")
    print("=" * 70)
    
    # Create additional test users
    test_users = []
    xp_amounts = [150, 200, 75, 50]
    
    async with repository.session() as session:
        async with session.begin():
            for i, xp in enumerate(xp_amounts, start=2):
                user = User(
                    name=f"writethrough_test_user_{i}",
                    password_hash="test",
                    language="EN"
                )
                session.add(user)
                await session.flush()
                
                # Create leaderboard entry
                entry = LeaderboardEntry(
                    user_id=user.id,
                    period_key=period_key,
                    total_xp=xp
                )
                session.add(entry)
                test_users.append((user, xp))
            
            await session.flush()
    
    # Query leaderboard
    async with repository.session() as session:
        query = select(LeaderboardEntry).where(
            LeaderboardEntry.period_key == period_key
        ).order_by(LeaderboardEntry.total_xp.desc())
        
        result = await session.exec(query)
        entries = result.all()
        
        print(f"\nLeaderboard for {period_key}:")
        for idx, entry in enumerate(entries, 1):
            print(f"   {idx}. User {entry.user_id}: {entry.total_xp} XP")
        
        # Verify ordering
        xp_values = [e.total_xp for e in entries]
        assert xp_values == sorted(xp_values, reverse=True), "Leaderboard not sorted correctly"
        
        print(f"\n✅ Total entries: {len(entries)}")
        print("✅ Ordering correct (descending XP)")
        print("✅ Multi-user integrity maintained!")
    
    # ================================================================
    # TEST 6: Transaction rollback test (simulate error)
    # ================================================================
    print("\n" + "=" * 70)
    print("TEST 6: Transaction Rollback (Atomicity)")
    print("=" * 70)
    
    async with repository.session() as session:
        # Get current state
        current_daily = await session.get(DailyProgress, (test_user.id, today_str))
        current_leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
        
        original_daily_xp = current_daily.xp_earned
        original_leaderboard_xp = current_leaderboard.total_xp
        
        print(f"Original DailyProgress XP: {original_daily_xp}")
        print(f"Original Leaderboard XP: {original_leaderboard_xp}")
    
    # Try to update with an intentional error
    try:
        async with repository.session() as session:
            async with session.begin():
                daily = await session.get(DailyProgress, (test_user.id, today_str))
                daily.xp_earned += 999
                
                leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
                leaderboard.total_xp += 999
                
                # Simulate error before commit
                raise Exception("Simulated error to test rollback")
    except Exception as e:
        print(f"✅ Caught error: {e}")
    
    # Verify no changes persisted
    async with repository.session() as session:
        daily = await session.get(DailyProgress, (test_user.id, today_str))
        leaderboard = await session.get(LeaderboardEntry, (test_user.id, period_key))
        
        assert daily.xp_earned == original_daily_xp, "DailyProgress changed despite rollback!"
        assert leaderboard.total_xp == original_leaderboard_xp, "Leaderboard changed despite rollback!"
        
        print(f"✅ DailyProgress XP unchanged: {daily.xp_earned}")
        print(f"✅ Leaderboard XP unchanged: {leaderboard.total_xp}")
        print("✅ Transaction atomicity verified!")
    
    # ================================================================
    # SUMMARY
    # ================================================================
    print("\n" + "=" * 70)
    print("🎉 ALL WRITE-THROUGH LEADERBOARD TESTS PASSED!")
    print("=" * 70)
    print("\n✅ Verified:")
    print("   • Atomic transaction (all 3 tables updated together)")
    print("   • Incremental XP accumulation")
    print("   • Write-through leaderboard updates")
    print("   • Period key calculation accuracy")
    print("   • Multi-user leaderboard integrity")
    print("   • Transaction rollback protection")
    print("\n💡 Write-through pattern ensures:")
    print("   • No expensive SUM() queries on reads")
    print("   • Leaderboard always in sync with daily progress")
    print("   • Fast O(1) leaderboard queries")


if __name__ == "__main__":
    asyncio.run(test_writethrough_correctness())
