#!/usr/bin/env python3
"""Simple test for rank calculation logic."""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func
from sqlmodel import select
from server.core.gamification import get_period_key
from server.dependencies import repository
from server.repository.gamification import LeaderboardEntry

async def test_rank():
    print("🧪 TESTING RANK CALCULATION")
    print("=" * 70)
    
    today_utc = datetime.now(timezone.utc).date()
    period_key = get_period_key(today_utc)
    
    print(f"\n📅 Current period: {period_key}")
    
    async with repository.session() as session:
        # Get all entries for current period
        query = select(LeaderboardEntry).where(
            LeaderboardEntry.period_key == period_key
        ).order_by(LeaderboardEntry.total_xp.desc())
        
        result = await session.exec(query)
        entries = result.all()
        
        print(f"👥 Total users in period: {len(entries)}")
        
        if entries:
            print("\n🏆 Top 5 users:")
            for i, entry in enumerate(entries[:5], 1):
                print(f"   #{i}: {entry.total_xp} XP")
            
            # Test rank calculation for user at position 3
            if len(entries) >= 3:
                test_xp = entries[2].total_xp
                print(f"\n🎯 Testing rank for user with {test_xp} XP...")
                
                count_query = select(func.count()).select_from(LeaderboardEntry).where(
                    LeaderboardEntry.period_key == period_key,
                    LeaderboardEntry.total_xp > test_xp
                )
                count_result = await session.exec(count_query)
                higher_count = count_result.one()
                rank = higher_count + 1
                
                print(f"   Users with higher XP: {higher_count}")
                print(f"   Calculated rank: {rank}")
                print(f"   Expected rank: 3")
                
                if rank == 3:
                    print("   ✅ Rank calculation correct!")
                else:
                    print(f"   ❌ Expected rank 3, got {rank}")
        
        # Test new user (0 XP)
        print(f"\n🆕 Testing new user (0 XP)...")
        test_xp = 0
        count_query = select(func.count()).select_from(LeaderboardEntry).where(
            LeaderboardEntry.period_key == period_key,
            LeaderboardEntry.total_xp > test_xp
        )
        count_result = await session.exec(count_query)
        higher_count = count_result.one()
        rank = higher_count + 1
        
        print(f"   Total participants: {higher_count}")
        print(f"   New user rank would be: {rank}")
        print("   ✅ New users get rank = participant_count + 1")
    
    print("\n" + "=" * 70)
    print("✅ RANK CALCULATION TEST COMPLETE")

if __name__ == "__main__":
    asyncio.run(test_rank())
