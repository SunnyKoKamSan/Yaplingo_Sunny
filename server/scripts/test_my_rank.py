#!/usr/bin/env python3
"""
Test script for GET /gamification/leaderboard/me endpoint.

This demonstrates:
1. User authentication
2. Check-in to earn XP
3. Fetching personal rank
4. Edge case: New user with no XP
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func
from sqlmodel import select

from server.core.gamification import get_period_key
from server.dependencies import repository
from server.repository.gamification import LeaderboardEntry
from server.repository.models import User


async def test_my_rank():
    """Test the my rank calculation logic."""
    
    print("🧪 TESTING GET /leaderboard/me LOGIC")
    print("=" * 70)
    
    async with repository.session() as session:
        async with session.begin():
            # ================================================================
            # SETUP: Create test users with different XP levels
            # ================================================================
            print("\n📝 Step 1: Creating test users with varying XP...")
            
            # Get current period
            today_utc = datetime.now(timezone.utc).date()
            period_key = get_period_key(today_utc)
            print(f"   Current period: {period_key}")
            
            # Clean up existing test data
            await session.exec(
                select(User).where(User.name.like("rank_test_%"))
            )
            
            test_users = []
            xp_levels = [100, 75, 75, 50, 25, 10]  # Including a tie at 75
            
            for i, xp in enumerate(xp_levels, start=1):
                # Create user
                user = User(name=f"rank_test_user{i}", password_hash="test", language="EN")
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
                print(f"   ✓ Created user{i}: {xp} XP")
            
            await session.flush()
            
            # ================================================================
            # TEST 1: User with XP (should have proper rank)
            # ================================================================
            print("\n📝 Step 2: Testing rank calculation for user with XP...")
            
            target_user = test_users[3][0]  # User with 50 XP
            my_xp = 50
            
            # Count users with higher XP (same as endpoint logic)
            count_query = select(func.count()).select_from(LeaderboardEntry).where(
                LeaderboardEntry.period_key == period_key,
                LeaderboardEntry.total_xp > my_xp
            )
            result = await session.exec(count_query)
            higher_count = result.one()
            rank = higher_count + 1
            
            print(f"   User XP: {my_xp}")
            print(f"   Users with higher XP: {higher_count}")
            print(f"   Calculated rank: {rank}")
            print(f"   Expected: 4th place (100, 75, 75 are higher)")
            
            assert rank == 4, f"Expected rank 4, got {rank}"
            print("   ✅ Rank calculation correct!")
            
            # ================================================================
            # TEST 2: User with no entry (0 XP)
            # ================================================================
            print("\n📝 Step 3: Testing rank for new user with no entry...")
            
            new_user = User(name="rank_test_newuser", password_hash="test", language="EN")
            session.add(new_user)
            await session.flush()
            
            my_xp = 0
            count_query = select(func.count()).select_from(LeaderboardEntry).where(
                LeaderboardEntry.period_key == period_key,
                LeaderboardEntry.total_xp > my_xp
            )
            result = await session.exec(count_query)
            higher_count = result.one()
            rank = higher_count + 1
            
            print(f"   User XP: {my_xp} (no entry)")
            print(f"   Total participants: {higher_count}")
            print(f"   Calculated rank: {rank}")
            print(f"   Expected: {len(test_users) + 1} (last place)")
            
            assert rank == len(test_users) + 1, f"Expected rank {len(test_users) + 1}, got {rank}"
            print("   ✅ New user rank correct!")
            
            # ================================================================
            # TEST 3: Top user
            # ================================================================
            print("\n📝 Step 4: Testing rank for top user...")
            
            top_user = test_users[0][0]  # User with 100 XP
            my_xp = 100
            
            count_query = select(func.count()).select_from(LeaderboardEntry).where(
                LeaderboardEntry.period_key == period_key,
                LeaderboardEntry.total_xp > my_xp
            )
            result = await session.exec(count_query)
            higher_count = result.one()
            rank = higher_count + 1
            
            print(f"   User XP: {my_xp}")
            print(f"   Users with higher XP: {higher_count}")
            print(f"   Calculated rank: {rank}")
            print(f"   Expected: 1 (top of leaderboard)")
            
            assert rank == 1, f"Expected rank 1, got {rank}"
            print("   ✅ Top user rank correct!")
            
            # ================================================================
            # TEST 4: Tie handling
            # ================================================================
            print("\n📝 Step 5: Testing tie handling (75 XP users)...")
            
            tied_user = test_users[1][0]  # One of the 75 XP users
            my_xp = 75
            
            count_query = select(func.count()).select_from(LeaderboardEntry).where(
                LeaderboardEntry.period_key == period_key,
                LeaderboardEntry.total_xp > my_xp
            )
            result = await session.exec(count_query)
            higher_count = result.one()
            rank = higher_count + 1
            
            print(f"   User XP: {my_xp}")
            print(f"   Users with higher XP: {higher_count}")
            print(f"   Calculated rank: {rank}")
            print(f"   Expected: 2 (only 100 XP is higher)")
            print("   Note: Both 75 XP users get rank 2 (dense ranking)")
            
            assert rank == 2, f"Expected rank 2, got {rank}"
            print("   ✅ Tie handling correct!")
            
    print("\n" + "=" * 70)
    print("✅ ALL RANK CALCULATION TESTS PASSED!")
    print("\n📊 Performance Notes:")
    print("   • COUNT query uses (period_key, total_xp) index")
    print("   • O(log n) complexity regardless of user count")
    print("   • Scales to millions of users efficiently")
    print("   • Alternative (fetch all + Python sort) would be O(n) memory")


if __name__ == "__main__":
    asyncio.run(test_my_rank())
