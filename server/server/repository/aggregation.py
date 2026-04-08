from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload
from sqlmodel import col, func, select, union_all
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

    async def get_sessions_with_pronunciation_by_user(
        self,
        user: User,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> tuple[list[EchoSession], list[ChatSession]]:
        """
        Fetch user's sessions with pronunciation data (eager loads attempts/turns).
        Returns separate lists since they have different relationship structures.
        """
        start = start.astimezone(ZoneInfo("UTC")) if start else None
        end = end.astimezone(ZoneInfo("UTC")) if end else None

        async with self._session() as session:
            echo_query = (
                select(EchoSession)
                .where(
                    EchoSession.user_id == user.id,
                    *([EchoSession.completed_at >= start] if start else []),
                    *([EchoSession.completed_at < end] if end else []),
                )
                .options(selectinload(EchoSession.attempts))  # type: ignore[arg-type]
            )
            echo_results = await session.exec(echo_query)
            echo_sessions = list(echo_results.all())

            chat_query = (
                select(ChatSession)
                .where(
                    ChatSession.user_id == user.id,
                    *([ChatSession.completed_at >= start] if start else []),
                    *([ChatSession.completed_at < end] if end else []),
                )
                .options(selectinload(ChatSession.turns))  # type: ignore[arg-type]
            )
            chat_results = await session.exec(chat_query)
            chat_sessions = list(chat_results.all())

            return echo_sessions, chat_sessions

    async def list_total_points_per_user(self) -> list[tuple[ULID, int]]:
        async with self._session() as session:
            query = select(
                col(User.id),
                func.coalesce(func.sum(User.points), 0),
            ).group_by(col(User.id))
            results = await session.exec(query)
            return [(uid, int(points)) for (uid, points) in results.all()]

    async def count_sessions_by_user(self, user: User) -> int:
        async with self._session() as session:
            echo_count = int((await session.exec(
                select(func.count()).select_from(EchoSession).where(EchoSession.user_id == user.id)
            )).one())
            chat_count = int((await session.exec(
                select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user.id)
            )).one())
            return echo_count + chat_count


__all__ = ["AggregationRepository"]
