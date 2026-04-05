from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from .entities import User
from .exceptions import EntityExistsError


class UserRepository:
    def __init__(self, session: async_sessionmaker[AsyncSession]):
        self._session = session

    async def dump(self, user: User) -> User:
        try:
            async with self._session() as session:
                session.add(user)
                await session.commit()
        except IntegrityError:
            raise EntityExistsError()
        return user

    async def get_one(self, uid_name: ULID | str) -> User | None:
        async with self._session() as session:
            if isinstance(uid_name, ULID):
                user = await session.get(User, uid_name)
            else:
                query = select(User).where(User.name == uid_name)
                user = (await session.exec(query)).one_or_none()
            return user

    async def get_many(self, uids: list[ULID]) -> list[User]:
        if not uids:
            return []
        async with self._session() as session:
            query = select(User).where(col(User.id).in_(uids))
            results = await session.exec(query)
            return list(results.all())

    async def reset_streak(self, user: User) -> None:
        async with self._session() as session:
            user.streak = 0
            session.add(user)
            await session.commit()

    async def increment_streak(self, user: User) -> None:
        now = datetime.now(ZoneInfo("UTC"))
        today = now.date()
        expected = user.streaked_at.date() + timedelta(days=1)
        async with self._session() as session:
            user.streak = user.streak + 1 if expected == today else 1
            user.streaked_at = now
            session.add(user)
            await session.commit()


__all__ = ["UserRepository"]
