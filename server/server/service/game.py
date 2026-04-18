from collections import Counter
from datetime import date, datetime, timedelta
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


class UserStatistics(BaseModel):
    class ProgressEntry(BaseModel):
        date: datetime
        points: int
        count: int

    progress: list[ProgressEntry]
    average_points_7d: float
    best_streak_30d: int
    total_points_30d: int
    completion_rate_30d: float


class GameService:
    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository

    async def init(self) -> None:
        entries = await self.repository.aggregation.list_total_points_per_user()
        await self.store.leaderboard.dump(entries)

    async def list_leaderboard(self, limit: int = 50) -> list[LeaderboardEntry]:
        top = await self.store.leaderboard.list(limit)

        users = await self.repository.user.get_many([uid for uid, _ in top])
        mapping: dict[ULID, User] = {u.id: u for u in users}

        entries: list[LeaderboardEntry] = []
        for rank, (uid, score) in enumerate(top, start=1):
            user = mapping[uid]
            entries.append(
                LeaderboardEntry(
                    uid=user.id,
                    name=user.name,
                    rank=rank,
                    score=score,
                )
            )
        return entries

    async def get_leaderboard_user(self, user: User) -> LeaderboardEntry:
        if rank_score := await self.store.leaderboard.get(user):
            return LeaderboardEntry(
                uid=user.id,
                name=user.name,
                rank=rank_score[0],
                score=rank_score[1],
            )
        count = await self.store.leaderboard.count()
        return LeaderboardEntry(uid=user.id, name=user.name, rank=count + 1, score=0)

    async def get_user_year_activity(self, user: User) -> dict[date, int]:
        tz = ZoneInfo(user.timezone)
        year = datetime.now(tz).year
        start = datetime(year, 1, 1, tzinfo=tz)
        end = datetime(year + 1, 1, 1, tzinfo=tz)
        sessions = await self.repository.aggregation.get_sessions_by_user(user, start=start, end=end)
        return Counter([s.completed_at.astimezone(tz).date() for s in sessions])

    async def get_user_today_points(self, user: User) -> int:
        points_today = await self.store.user.get_points_today(user)
        if points_today is None:
            return await self.store.user.increment_points_today(user, 0)
        return points_today

    async def get_user_points_progress(self, user: User, days: int = 30) -> list[UserStatistics.ProgressEntry]:
        tz = ZoneInfo(user.timezone)
        today = datetime.now(tz).date()
        start = today - timedelta(days=days - 1)
        start = datetime(start.year, start.month, start.day, tzinfo=tz)
        end = datetime(today.year, today.month, today.day, tzinfo=tz) + timedelta(days=1)

        sessions = await self.repository.aggregation.get_sessions_by_user(user, start=start, end=end)

        daily_points: dict[str, int] = {}
        daily_sessions: dict[str, int] = {}
        for s in sessions:
            key = s.completed_at.astimezone(tz).date().isoformat()
            daily_points[key] = daily_points.get(key, 0) + s.points
            daily_sessions[key] = daily_sessions.get(key, 0) + 1

        progress: list[UserStatistics.ProgressEntry] = []
        current = start
        while current <= end:
            key = current.date().isoformat()
            progress.append(
                UserStatistics.ProgressEntry(
                    date=current,
                    points=daily_points.get(key, 0),
                    count=daily_sessions.get(key, 0),
                )
            )
            current += timedelta(days=1)
        return progress

    async def get_user_stats(self, user: User) -> UserStatistics:
        progress = await self.get_user_points_progress(user, 30)

        last_7_days = progress[-7:]
        average_points = sum(e.points for e in last_7_days) / 7
        active_days = sum(1 for e in progress if e.count > 0)
        completion_rate = (active_days / 30) * 100

        best_streak = current_run = 0
        for entry in progress:
            if entry.points > 0:
                current_run += 1
                best_streak = max(best_streak, current_run)
            else:
                current_run = 0

        total_points = sum(e.points for e in progress)

        return UserStatistics(
            progress=progress,
            average_points_7d=round(average_points, 1),
            best_streak_30d=best_streak,
            total_points_30d=total_points,
            completion_rate_30d=round(completion_rate, 1),
        )


__all__ = ["GameService", "LeaderboardEntry", "UserStatistics"]
