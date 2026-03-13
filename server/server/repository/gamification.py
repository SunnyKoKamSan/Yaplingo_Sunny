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


__all__ = [
    "MasteryTier",
    "DailyProgress",
    "DailyAccuracy",
    "LeaderboardEntry",
    "UserGamification",
    "XPMultiplierEvent",
    "TopicMastery",
]
