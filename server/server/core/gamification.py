"""
Gamification core logic.

Contains shared streak calculation utilities with server-side authority.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from server.repository.gamification import UserGamification


def get_period_key(dt: date) -> str:
    """
    Generate ISO week-based period key for leaderboard grouping.
    
    Uses ISO 8601 week date system where:
    - Week starts on Monday
    - Week 1 contains the first Thursday of the year
    - Year may differ from calendar year at boundaries
    
    Args:
        dt: Date to convert to period key
        
    Returns:
        Period key in format "WEEK-YYYY-WW"
        
    Examples:
        >>> get_period_key(date(2026, 1, 21))
        'WEEK-2026-04'
        >>> get_period_key(date(2026, 1, 5))  # Could be week 53 of 2025
        'WEEK-2026-02'
    """
    iso_year, iso_week, _ = dt.isocalendar()
    return f"WEEK-{iso_year}-{iso_week:02d}"


def get_visible_streak_utc(user_gamification: Optional[UserGamification]) -> int:
    """
    Return the streak value that should be shown to clients.

    Rules:
    - If user has no profile/activity, show 0.
    - If last activity is today or yesterday (UTC), show stored streak.
    - If at least one full day was missed, show 0 until next check-in.
    """
    if user_gamification is None:
        return 0

    last_activity = user_gamification.last_activity_date
    if not last_activity:
        return 0

    try:
        last_activity_date = datetime.strptime(last_activity, "%Y-%m-%d").date()
    except ValueError:
        return 0

    today_utc = datetime.now(timezone.utc).date()
    if last_activity_date < today_utc - timedelta(days=1):
        return 0

    return user_gamification.current_streak


async def update_streak_utc(
    session: AsyncSession,
    user_id: ULID,
) -> int:
    """
    Update the user's streak based on server UTC time.
    
    This prevents users from cheating by manipulating device time.
    Server-side authority ensures all users are judged by the same clock.

    Args:
        session: Active async database session.
        user_id: User identifier.

    Returns:
        The updated current streak value.
    """
    # Get today's date in UTC (server authority)
    today_utc: date = datetime.now(timezone.utc).date()
    
    # Fetch or create user gamification profile
    query = select(UserGamification).where(UserGamification.user_id == user_id)
    result = await session.exec(query)
    user_gamification = result.one_or_none()

    if user_gamification is None:
        # First time user - initialize with streak of 1
        user_gamification = UserGamification(
            user_id=user_id,
            current_streak=1,
            last_activity_date=today_utc.strftime("%Y-%m-%d"),
        )
        session.add(user_gamification)
        return 1

    # Parse last activity date
    last_activity_date: Optional[date] = None
    if user_gamification.last_activity_date:
        last_activity_date = datetime.strptime(
            user_gamification.last_activity_date,
            "%Y-%m-%d",
        ).date()

    # Scenario A: Already practiced today
    if last_activity_date == today_utc:
        # No change - user already checked in today
        pass
    
    # Scenario B: Consecutive day (yesterday)
    elif last_activity_date == today_utc - timedelta(days=1):
        # Streak continues! Increment by 1
        user_gamification.current_streak += 1
        user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")
    
    # Scenario C: Missed day(s) or first time
    else:
        # Streak broken or first activity - reset to 1
        user_gamification.current_streak = 1
        user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")

    session.add(user_gamification)
    return user_gamification.current_streak
