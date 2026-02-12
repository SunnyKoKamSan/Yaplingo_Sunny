#!/usr/bin/env python3
"""
Gamification Data Seeding Script
=================================
Creates test data for the Gamification system including:
- Dummy users
- 14 days of historical daily progress
- Leaderboard entries
- Streak information

Usage:
    cd server
    uv run python scripts/seed_gamification.py
"""
import asyncio
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

# Add the server directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

# Import repository and models
from server.repository import Repository
from server.repository.gamification import DailyProgress, LeaderboardEntry, UserGamification
from server.repository.models import Language, User


# ============================================================================
# CONFIGURATION
# ============================================================================
SEED_USER_COUNT = 5
HISTORY_DAYS = 14
PRACTICE_PROBABILITY = 0.7  # 70% chance user practiced on a given day
MIN_XP = 20
MAX_XP = 100
GOAL_THRESHOLD = 40  # XP needed to meet daily goal


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def get_date_key(date: datetime) -> str:
    """Convert datetime to YYYY-MM-DD string format."""
    return date.strftime("%Y-%m-%d")


def get_week_period_key(date: datetime) -> str:
    """
    Generate weekly period key in format: WEEK-YYYY-WW
    Example: WEEK-2024-05
    """
    year, week, _ = date.isocalendar()
    return f"WEEK-{year}-{week:02d}"


def generate_username(index: int) -> str:
    """Generate a unique username for seeding."""
    return f"seed_user_{index:02d}"


# ============================================================================
# DATABASE OPERATIONS
# ============================================================================
async def check_user_exists(session: AsyncSession, username: str) -> bool:
    """Check if a user with the given username already exists."""
    query = select(User).where(User.name == username)
    result = await session.exec(query)
    return result.one_or_none() is not None


async def create_seed_users(session: AsyncSession) -> List[User]:
    """
    Create dummy users for testing.
    Returns list of created users (skips if already exist).
    """
    users = []
    
    for i in range(1, SEED_USER_COUNT + 1):
        username = generate_username(i)
        
        # Check for idempotency
        if await check_user_exists(session, username):
            print(f"   ⏭️  User '{username}' already exists, skipping...")
            # Fetch existing user
            query = select(User).where(User.name == username)
            result = await session.exec(query)
            row = result.one()
            # Extract User object from Row tuple
            user = row[0] if isinstance(row, tuple) or hasattr(row, '__getitem__') else row
            users.append(user)
            continue
        
        # Create new user
        user = User(
            id=ULID(),
            name=username,
            password="hashed_password_for_testing",  # Not real hash, just for seeding
            language=Language.ENGLISH
        )
        session.add(user)
        users.append(user)
        print(f"   ✅ Created user: {username} (ID: {user.id})")
    
    await session.commit()
    return users


async def seed_daily_progress(
    session: AsyncSession,
    user: User,
    date: datetime
) -> int:
    """
    Create a DailyProgress record for a user on a specific date.
    Returns the XP earned.
    """
    date_key = get_date_key(date)
    xp = random.randint(MIN_XP, MAX_XP)
    goal_met = xp >= GOAL_THRESHOLD
    
    # Check if record already exists
    existing = await session.get(DailyProgress, {"user_id": user.id, "date_key": date_key})
    if existing:
        return existing.xp_earned
    
    daily = DailyProgress(
        user_id=user.id,
        date_key=date_key,
        xp_earned=xp,
        goal_met=goal_met,
        lessons_completed=random.randint(1, 5)
    )
    session.add(daily)
    return xp


async def update_leaderboard(
    session: AsyncSession,
    user: User,
    date: datetime,
    xp: int
):
    """
    Update or create a LeaderboardEntry for the user's weekly period.
    """
    period_key = get_week_period_key(date)
    
    # Check if entry exists
    entry = await session.get(LeaderboardEntry, {"user_id": user.id, "period_key": period_key})
    
    if entry:
        entry.total_xp += xp
    else:
        entry = LeaderboardEntry(
            user_id=user.id,
            period_key=period_key,
            total_xp=xp
        )
        session.add(entry)


async def update_user_gamification(
    session: AsyncSession,
    user: User,
    last_date: datetime
):
    """
    Create or update UserGamification profile with streak information.
    """
    # Check if profile exists
    profile = await session.get(UserGamification, user.id)
    
    if profile:
        # Update existing
        profile.current_streak = random.randint(1, 10)
        profile.last_activity_date = get_date_key(last_date)
    else:
        # Create new
        profile = UserGamification(
            user_id=user.id,
            current_streak=random.randint(1, 10),
            last_activity_date=get_date_key(last_date)
        )
        session.add(profile)


async def seed_user_history(session: AsyncSession, user: User):
    """
    Generate 14 days of historical data for a single user.
    """
    print(f"\n   📅 Generating history for {user.name}...")
    
    today = datetime.now()
    start_date = today - timedelta(days=HISTORY_DAYS - 1)
    
    last_practice_date = None
    total_xp = 0
    
    for day_offset in range(HISTORY_DAYS):
        current_date = start_date + timedelta(days=day_offset)
        
        # 70% chance the user practiced
        if random.random() < PRACTICE_PROBABILITY:
            xp = await seed_daily_progress(session, user, current_date)
            await update_leaderboard(session, user, current_date, xp)
            last_practice_date = current_date
            total_xp += xp
            print(f"      ✓ Day {day_offset + 1}: {get_date_key(current_date)} → {xp} XP")
        else:
            print(f"      ○ Day {day_offset + 1}: {get_date_key(current_date)} → No practice")
    
    # Update streak information
    if last_practice_date:
        await update_user_gamification(session, user, last_practice_date)
    
    print(f"      💎 Total XP earned: {total_xp}")


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================
async def main():
    """
    Main async function to seed gamification data.
    """
    print("\n" + "=" * 70)
    print("🌱 GAMIFICATION DATA SEEDING SCRIPT")
    print("=" * 70)
    
    # Initialize repository
    print("\n📦 Initializing database connection...")
    repo = await Repository.create()
    
    try:
        async with repo.session() as session:
            # Step 1: Create users
            print(f"\n👥 Creating {SEED_USER_COUNT} seed users...")
            users = await create_seed_users(session)
            
            # Step 2: Generate historical data
            print(f"\n📊 Generating {HISTORY_DAYS} days of historical data...")
            for user in users:
                await seed_user_history(session, user)
            
            # Commit all changes
            await session.commit()
            
            print("\n" + "=" * 70)
            print("✨ SEEDING COMPLETED SUCCESSFULLY!")
            print("=" * 70)
            print(f"\n📈 Summary:")
            print(f"   • Users created/verified: {len(users)}")
            print(f"   • Days of history: {HISTORY_DAYS}")
            print(f"   • Practice probability: {PRACTICE_PROBABILITY * 100}%")
            print(f"   • XP range per session: {MIN_XP}-{MAX_XP}")
            print("\n✅ You can now run your tests or demo the gamification features!\n")
    
    finally:
        # Clean up
        await repo.dispose()


# ============================================================================
# SCRIPT EXECUTION
# ============================================================================
if __name__ == "__main__":
    asyncio.run(main())
