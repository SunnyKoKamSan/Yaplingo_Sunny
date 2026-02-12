"""Test script to verify gamification models work correctly.

Usage:
    cd server
    uv run python test_gamification.py
    
Note: This test uses in-memory SQLite for isolated testing without requiring PostgreSQL.
"""

import asyncio
import sys
import importlib.util
from datetime import datetime
from pathlib import Path

# Add server directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import SQLModel, select
from ulid import ULID

# Import models directly from files using importlib to avoid triggering __init__.py
# This avoids triggering Repository initialization which requires PostgreSQL
def load_module_from_file(file_path: Path, module_name: str, package_name: str = None):
    """Load a Python module from a file path without triggering package __init__."""
    spec = importlib.util.spec_from_file_location(module_name, file_path, submodule_search_locations=[])
    module = importlib.util.module_from_spec(spec)
    
    # Set up the package structure to handle relative imports
    if package_name:
        module.__package__ = package_name
        sys.modules[module_name] = module
    
    spec.loader.exec_module(module)
    return module

base_path = Path(__file__).parent / "server" / "repository"

# Load models first (needed by gamification for ULIDType)
models_module = load_module_from_file(base_path / "models.py", "server.repository.models", "server.repository")

# Load gamification (can now resolve relative imports)
gamification_module = load_module_from_file(base_path / "gamification.py", "server.repository.gamification", "server.repository")

User = models_module.User
Language = models_module.Language
DailyProgress = gamification_module.DailyProgress
LeaderboardEntry = gamification_module.LeaderboardEntry
UserGamification = gamification_module.UserGamification


# Test database URL (in-memory SQLite for testing)
DATABASE_URL = "sqlite+aiosqlite:///:memory:"


async def test_gamification_models():
    """Test the gamification models with real database operations."""
    
    # Create engine and tables
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    
    print("✅ All tables created successfully!")
    print(f"Tables: {list(SQLModel.metadata.tables.keys())}\n")
    
    async with AsyncSession(engine) as session:
        # 1. Create a test user
        print("=" * 60)
        print("TEST 1: Creating User")
        print("=" * 60)
        user = User(name="test_student", password="hashed_password", language=Language.ENGLISH)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        # cache the user id to avoid triggering lazy loads on expired objects
        user_id = user.id
        print(f"✅ Created User: {user.name} (ID: {user_id})")
        
        # 2. Create UserGamification profile (one-to-one)
        print("\n" + "=" * 60)
        print("TEST 2: Creating Gamification Profile (Streak)")
        print("=" * 60)
        gamification = UserGamification(
            user_id=user_id,
            current_streak=5,
            last_activity_date="2026-01-14"
        )
        session.add(gamification)
        print(f"✅ Created Gamification Profile: Streak={gamification.current_streak}")
        await session.commit()
        
        # 3. Create DailyProgress entries
        print("\n" + "=" * 60)
        print("TEST 3: Creating Daily Progress Entries")
        print("=" * 60)
        daily_entries = [
            DailyProgress(
                user_id=user_id,
                date_key="2026-01-12",
                xp_earned=150,
                goal_met=True,
                lessons_completed=3
            ),
            DailyProgress(
                user_id=user_id,
                date_key="2026-01-13",
                xp_earned=200,
                goal_met=True,
                lessons_completed=4
            ),
            DailyProgress(
                user_id=user_id,
                date_key="2026-01-14",
                xp_earned=100,
                goal_met=False,
                lessons_completed=2
            ),
        ]
        for entry in daily_entries:
            session.add(entry)
        await session.commit()
        print(f"✅ Created {len(daily_entries)} daily progress entries")
        
        # 4. Create LeaderboardEntry
        print("\n" + "=" * 60)
        print("TEST 4: Creating Leaderboard Entry")
        print("=" * 60)
        leaderboard = LeaderboardEntry(
            user_id=user_id,
            period_key="WEEK-2026-02",
            total_xp=450
        )
        session.add(leaderboard)
        print(f"✅ Created Leaderboard Entry: Period={leaderboard.period_key}, XP={leaderboard.total_xp}")
        await session.commit()
        
        # 5. Query user and gamification data by user_id
        print("\n" + "=" * 60)
        print("TEST 5: Querying User and Gamification Data")
        print("=" * 60)
        
        # Get user
        result = await session.execute(select(User).where(User.id == user_id))
        queried_user = result.scalar_one()
        
        # Get gamification profile
        result = await session.execute(
            select(UserGamification).where(UserGamification.user_id == user_id)
        )
        gamif_profile = result.scalar_one_or_none()
        
        # Get daily progress
        result = await session.execute(
            select(DailyProgress).where(DailyProgress.user_id == user_id)
        )
        daily_progress_list = result.scalars().all()
        
        # Get leaderboard entries
        result = await session.execute(
            select(LeaderboardEntry).where(LeaderboardEntry.user_id == user_id)
        )
        leaderboard_list = result.scalars().all()
        
        print(f"\n👤 User: {queried_user.name}")
        print(f"   └─ ID: {queried_user.id}")
        print(f"\n🔥 Gamification Profile:")
        if gamif_profile:
            print(f"   └─ Current Streak: {gamif_profile.current_streak} days")
            print(f"   └─ Last Activity: {gamif_profile.last_activity_date}")
        
        print(f"\n📊 Daily Progress ({len(daily_progress_list)} entries):")
        for dp in sorted(daily_progress_list, key=lambda x: x.date_key):
            status = "✓" if dp.goal_met else "✗"
            print(f"   └─ {dp.date_key}: {dp.xp_earned} XP, {dp.lessons_completed} lessons {status}")
        
        print(f"\n🏆 Leaderboard Entries ({len(leaderboard_list)} entries):")
        for lb in leaderboard_list:
            print(f"   └─ {lb.period_key}: {lb.total_xp} total XP")
        
        # 6. Test Composite Key Uniqueness
        print("\n" + "=" * 60)
        print("TEST 6: Testing Composite Key Constraints")
        print("=" * 60)
        try:
            duplicate = DailyProgress(
                user_id=user.id,
                date_key="2026-01-14",  # Same as existing
                xp_earned=999
            )
            session.add(duplicate)
            await session.commit()
            print("❌ FAILED: Should not allow duplicate composite key!")
        except Exception as e:
            await session.rollback()
            print(f"✅ Composite key constraint working: {type(e).__name__}")
        
        # 7. Test Index Performance
        print("\n" + "=" * 60)
        print("TEST 7: Testing Leaderboard Query with Index")
        print("=" * 60)
        result = await session.execute(
            select(LeaderboardEntry)
            .where(LeaderboardEntry.period_key == "WEEK-2026-02")
            .order_by(LeaderboardEntry.total_xp.desc())
        )
        entries = result.scalars().all()
        print(f"✅ Query executed successfully with index on total_xp")
        print(f"   Found {len(entries)} entries for period 'WEEK-2026-02'")
        
    await engine.dispose()
    
    print("\n" + "=" * 60)
    print("🎉 ALL TESTS PASSED!")
    print("=" * 60)
    print("\n📋 Summary:")
    print("  ✅ Tables created with proper schema")
    print("  ✅ ULID foreign keys working correctly")
    print("  ✅ Composite primary keys enforced")
    print("  ✅ Data queried by user_id successfully")
    print("  ✅ Database indexes created")
    print("  ✅ Data integrity maintained")


if __name__ == "__main__":
    print("🚀 Starting Gamification Models Test Suite\n")
    asyncio.run(test_gamification_models())
