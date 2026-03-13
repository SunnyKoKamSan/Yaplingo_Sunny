from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from server.repository.gamification import UserGamification


def get_period_key(dt: date) -> str:
    """ISO week-based period key, e.g. 'WEEK-2026-04'."""
    iso_year, iso_week, _ = dt.isocalendar()
    return f"WEEK-{iso_year}-{iso_week:02d}"


def get_current_utc_period_key() -> str:
    now_utc = datetime.now(timezone.utc)
    year, week, _ = now_utc.isocalendar()
    return f"WEEK-{year}-{week:02d}"


def get_visible_streak_utc(user_gamification: Optional[UserGamification]) -> int:
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


async def update_streak_utc(session: AsyncSession, user_id: ULID) -> int:
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
            user_gamification.last_activity_date, "%Y-%m-%d"
        ).date()

    if last_activity_date == today_utc:
        pass
    elif last_activity_date == today_utc - timedelta(days=1):
        user_gamification.current_streak += 1
        user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")
    else:
        user_gamification.current_streak = 1
        user_gamification.last_activity_date = today_utc.strftime("%Y-%m-%d")

    session.add(user_gamification)
    return user_gamification.current_streak
