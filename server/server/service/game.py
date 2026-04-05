from collections import Counter
from datetime import date, datetime
from zoneinfo import ZoneInfo

from ulid import ULID

from server.repository import Repository
from server.repository.entities import User
from server.store import Store


class GameService:
    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository

    async def init(self) -> None:
        entries = await self.repository.aggregation.list_total_points_per_user()
        await self.store.leaderboard.dump(entries)

    async def list_leaderboard(self, limit: int = 50) -> list[tuple[User, tuple[int, int]]]:
        top = await self.store.leaderboard.list(limit)

        users = await self.repository.user.get_many([uid for uid, _ in top])
        mapping: dict[ULID, User] = {u.id: u for u in users}

        entries: list[tuple[User, tuple[int, int]]] = []
        for rank, (uid, score) in enumerate(top, start=1):
            entries.append((mapping[uid], (rank, score)))
        return entries

    async def get_leaderboard_user(self, user: User) -> tuple[int, int]:
        if rank_score := await self.store.leaderboard.get(user):
            return rank_score
        count = await self.store.leaderboard.count()
        return (count + 1, 0)

    async def get_user_year_activity(self, user: User) -> dict[date, int]:
        tz = ZoneInfo(user.timezone)
        year = datetime.now(tz).year
        start = datetime(year, 1, 1, tzinfo=tz)
        end = datetime(year + 1, 1, 1, tzinfo=tz)
        sessions = await self.repository.aggregation.get_sessions_by_user(user, start=start, end=end)
        return Counter([s.completed_at.astimezone(tz).date() for s in sessions])

    async def get_user_total_points(self, user: User) -> int:
        sessions = await self.repository.aggregation.get_sessions_by_user(user)
        return sum(s.points for s in sessions)

    async def get_user_today_points(self, user: User) -> int:
        points_today = await self.store.points.get_today(user)
        if points_today is None:
            start = datetime.now(ZoneInfo(user.timezone)).replace(hour=0, minute=0, second=0, microsecond=0)
            sessions = await self.repository.aggregation.get_sessions_by_user(user, start=start)
            points_today = sum(s.points for s in sessions)
            return await self.store.points.increment_today(user, points_today)
        return points_today

    async def increment_user_points(self, user: User, points_to_add: int) -> None:
        assert points_to_add >= 0, "points to add must be non-negative"
        points_today = await self.store.points.increment_today(user, points_to_add)
        await self.store.leaderboard.increment(user, points_to_add)
        if points_today >= user.streak_milestone and not user.streak_claimed_today:
            await self.repository.user.increment_streak(user)


__all__ = ["GameService"]
