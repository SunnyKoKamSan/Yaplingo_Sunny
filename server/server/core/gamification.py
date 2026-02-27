"""
Gamification core logic.

Contains shared streak calculation utilities with server-side authority.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from server.repository.gamification import UserGamification, UserInventory


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
    
    If the streak would break (missed >1 day), checks for an available streak
    freeze in UserInventory and consumes it to preserve the streak.

    Args:
        session: Active async database session.
        user_id: User identifier.

    Returns:
        The updated current streak value.
    """
    today_utc: date = datetime.now(timezone.utc).date()
    
    query = select(UserGamification).where(UserGamification.user_id == user_id)
    result = await session.exec(query)
    user_gamification = result.one_or_none()

    if user_gamification is None:
        user_gamification = UserGamification(
            user_id=user_id,
            current_streak=1,
            last_activity_date=today_utc.strftime("%Y-%m-%d"),
        )
        session.add(user_gamification)
        return 1

    last_activity_date: Optional[date] = None
    if user_gamification.last_activity_date:
        last_activity_date = datetime.strptime(
            user_gamification.last_activity_date,
            "%Y-%m-%d",
        ).date()

    # Scenario A: Already practiced today
    if last_activity_date == today_utc:
        pass
    
    # Scenario B: Consecutive day (yesterday)
    elif last_activity_date == today_utc - timedelta(days=1):
        user_gamification.current_streak += 1
        user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")
    
    # Scenario C: Missed day(s) — check for streak freeze
    else:
        freeze_used = False
        if last_activity_date and last_activity_date == today_utc - timedelta(days=2):
            # Only missed exactly one day — eligible for streak freeze
            inv_result = await session.exec(
                select(UserInventory).where(UserInventory.user_id == user_id)
            )
            inventory = inv_result.one_or_none()
            if inventory and (isinstance(inventory, tuple) or hasattr(inventory, "__getitem__")):
                inventory = inventory[0]
            if inventory and inventory.streak_freezes > 0:
                inventory.streak_freezes -= 1
                session.add(inventory)
                user_gamification.current_streak += 1
                user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")
                freeze_used = True

        if not freeze_used:
            user_gamification.current_streak = 1
            user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")

    session.add(user_gamification)
    return user_gamification.current_streak
