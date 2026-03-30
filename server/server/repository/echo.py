from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from .entities import EchoSession


class EchoRepository:
    def __init__(self, session: async_sessionmaker[AsyncSession]):
        self._session = session

    async def save(self, s: EchoSession) -> EchoSession:
        async with self._session() as session:
            session.add(s)
            await session.commit()
        return s


__all__ = ["EchoRepository"]
