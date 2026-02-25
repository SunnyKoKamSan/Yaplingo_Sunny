#!/usr/bin/env python3
"""
Gamification Verification Script
=================================
Queries the database to verify the seeded data and display statistics.
Use this to demonstrate that the seeding worked correctly.

Usage:
    cd server
    uv run python scripts/verify_gamification.py
"""
import asyncio
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

# Add the server directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import func, select
from sqlmodel import col

from server.repository import Repository
from server.repository.gamification import DailyProgress, LeaderboardEntry, UserGamification
from server.repository.models import User


async def main():
    print("\n" + "=" * 70)
    print("🔍 GAMIFICATION DATA VERIFICATION")
    print("=" * 70)
    
    repo = await Repository.create()
    
    try:
        async with repo.session() as session:
            # ========================================
            # 1. FETCH ALL USERS
            # ========================================
            statement = select(User)
            result = await session.exec(statement)
            users_rows = result.all()
            # Extract User objects from Row tuples
            users = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in users_rows]
            total_users = len(users)
            print(f"\n👥 Total Users: {total_users}")
            
            # ========================================
            # 2. LIST ALL USERS WITH STATS
            # ========================================
            print("\n" + "-" * 70)
            print("USER DETAILS")
            print("-" * 70)
            
            for user in users:
                print(f"\n🧑 User: {user.name}")
                print(f"   ID: {user.id}")
                
                # Get gamification profile
                profile = await session.get(UserGamification, user.id)
                if profile:
                    print(f"   🔥 Current Streak: {profile.current_streak} days")
                    print(f"   📅 Last Activity: {profile.last_activity_date}")
                else:
                    print("   ⚠️  No gamification profile")
                
                # Count daily progress entries
                query = select(DailyProgress).where(
                    DailyProgress.user_id == user.id
                )
                result = await session.exec(query)
                rows = result.all()
                daily_records = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in rows]
                daily_count = len(daily_records)
                print(f"   📊 Daily Progress Records: {daily_count}")
                
                # Calculate total XP from daily progress
                total_xp = sum(r.xp_earned for r in daily_records)
                print(f"   💎 Total XP (All Time): {total_xp}")
                
                # Count goals met
                goals_met = sum(1 for r in daily_records if r.goal_met)
                print(f"   🎯 Goals Met: {goals_met}/{daily_count}")
                
                # Leaderboard entries
                query = select(LeaderboardEntry).where(
                    LeaderboardEntry.user_id == user.id
                )
                result = await session.exec(query)
                rows = result.all()
                leaderboard_entries = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in rows]
                print(f"   🏆 Leaderboard Periods: {len(leaderboard_entries)}")
                for entry in leaderboard_entries:
                    print(f"      • {entry.period_key}: {entry.total_xp} XP")
            
            # ========================================
            # 3. DAILY PROGRESS TIMELINE
            # ========================================
            print("\n" + "-" * 70)
            print("📅 DAILY PROGRESS TIMELINE (Last 14 Days)")
            print("-" * 70)
            
            today = datetime.now()
            start_date = today - timedelta(days=13)
            
            for day_offset in range(14):
                date = start_date + timedelta(days=day_offset)
                date_key = date.strftime("%Y-%m-%d")
                
                query = select(DailyProgress).where(
                    DailyProgress.date_key == date_key
                )
                result = await session.exec(query)
                rows = result.all()
                records = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in rows]
                
                if records:
                    total_xp = sum(r.xp_earned for r in records)
                    print(f"\n{date_key} ({date.strftime('%A')})")
                    print(f"   Active Users: {len(records)}")
                    print(f"   Total XP Earned: {total_xp}")
                    for record in records:
                        user = await session.get(User, record.user_id)
                        status = "✅" if record.goal_met else "⭕"
                        print(f"      {status} {user.name}: {record.xp_earned} XP")
                else:
                    print(f"\n{date_key} ({date.strftime('%A')}): No activity")
            
            # ========================================
            # 4. LEADERBOARD (CURRENT WEEK)
            # ========================================
            print("\n" + "-" * 70)
            print("🏆 CURRENT WEEK LEADERBOARD")
            print("-" * 70)
            
            # Calculate current week period key
            year, week, _ = datetime.now().isocalendar()
            current_period = f"WEEK-{year}-{week:02d}"
            
            # ── Global ──
            query = (
                select(LeaderboardEntry, User)
                .join(User, LeaderboardEntry.user_id == User.id)
                .where(LeaderboardEntry.period_key == current_period)
                .order_by(col(LeaderboardEntry.total_xp).desc())
            )
            result = await session.exec(query)
            results = list(result.all())
            
            if results:
                print(f"\nPeriod: {current_period}  (Global)\n")
                for rank, (entry, user) in enumerate(results, 1):
                    medal = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else "  "
                    print(f"{medal} #{rank:2d} | {user.name:20s} | {entry.total_xp:5d} XP")
            else:
                print(f"\n⚠️  No entries for current week: {current_period}")

            # ── Per-Topic ──
            topics = ["Food", "Culture", "Travel", "Business", "Technology"]
            for topic in topics:
                topic_key = f"{current_period}::{topic}"
                query = (
                    select(LeaderboardEntry, User)
                    .join(User, LeaderboardEntry.user_id == User.id)
                    .where(LeaderboardEntry.period_key == topic_key)
                    .order_by(col(LeaderboardEntry.total_xp).desc())
                )
                result = await session.exec(query)
                topic_results = list(result.all())
                if topic_results:
                    print(f"\nPeriod: {topic_key}\n")
                    for rank, (entry, user) in enumerate(topic_results, 1):
                        medal = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else "  "
                        print(f"{medal} #{rank:2d} | {user.name:20s} | {entry.total_xp:5d} XP")

            # ── All-Time Global ──
            print("\n" + "-" * 70)
            print("🏆 ALL-TIME LEADERBOARD (Global)")
            print("-" * 70)
            query = (
                select(
                    User.name,
                    func.sum(LeaderboardEntry.total_xp).label("total_xp"),
                )
                .join(User, LeaderboardEntry.user_id == User.id)
                .where(~LeaderboardEntry.period_key.contains("::"))
                .group_by(User.name)
                .order_by(func.sum(LeaderboardEntry.total_xp).desc())
            )
            result = await session.exec(query)
            all_time_results = list(result.all())
            if all_time_results:
                print()
                for rank, (name, total_xp) in enumerate(all_time_results, 1):
                    medal = "🥇" if rank == 1 else "🥈" if rank == 2 else "🥉" if rank == 3 else "  "
                    print(f"{medal} #{rank:2d} | {name:20s} | {int(total_xp):5d} XP")
            
            # ========================================
            # 5. DATABASE STATISTICS
            # ========================================
            print("\n" + "-" * 70)
            print("📊 DATABASE STATISTICS")
            print("-" * 70)
            
            # Total daily progress records
            query = select(DailyProgress)
            result = await session.exec(query)
            rows = result.all()
            all_daily = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in rows]
            total_daily = len(all_daily)
            print(f"\n   Total Daily Progress Records: {total_daily}")
            
            # Total leaderboard entries
            query = select(LeaderboardEntry)
            result = await session.exec(query)
            rows = result.all()
            all_leaderboard = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in rows]
            total_leaderboard = len(all_leaderboard)
            print(f"   Total Leaderboard Entries: {total_leaderboard}")
            
            # Total gamification profiles
            query = select(UserGamification)
            result = await session.exec(query)
            rows = result.all()
            all_profiles = [row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row for row in rows]
            total_profiles = len(all_profiles)
            print(f"   Total Gamification Profiles: {total_profiles}")
            
            # Average XP per session
            if total_daily > 0:
                avg_xp = sum(r.xp_earned for r in all_daily) / total_daily
                print(f"   Average XP per Session: {avg_xp:.2f}")
            
            # Goal completion rate
            goals_met = sum(1 for r in all_daily if r.goal_met)
            completion_rate = (goals_met / total_daily * 100) if total_daily > 0 else 0
            print(f"   Goal Completion Rate: {completion_rate:.1f}%")
            
            print("\n" + "=" * 70)
            print("✅ VERIFICATION COMPLETE")
            print("=" * 70 + "\n")
    
    finally:
        await repo.dispose()


if __name__ == "__main__":
    asyncio.run(main())
