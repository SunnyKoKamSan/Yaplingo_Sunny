from collections import Counter
from datetime import date, datetime
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


class AchievementRule(BaseModel):
    key: str
    title: str
    desc: str
    threshold_type: Literal["lifetime_xp", "streak", "lifetime_lessons"]
    threshold: int


class AchievementStatus(BaseModel):
    key: str
    title: str
    desc: str
    unlocked: bool
    unlocked_at: datetime | None = None
    progress: float


class AchievementUnlock(BaseModel):
    achievement_key: str
    unlocked_at: datetime


ACHIEVEMENT_RULES: tuple[AchievementRule, ...] = (
    AchievementRule(
        key="first_step",
        title="First Step",
        desc="Earn your first 10 XP",
        threshold_type="lifetime_xp",
        threshold=10,
    ),
    AchievementRule(
        key="bronze_mic",
        title="Bronze Mic",
        desc="Earn 500 XP lifetime",
        threshold_type="lifetime_xp",
        threshold=500,
    ),
    AchievementRule(
        key="silver_mic",
        title="Silver Mic",
        desc="Earn 2,000 XP lifetime",
        threshold_type="lifetime_xp",
        threshold=2000,
    ),
    AchievementRule(
        key="gold_mic",
        title="Gold Mic",
        desc="Earn 10,000 XP lifetime",
        threshold_type="lifetime_xp",
        threshold=10000,
    ),
    AchievementRule(
        key="platinum_mic",
        title="Platinum Mic",
        desc="Earn 50,000 XP lifetime",
        threshold_type="lifetime_xp",
        threshold=50000,
    ),
    AchievementRule(
        key="diamond_mic",
        title="Diamond Mic",
        desc="Earn 100,000 XP lifetime",
        threshold_type="lifetime_xp",
        threshold=100000,
    ),
    AchievementRule(
        key="streak_5",
        title="On Fire",
        desc="Maintain a 5-day streak",
        threshold_type="streak",
        threshold=5,
    ),
    AchievementRule(
        key="streak_14",
        title="Two Weeks",
        desc="Maintain a 14-day streak",
        threshold_type="streak",
        threshold=14,
    ),
    AchievementRule(
        key="streak_30",
        title="Unstoppable",
        desc="Maintain a 30-day streak",
        threshold_type="streak",
        threshold=30,
    ),
    AchievementRule(
        key="streak_100",
        title="Century",
        desc="Maintain a 100-day streak",
        threshold_type="streak",
        threshold=100,
    ),
    AchievementRule(
        key="streak_365",
        title="Year of Yap",
        desc="Practice every day for a year",
        threshold_type="streak",
        threshold=365,
    ),
    AchievementRule(
        key="lesson_50",
        title="Half Century",
        desc="Complete 50 sessions",
        threshold_type="lifetime_lessons",
        threshold=50,
    ),
    AchievementRule(
        key="lesson_200",
        title="Dedicated",
        desc="Complete 200 sessions",
        threshold_type="lifetime_lessons",
        threshold=200,
    ),
    AchievementRule(
        key="lesson_500",
        title="Lesson Legend",
        desc="Complete 500 sessions",
        threshold_type="lifetime_lessons",
        threshold=500,
    ),
)


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

    @staticmethod
    def _metric_value(rule: AchievementRule, user: User, sessions_total: int) -> int:
        if rule.threshold_type == "lifetime_xp":
            return max(user.points, 0)
        if rule.threshold_type == "streak":
            return max(user.streak, 0)
        return max(sessions_total, 0)

    async def list_achievements(self, user: User) -> list[AchievementStatus]:
        unlocked_map = await self.repository.achievement.list_unlocked(user.id)
        sessions_total = await self.repository.aggregation.count_sessions_by_user(user)

        achievements: list[AchievementStatus] = []
        for rule in ACHIEVEMENT_RULES:
            unlocked_at = unlocked_map.get(rule.key)
            if unlocked_at is not None:
                achievements.append(
                    AchievementStatus(
                        key=rule.key,
                        title=rule.title,
                        desc=rule.desc,
                        unlocked=True,
                        unlocked_at=unlocked_at,
                        progress=1.0,
                    )
                )
                continue

            value = self._metric_value(rule, user, sessions_total)
            progress = min(value / rule.threshold, 1.0) if rule.threshold > 0 else 1.0
            achievements.append(
                AchievementStatus(
                    key=rule.key,
                    title=rule.title,
                    desc=rule.desc,
                    unlocked=False,
                    unlocked_at=None,
                    progress=round(progress, 2),
                )
            )
        return achievements

    async def claim_achievement(self, user: User, achievement_key: str) -> AchievementUnlock:
        rule = next((item for item in ACHIEVEMENT_RULES if item.key == achievement_key), None)
        if rule is None:
            raise ValueError("Unknown achievement")

        unlocked_map = await self.repository.achievement.list_unlocked(user.id)
        if achievement_key in unlocked_map:
            raise ValueError("Achievement already claimed")

        sessions_total = await self.repository.aggregation.count_sessions_by_user(user)
        value = self._metric_value(rule, user, sessions_total)
        if value < rule.threshold:
            raise PermissionError("Achievement criteria not met")

        unlocked_at = await self.repository.achievement.unlock(user.id, achievement_key)
        if unlocked_at is None:
            raise ValueError("Achievement already claimed")

        return AchievementUnlock(
            achievement_key=achievement_key,
            unlocked_at=unlocked_at,
        )


__all__ = ["GameService", "LeaderboardEntry", "AchievementStatus", "AchievementUnlock"]
