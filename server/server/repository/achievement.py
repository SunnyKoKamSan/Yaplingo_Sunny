from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from .entities import UserAchievement


class AchievementRepository:
    def __init__(self, session: async_sessionmaker[AsyncSession]):
        self._session = session

    async def list(self, uid: ULID) -> dict[str, UserAchievement]:
        async with self._session() as session:
            query = select(UserAchievement).where(UserAchievement.user_id == uid)
            results = await session.exec(query)
            return {ua.key: ua for ua in results.all()}

    async def claim(self, uid: ULID, key: str) -> None:
        async with self._session() as session:
            ua = UserAchievement(user_id=uid, key=key)
            session.add(ua)
            await session.commit()


__all__ = ["AchievementRepository"]
