from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from .entities import UserAchievement


class AchievementRepository:
    def __init__(self, session: async_sessionmaker[AsyncSession]):
        self._session = session

    async def list_unlocked(self, user_id: ULID) -> dict[str, datetime]:
        async with self._session() as session:
            query = select(UserAchievement).where(UserAchievement.user_id == user_id)
            rows = (await session.exec(query)).all()
            return {row.achievement_key: row.unlocked_at for row in rows}

    async def unlock(self, user_id: ULID, achievement_key: str) -> datetime | None:
        async with self._session() as session:
            query = select(UserAchievement).where(
                UserAchievement.user_id == user_id,
                UserAchievement.achievement_key == achievement_key,
            )
            existing = (await session.exec(query)).one_or_none()
            if existing is not None:
                return None

            achievement = UserAchievement(
                user_id=user_id,
                achievement_key=achievement_key,
            )
            session.add(achievement)
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                return None
            await session.refresh(achievement)
            return achievement.unlocked_at


__all__ = ["AchievementRepository"]
