from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from .exceptions import EntityExistsError
from .models import User


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

    async def get(self, uid_name: ULID | str) -> User | None:
        async with self._session() as session:
            if isinstance(uid_name, ULID):
                user = await session.get(User, uid_name)
            else:
                query = select(User).where(User.name == uid_name)
                user = (await session.exec(query)).one_or_none()
        return user


__all__ = ["UserRepository"]
