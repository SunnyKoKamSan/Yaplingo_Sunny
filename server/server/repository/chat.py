from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from .models import ChatSession, User


class ChatRepository:
    def __init__(self, session: async_sessionmaker[AsyncSession]):
        self._session = session

    async def save(self, s: ChatSession) -> ChatSession:
        # FIXME: this should be optimized with back population
        async with self._session() as session:
            user = await session.get(User, s.user_id)
            if user is not None:
                user.points += s.points
                session.add(s)
            await session.commit()
        return s


__all__ = ["ChatRepository"]
