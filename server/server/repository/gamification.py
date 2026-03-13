from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Index
from sqlmodel import Field, Relationship, SQLModel
from ulid import ULID

from .models import ULIDType

if TYPE_CHECKING:
    from .models import User


class MasteryTier(str, Enum):
    BRONZE = "Bronze"
    SILVER = "Silver"
    GOLD = "Gold"
    PLATINUM = "Platinum"
    DIAMOND = "Diamond"


GEM_EARN_RATES: dict[str, int] = {
    "daily_goal_met": 10,
    "streak_5": 10,
    "streak_7": 25,
    "streak_30": 75,
    "mastery_tier_upgrade": 20,
}

GEM_SPEND_RATES: dict[str, int] = {
    "streak_freeze": 50,
    "xp_boost_1h": 100,
    "xp_boost_30m_30x": 500,
    "buy_xp_500": 50,
}

ACHIEVEMENTS: dict[str, dict] = {
    # XP milestones
    "first_step": {"title": "First Step", "desc": "Earn your first 10 XP", "threshold": 10, "threshold_type": "lifetime_xp", "gem_reward": 5},
    "bronze_mic": {"title": "Bronze Mic", "desc": "Earn 500 XP lifetime", "threshold": 500, "threshold_type": "lifetime_xp", "gem_reward": 10},
    "silver_mic": {"title": "Silver Mic", "desc": "Earn 2,000 XP lifetime", "threshold": 2000, "threshold_type": "lifetime_xp", "gem_reward": 20},
    "gold_mic": {"title": "Gold Mic", "desc": "Earn 10,000 XP lifetime", "threshold": 10000, "threshold_type": "lifetime_xp", "gem_reward": 40},
    "platinum_mic": {"title": "Platinum Mic", "desc": "Earn 50,000 XP lifetime", "threshold": 50000, "threshold_type": "lifetime_xp", "gem_reward": 75},
    "diamond_mic": {"title": "Diamond Mic", "desc": "Earn 100,000 XP lifetime", "threshold": 100000, "threshold_type": "lifetime_xp", "gem_reward": 150},
    # Streak milestones
    "streak_5": {"title": "On Fire", "desc": "Maintain a 5-day streak", "threshold": 5, "threshold_type": "streak", "gem_reward": 10},
    "streak_14": {"title": "Two Weeks", "desc": "Maintain a 14-day streak", "threshold": 14, "threshold_type": "streak", "gem_reward": 20},
    "streak_30": {"title": "Unstoppable", "desc": "Maintain a 30-day streak", "threshold": 30, "threshold_type": "streak", "gem_reward": 50},
    "streak_100": {"title": "Century", "desc": "Maintain a 100-day streak", "threshold": 100, "threshold_type": "streak", "gem_reward": 100},
    "streak_365": {"title": "Year of Yap", "desc": "Practice every day for a year", "threshold": 365, "threshold_type": "streak", "gem_reward": 500},
    # Lesson milestones
    "lesson_50": {"title": "Half Century", "desc": "Complete 50 practice sessions", "threshold": 50, "threshold_type": "lifetime_lessons", "gem_reward": 15},
    "lesson_200": {"title": "Dedicated", "desc": "Complete 200 practice sessions", "threshold": 200, "threshold_type": "lifetime_lessons", "gem_reward": 30},
    "lesson_500": {"title": "Lesson Legend", "desc": "Complete 500 practice sessions", "threshold": 500, "threshold_type": "lifetime_lessons", "gem_reward": 75},
    # Mastery tier achievements
    "diamond_food": {"title": "Food Master", "desc": "Reach Diamond in Food", "threshold": "Diamond", "threshold_type": "mastery_tier", "topic": "Food", "gem_reward": 50},
    "diamond_culture": {"title": "Culture Expert", "desc": "Reach Diamond in Culture", "threshold": "Diamond", "threshold_type": "mastery_tier", "topic": "Culture", "gem_reward": 50},
    "diamond_travel": {"title": "Globe Trotter", "desc": "Reach Diamond in Travel", "threshold": "Diamond", "threshold_type": "mastery_tier", "topic": "Travel", "gem_reward": 50},
    "diamond_business": {"title": "Business Pro", "desc": "Reach Diamond in Business", "threshold": "Diamond", "threshold_type": "mastery_tier", "topic": "Business", "gem_reward": 50},
    "diamond_tech": {"title": "Tech Guru", "desc": "Reach Diamond in Technology", "threshold": "Diamond", "threshold_type": "mastery_tier", "topic": "Technology", "gem_reward": 50},
    # Leaderboard achievements
    "weekly_champ": {"title": "Weekly Champion", "desc": "Finish #1 on the weekly leaderboard", "threshold": 1, "threshold_type": "weekly_rank", "gem_reward": 100},
    "alltime_legend": {"title": "All-Time Legend", "desc": "Reach #1 on the all-time leaderboard", "threshold": 1, "threshold_type": "alltime_rank", "gem_reward": 1000, "ultimate": True},
}


