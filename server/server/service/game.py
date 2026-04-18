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
    description: str
    threshold_type: Literal["points", "streak", "sessions", "rank"]
    threshold_value: int


class AchievementStatus(AchievementRule):
    progress: float
    claimed_at: datetime | None = None


ACHIEVEMENT_RULES: tuple[AchievementRule, ...] = (
    AchievementRule(
        key="first_step",
        title="First Step",
        description="Earn your first 10 XP",
        threshold_type="points",
        threshold_value=10,
    ),
    AchievementRule(
        key="bronze_mic",
        title="Bronze Mic",
        description="Earn 500 XP total",
        threshold_type="points",
        threshold_value=500,
    ),
    AchievementRule(
        key="silver_mic",
        title="Silver Mic",
        description="Earn 2,000 XP total",
        threshold_type="points",
        threshold_value=2000,
    ),
    AchievementRule(
        key="gold_mic",
        title="Gold Mic",
        description="Earn 10,000 XP total",
        threshold_type="points",
        threshold_value=10000,
    ),
    AchievementRule(
        key="platinum_mic",
        title="Platinum Mic",
        description="Earn 50,000 XP total",
        threshold_type="points",
        threshold_value=50000,
    ),
    AchievementRule(
        key="diamond_mic",
        title="Diamond Mic",
        description="Earn 100,000 XP total",
        threshold_type="points",
        threshold_value=100000,
    ),
    AchievementRule(
        key="streak_5",
        title="On Fire",
        description="Maintain a 5-day streak",
        threshold_type="streak",
        threshold_value=5,
    ),
    AchievementRule(
        key="streak_14",
        title="Two Weeks",
        description="Maintain a 14-day streak",
        threshold_type="streak",
        threshold_value=14,
    ),
    AchievementRule(
        key="streak_30",
        title="Unstoppable",
        description="Maintain a 30-day streak",
        threshold_type="streak",
        threshold_value=30,
    ),
    AchievementRule(
        key="streak_100",
        title="Century",
        description="Maintain a 100-day streak",
        threshold_type="streak",
        threshold_value=100,
    ),
    AchievementRule(
        key="streak_365",
        title="Year of Yap",
        description="Practice every day for a year",
        threshold_type="streak",
        threshold_value=365,
    ),
    AchievementRule(
        key="session_50",
        title="Half Century",
        description="Complete 50 Echo + Chat sessions",
        threshold_type="sessions",
        threshold_value=50,
    ),
    AchievementRule(
        key="session_200",
        title="Dedicated",
        description="Complete 200 Echo + Chat sessions",
        threshold_type="sessions",
        threshold_value=200,
    ),
    AchievementRule(
        key="session_500",
        title="Practice Legend",
        description="Complete 500 Echo + Chat sessions",
        threshold_type="sessions",
        threshold_value=500,
    ),
    AchievementRule(
        key="alltime_legend",
        title="All-Time Legend",
        description="Reach #1 on the global leaderboard",
        threshold_type="rank",
        threshold_value=1,
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

    async def list_user_achievements(self, user: User) -> list[AchievementStatus]:
        rank_score = await self.store.leaderboard.get(user)
        is_rank_one = rank_score is not None and rank_score[0] == 1
        claims = await self.repository.achievement.list(user.id)
        sessions_count = len(await self.repository.aggregation.get_sessions_by_user(user))

        def metric_value(rule: AchievementRule) -> int:
            match rule.threshold_type:
                case "points":
                    return max(user.points, 0)
                case "streak":
                    return max(user.streak, 0)
                case "sessions":
                    return max(sessions_count, 0)
                case "rank":
                    return 1 if is_rank_one else 0

        achievements: list[AchievementStatus] = []
        for rule in ACHIEVEMENT_RULES:
            if rule.key in claims:
                claim = claims[rule.key]
                achievements.append(
                    AchievementStatus(
                        **rule.model_dump(),
                        progress=1.0,
                        claimed_at=claim.claimed_at,
                    )
                )
                continue

            value = metric_value(rule)
            progress = min(value / rule.threshold_value, 1.0) if rule.threshold_value > 0 else 1.0
            achievements.append(
                AchievementStatus(
                    **rule.model_dump(),
                    progress=progress,
                )
            )
        return achievements

    async def claim_user_achievement(self, user: User, key: str) -> AchievementStatus:
        achievements = await self.list_user_achievements(user)
        achievement = next((a for a in achievements if a.key == key), None)
        assert achievement is not None, "invalid achievement key"
        assert achievement.claimed_at is None, "achievement claimed already"
        assert achievement.progress >= 1.0, "achievement criteria not met"
        claim = await self.repository.achievement.claim(user.id, key)
        return AchievementStatus(
            **achievement.model_dump(exclude={"claimed_at"}),
            claimed_at=claim.claimed_at,
        )


__all__ = ["GameService", "LeaderboardEntry", "AchievementStatus"]
