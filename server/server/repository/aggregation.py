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

    async def list_points_per_user(
        self,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[tuple[ULID, int]]:
        start = start.astimezone(ZoneInfo("UTC")) if start else None
        end = end.astimezone(ZoneInfo("UTC")) if end else None

        async with self._session() as session:
            echo_query = (
                select(
                    col(EchoSession.user_id).label("user_id"),
                    func.coalesce(func.sum(EchoSession.points), 0).label("points"),
                )
                .where(
                    *([EchoSession.completed_at >= start] if start else []),
                    *([EchoSession.completed_at < end] if end else []),
                )
                .group_by(col(EchoSession.user_id))
            )

            chat_query = (
                select(
                    col(ChatSession.user_id).label("user_id"),
                    func.coalesce(func.sum(ChatSession.points), 0).label("points"),
                )
                .where(
                    *([ChatSession.completed_at >= start] if start else []),
                    *([ChatSession.completed_at < end] if end else []),
                )
                .group_by(col(ChatSession.user_id))
            )

            combined = union_all(echo_query, chat_query).subquery()
            query = (
                select(
                    combined.c.user_id,
                    func.coalesce(func.sum(combined.c.points), 0).label("total_points"),
                )
                .group_by(combined.c.user_id)
                .order_by(func.coalesce(func.sum(combined.c.points), 0).desc())
            )
            results = await session.exec(query)
            return [(uid, int(points)) for (uid, points) in results.all()]


__all__ = ["AggregationRepository"]