class DailyProgress(SQLModel, table=True):
    __tablename__ = "daily_progress"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    date_key: str = Field(primary_key=True, max_length=10)

    xp_earned: int = Field(default=0, ge=0)
    goal_met: bool = Field(default=False)
    lessons_completed: int = Field(default=0, ge=0)


class DailyAccuracy(SQLModel, table=True):
    __tablename__ = "daily_accuracy"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    date_key: str = Field(primary_key=True, max_length=10)
    high_accuracy_hits: int = Field(default=0, ge=0)


class LeaderboardEntry(SQLModel, table=True):
    __tablename__ = "leaderboard_entry"
    __table_args__ = (
        Index("ix_leaderboard_period_xp", "period_key", "total_xp"),
    )

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    period_key: str = Field(primary_key=True, max_length=50)
    total_xp: int = Field(default=0, ge=0, index=True)

    user: Optional["User"] = Relationship(back_populates="leaderboard_entries")


class UserGamification(SQLModel, table=True):
    __tablename__ = "user_gamification"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    current_streak: int = Field(default=0, ge=0)
    last_activity_date: Optional[str] = Field(default=None, max_length=10)


class XPMultiplierEvent(SQLModel, table=True):
    __tablename__ = "xp_multiplier_event"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    description: str = Field(default="", max_length=255)
    multiplier: float = Field(ge=1.0, le=50.0)
    starts_at: datetime = Field(index=True)
    ends_at: datetime = Field(index=True)
    is_active: bool = Field(default=True)


class TopicMastery(SQLModel, table=True):
    __tablename__ = "topic_mastery"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    topic: str = Field(primary_key=True, max_length=50)

    total_xp: int = Field(default=0, ge=0)
    lesson_count: int = Field(default=0, ge=0)
    avg_accuracy: float = Field(default=0.0)
    avg_speed_ms: float = Field(default=0.0)

    mastery_score: float = Field(default=0.0)
    tier: MasteryTier = Field(default=MasteryTier.BRONZE)

    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GemBalance(SQLModel, table=True):
    __tablename__ = "gem_balance"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    balance: int = Field(default=0, ge=0)


class GemTransaction(SQLModel, table=True):
    __tablename__ = "gem_transaction"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: ULID = Field(foreign_key="user.id", index=True, sa_type=ULIDType)
    amount: int
    reason: str = Field(max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserAchievement(SQLModel, table=True):
    __tablename__ = "user_achievement"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    achievement_key: str = Field(primary_key=True, max_length=50)
    unlocked_at: datetime = Field(default_factory=datetime.utcnow)


class UserInventory(SQLModel, table=True):
    __tablename__ = "user_inventory"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    streak_freezes: int = Field(default=0, ge=0)


__all__ = [
    "MasteryTier",
    "GEM_EARN_RATES",
    "GEM_SPEND_RATES",
    "ACHIEVEMENTS",
    "DailyProgress",
    "DailyAccuracy",
    "LeaderboardEntry",
    "UserGamification",
    "XPMultiplierEvent",
    "TopicMastery",
    "GemBalance",
    "GemTransaction",
    "UserAchievement",
    "UserInventory",
]
