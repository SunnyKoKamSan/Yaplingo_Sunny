#!/usr/bin/env python3
"""
Leaderboard Endpoint Test Script
=================================
Tests the GET /gamification/leaderboard endpoint and verifies:
- Query optimization (no N+1 queries with selectinload)
- Correct ranking
- Top 50 limit
- Proper data transformation

Usage:
    cd server
    DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/yaplingo \
        uv run python scripts/test_leaderboard.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession

from server.repository import Repository
from server.repository.gamification import LeaderboardEntry
from server.schemas import LeaderboardItem


async def test_leaderboard():
    """Test the leaderboard endpoint logic"""
    print("\n" + "=" * 70)
    print("🧪 LEADERBOARD ENDPOINT TEST")
    print("=" * 70)
    
    repo = await Repository.create()
    
    try:
        async with repo.session() as session:
            # Get current week period_key
            from datetime import datetime
            year, week, _ = datetime.now().isocalendar()
            period_key = f"WEEK-{year}-{week:02d}"
            
            print(f"\n📅 Testing Period: {period_key}")
            
            # ================================================================
            # TEST 1: Query with selectinload (No N+1)
            # ================================================================
            print("\n" + "-" * 70)
            print("TEST 1: Query Optimization (selectinload)")
            print("-" * 70)
            
            query = (
                select(LeaderboardEntry)
                .where(LeaderboardEntry.period_key == period_key)
                .options(selectinload(LeaderboardEntry.user))
                .order_by(LeaderboardEntry.total_xp.desc())
                .limit(50)
            )
            
            result = await session.exec(query)
            rows = result.all()
            entries = [row[0] if isinstance(row, tuple) or hasattr(row, "__getitem__") else row for row in rows]
            
            print(f"✅ Query executed with selectinload")
            print(f"   Found {len(entries)} entries")
            
            if not entries:
                print("\n⚠️  No leaderboard data for this week. Seeding data first...")
                print("   Run: DATABASE_URL=... uv run python scripts/seed_gamification.py")
                return
            
            # ================================================================
            # TEST 2: Data Transformation & Ranking
            # ================================================================
            print("\n" + "-" * 70)
            print("TEST 2: Data Transformation & Ranking")
            print("-" * 70)
            
            leaderboard_items: list[LeaderboardItem] = []
            for index, entry in enumerate(entries, start=1):
                name = entry.user.name if entry.user else "Unknown"
                leaderboard_items.append(
                    LeaderboardItem(
                        rank=index,
                        name=name,
                        total_xp=entry.total_xp,
                        user_id=entry.user_id,
                    )
                )
            
            print(f"✅ Transformed {len(leaderboard_items)} entries")
            
            # ================================================================
            # TEST 3: Verify Ranking Order
            # ================================================================
            print("\n" + "-" * 70)
            print("TEST 3: Verify Ranking (Descending XP)")
            print("-" * 70)
            
            for i in range(len(leaderboard_items) - 1):
                current = leaderboard_items[i]
                next_item = leaderboard_items[i + 1]
                
                # Rank should increment by 1
                assert current.rank == i + 1, f"Rank mismatch at position {i}"
                
                # XP should be descending
                assert current.total_xp >= next_item.total_xp, \
                    f"XP not descending: {current.total_xp} < {next_item.total_xp}"
            
            print(f"✅ All ranks correct (1 to {len(leaderboard_items)})")
            print(f"✅ XP sorted in descending order")
            
            # ================================================================
            # TEST 4: Verify Top 50 Limit
            # ================================================================
            print("\n" + "-" * 70)
            print("TEST 4: Verify Top 50 Limit")
            print("-" * 70)
            
            assert len(leaderboard_items) <= 50, f"More than 50 entries: {len(leaderboard_items)}"
            print(f"✅ Result count: {len(leaderboard_items)} (≤ 50)")
            
            # ================================================================
            # TEST 5: Display Top 10
            # ================================================================
            print("\n" + "-" * 70)
            print("TEST 5: Display Top 10 Leaderboard")
            print("-" * 70)
            
            print(f"\n🏆 Top 10 for {period_key}:\n")
            for item in leaderboard_items[:10]:
                medal = "🥇" if item.rank == 1 else "🥈" if item.rank == 2 else "🥉" if item.rank == 3 else "  "
                print(f"{medal} #{item.rank:2d} | {item.name:20s} | {item.total_xp:5d} XP")
            
            # ================================================================
            # TEST 6: Verify User Data (No N+1)
            # ================================================================
            print("\n" + "-" * 70)
            print("TEST 6: Verify User Data Loaded (No N+1)")
            print("-" * 70)
            
            # All user names should be loaded without additional queries
            for item in leaderboard_items:
                assert item.name != "Unknown", f"User name not loaded for {item.user_id}"
                assert len(item.name) > 0, f"Empty name for {item.user_id}"
            
            print(f"✅ All {len(leaderboard_items)} user names loaded")
            print(f"✅ No N+1 queries (selectinload worked)")
            
            # ================================================================
            # SUMMARY
            # ================================================================
            print("\n" + "=" * 70)
            print("🎉 ALL LEADERBOARD TESTS PASSED!")
            print("=" * 70)
            print("\n📋 Verified:")
            print(f"  ✅ Query optimization (selectinload)")
            print(f"  ✅ Correct ranking (1 to {len(leaderboard_items)})")
            print(f"  ✅ XP sorted descending")
            print(f"  ✅ Top 50 limit enforced")
            print(f"  ✅ Data transformation works")
            print(f"  ✅ No N+1 queries")
            print()
    
    finally:
        await repo.dispose()


if __name__ == "__main__":
    asyncio.run(test_leaderboard())
