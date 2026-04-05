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

        async with self._session() as session:
            results = await session.exec(query)  # type: ignore
            return list(results.all())

    async def list_total_points_per_user(self) -> list[tuple[ULID, int]]:
        subquery = union_all(
            select(
                col(EchoSession.user_id).label("user_id"),
                col(EchoSession.points).label("points"),
            ),
            select(
                col(ChatSession.user_id).label("user_id"),
                col(ChatSession.points).label("points"),
            ),
        ).subquery()

        query = select(
            subquery.c.user_id,
            func.coalesce(func.sum(subquery.c.points), 0),
        ).group_by(subquery.c.user_id)

        async with self._session() as session:
            results = await session.exec(query)
            return [(uid, int(points)) for (uid, points) in results.all()]


__all__ = ["AggregationRepository"]
