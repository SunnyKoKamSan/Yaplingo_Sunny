from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import BaseModel
from ulid import ULID

from server.repository import Repository
from server.repository.entities import User
from server.store import Store


class LeaderboardEntry(BaseModel):
    uid: ULID
    name: str
    rank: int
    score: int


LeaderboardPeriod = Literal["this-week", "all-time"]


class GameService:
    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository

    async def init(self) -> None:
        entries = await self.repository.aggregation.list_total_points_per_user()
        await self.store.leaderboard.dump(entries)

    @staticmethod
    def _current_week_bounds_utc() -> tuple[datetime, datetime]:
        now = datetime.now(timezone.utc)
        start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) - timedelta(days=now.weekday())
        end = start + timedelta(days=7)
        return start, end

    async def _hydrate_leaderboard_entries(self, ranked_scores: list[tuple[ULID, int]]) -> list[LeaderboardEntry]:
        users = await self.repository.user.get_many([uid for uid, _ in ranked_scores])
        mapping: dict[ULID, User] = {u.id: u for u in users}

        entries: list[LeaderboardEntry] = []
        for uid, score in ranked_scores:
            if user := mapping.get(uid):
                entries.append(
                    LeaderboardEntry(
                        uid=user.id,
                        name=user.name,
                        rank=len(entries) + 1,
                        score=score,
                    )
                )
        return entries

    async def list_leaderboard(self, period: LeaderboardPeriod = "all-time", limit: int = 50) -> list[LeaderboardEntry]:
        if period == "all-time":
            ranked_scores = await self.store.leaderboard.list(limit)
        else:
            start, end = self._current_week_bounds_utc()
            ranked_scores = (await self.repository.aggregation.list_points_per_user(start=start, end=end))[:limit]

        return await self._hydrate_leaderboard_entries(ranked_scores)

    async def get_leaderboard_user(self, user: User, period: LeaderboardPeriod = "all-time") -> LeaderboardEntry:
        if period == "all-time" and (rank_score := await self.store.leaderboard.get(user)):
            return LeaderboardEntry(
                uid=user.id,
                name=user.name,
                rank=rank_score[0],
                score=rank_score[1],
            )

        if period == "all-time":
            count = await self.store.leaderboard.count()
            return LeaderboardEntry(uid=user.id, name=user.name, rank=count + 1, score=0)

        start, end = self._current_week_bounds_utc()
        ranked_scores = await self.repository.aggregation.list_points_per_user(start=start, end=end)
        for rank, (uid, score) in enumerate(ranked_scores, start=1):
            if uid == user.id:
                return LeaderboardEntry(uid=user.id, name=user.name, rank=rank, score=score)

        return LeaderboardEntry(uid=user.id, name=user.name, rank=len(ranked_scores) + 1, score=0)

    async def get_user_year_activity(self, user: User) -> dict[date, int]:
        tz = ZoneInfo(user.timezone)
        year = datetime.now(tz).year
        start = datetime(year, 1, 1, tzinfo=tz)
        end = datetime(year + 1, 1, 1, tzinfo=tz)
        sessions = await self.repository.aggregation.get_sessions_by_user(user, start=start, end=end)
        return Counter([s.completed_at.astimezone(tz).date() for s in sessions])

    async def get_user_today_points(self, user: User) -> int:
        points_today = await self.store.points.get_today(user)
        if points_today is None:
            return await self.store.points.increment_today(user, 0)
        return points_today

    # TODO: combine into one atomic operation
    async def increment_user_points(self, user: User, points_to_add: int) -> None:
        assert points_to_add >= 0, "points to add must be non-negative"
        points_today = await self.store.points.increment_today(user, points_to_add)
        await self.store.leaderboard.increment(user, points_to_add)
        await self.repository.user.increment_points(user, points_to_add)
        if points_today >= user.streak_milestone and not user.streak_claimed_today:
            await self.repository.user.increment_streak(user)


__all__ = ["GameService", "LeaderboardPeriod"]
