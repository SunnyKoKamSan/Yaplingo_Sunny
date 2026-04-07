from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, union_all
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession
from ulid import ULID

from .entities import ChatSession, EchoSession, User


class AggregationRepository:
    def __init__(self, session: async_sessionmaker[AsyncSession]):
        self._session = session

    async def get_sessions_by_user(
        self,
        user: User,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[EchoSession | ChatSession]:
        start = start.astimezone(ZoneInfo("UTC")) if start else None
        end = end.astimezone(ZoneInfo("UTC")) if end else None
        async with self._session() as session:
            query = union_all(
                select(EchoSession).where(
                    EchoSession.user_id == user.id,
                    *([EchoSession.completed_at >= start] if start else []),
                    *([EchoSession.completed_at < end] if end else []),
                ),
                select(ChatSession).where(
                    ChatSession.user_id == user.id,
                    *([ChatSession.completed_at >= start] if start else []),
                    *([ChatSession.completed_at < end] if end else []),
                ),
            )
            results = await session.exec(query)  # type: ignore
            return list(results.all())

    async def list_total_points_per_user(self) -> list[tuple[ULID, int]]:
        async with self._session() as session:
            query = select(
                col(User.id),
                func.coalesce(func.sum(User.points), 0),
            ).group_by(col(User.id))
            results = await session.exec(query)
            return [(uid, int(points)) for (uid, points) in results.all()]


__all__ = ["AggregationRepository"]
