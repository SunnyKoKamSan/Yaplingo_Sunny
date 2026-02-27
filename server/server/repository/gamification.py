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


# ── Gem Economy ───────────────────────────────────────────────────────────────

GEM_EARN_RATES: dict[str, int] = {
    "daily_goal_met":       10,
    "achievement_unlocked": 15,
    "streak_7":             25,
    "streak_30":            75,
    "mastery_tier_upgrade": 20,
}

GEM_SPEND_RATES: dict[str, int] = {
    "streak_freeze":      50,
    "extra_attempts":     40,
    "hint_pack":          75,
    "xp_boost_1h":       100,
    "avatar_decoration": 150,
    "premium_scenario":  200,
}

# ── Achievement Definitions ───────────────────────────────────────────────────

ACHIEVEMENTS: dict[str, dict] = {
    # XP milestones
    "first_step":     {"title": "First Step",     "desc": "Earn your first 10 XP",
                       "threshold": 10,            "threshold_type": "lifetime_xp"},
    "bronze_mic":     {"title": "Bronze Mic",     "desc": "Earn 500 XP lifetime",
                       "threshold": 500,           "threshold_type": "lifetime_xp"},
    "silver_mic":     {"title": "Silver Mic",     "desc": "Earn 2,000 XP lifetime",
                       "threshold": 2000,          "threshold_type": "lifetime_xp"},
    "gold_mic":       {"title": "Gold Mic",       "desc": "Earn 10,000 XP lifetime",
                       "threshold": 10000,         "threshold_type": "lifetime_xp"},
    "platinum_mic":   {"title": "Platinum Mic",   "desc": "Earn 50,000 XP lifetime",
                       "threshold": 50000,         "threshold_type": "lifetime_xp"},
    "diamond_mic":    {"title": "Diamond Mic",    "desc": "Earn 100,000 XP lifetime",
                       "threshold": 100000,        "threshold_type": "lifetime_xp"},
    # Streak milestones
    "streak_5":       {"title": "On Fire",        "desc": "Maintain a 5-day streak",
                       "threshold": 5,             "threshold_type": "streak"},
    "streak_14":      {"title": "Two Weeks",      "desc": "Maintain a 14-day streak",
                       "threshold": 14,            "threshold_type": "streak"},
    "streak_30":      {"title": "Unstoppable",    "desc": "Maintain a 30-day streak",
                       "threshold": 30,            "threshold_type": "streak"},
    "streak_100":     {"title": "Century",        "desc": "Maintain a 100-day streak",
                       "threshold": 100,           "threshold_type": "streak"},
    "streak_365":     {"title": "Year of Yap",    "desc": "Practice every day for a year",
                       "threshold": 365,           "threshold_type": "streak"},
    # Lesson milestones
    "lesson_50":      {"title": "Half Century",   "desc": "Complete 50 practice sessions",
                       "threshold": 50,            "threshold_type": "lifetime_lessons"},
    "lesson_200":     {"title": "Dedicated",      "desc": "Complete 200 practice sessions",
                       "threshold": 200,           "threshold_type": "lifetime_lessons"},
    "lesson_500":     {"title": "Lesson Legend",  "desc": "Complete 500 practice sessions",
                       "threshold": 500,           "threshold_type": "lifetime_lessons"},
    # Mastery tier achievements
    "diamond_food":     {"title": "Food Master",      "desc": "Reach Diamond in Food",
                         "threshold": "Diamond",       "threshold_type": "mastery_tier",
                         "topic": "Food"},
    "diamond_culture":  {"title": "Culture Expert",   "desc": "Reach Diamond in Culture",
                         "threshold": "Diamond",       "threshold_type": "mastery_tier",
                         "topic": "Culture"},
    "diamond_travel":   {"title": "Globe Trotter",    "desc": "Reach Diamond in Travel",
                         "threshold": "Diamond",       "threshold_type": "mastery_tier",
                         "topic": "Travel"},
    "diamond_business": {"title": "Business Pro",     "desc": "Reach Diamond in Business",
                         "threshold": "Diamond",       "threshold_type": "mastery_tier",
                         "topic": "Business"},
}


class DailyProgress(SQLModel, table=True):
    """Tracks daily user progress and goals."""
    
    __tablename__ = "daily_progress"
    
    # Composite Primary Key
    user_id: ULID = Field(
        foreign_key="user.id",
        primary_key=True,
        sa_type=ULIDType
    )
    date_key: str = Field(
        primary_key=True,
        max_length=10,
        description="Date in 'YYYY-MM-DD' format"
    )
    
    # Data Fields
    xp_earned: int = Field(default=0, ge=0)
    goal_met: bool = Field(default=False)
    lessons_completed: int = Field(default=0, ge=0)


class DailyAccuracy(SQLModel, table=True):
    """Tracks how many times user achieved >=80% accuracy in a UTC day."""

    __tablename__ = "daily_accuracy"

    user_id: ULID = Field(
        foreign_key="user.id",
        primary_key=True,
        sa_type=ULIDType,
    )
    date_key: str = Field(
        primary_key=True,
        max_length=10,
        description="Date in 'YYYY-MM-DD' format",
    )
    high_accuracy_hits: int = Field(default=0, ge=0)


class LeaderboardEntry(SQLModel, table=True):
    """Tracks user rankings per period for leaderboard display."""
    
    __tablename__ = "leaderboard_entry"
    __table_args__ = (
        Index("ix_leaderboard_period_xp", "period_key", "total_xp"),
    )
    
    # Composite Primary Key
    user_id: ULID = Field(
        foreign_key="user.id",
        primary_key=True,
        sa_type=ULIDType
    )
    period_key: str = Field(
        primary_key=True,
        max_length=50,
        description="Period identifier (e.g., 'WEEK-2024-10', 'WEEK-2024-10::Food')"
    )
    
    # Data Fields
    total_xp: int = Field(default=0, ge=0, index=True)

    # Relationships
    user: Optional["User"] = Relationship(back_populates="leaderboard_entries")


class UserGamification(SQLModel, table=True):
    """Stores user streak and gamification profile."""
    
    __tablename__ = "user_gamification"
    
    # Primary Key (also Foreign Key)
    user_id: ULID = Field(
        foreign_key="user.id",
        primary_key=True,
        sa_type=ULIDType
    )
    
    # Streak Data
    current_streak: int = Field(default=0, ge=0)
    last_activity_date: Optional[str] = Field(
        default=None,
        max_length=10,
        description="Last activity date in 'YYYY-MM-DD' format"
    )


class XPMultiplierEvent(SQLModel, table=True):
    """Defines time-limited XP multiplier events (e.g. Double XP Weekend)."""

    __tablename__ = "xp_multiplier_event"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100)
    description: str = Field(default="", max_length=255)
    multiplier: float = Field(ge=1.0, le=10.0)
    starts_at: datetime = Field(index=True)
    ends_at: datetime = Field(index=True)
    is_active: bool = Field(default=True)


class TopicMastery(SQLModel, table=True):
    """Stores running mastery averages per (user, topic)."""

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
    """Tracks a user's persistent gem currency balance."""

    __tablename__ = "gem_balance"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    balance: int = Field(default=0, ge=0)


class GemTransaction(SQLModel, table=True):
    """Immutable ledger of gem earn/spend events."""

    __tablename__ = "gem_transaction"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: ULID = Field(foreign_key="user.id", index=True, sa_type=ULIDType)
    amount: int  # positive = earn, negative = spend
    reason: str = Field(max_length=100)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserAchievement(SQLModel, table=True):
    """Records which achievements a user has unlocked."""

    __tablename__ = "user_achievement"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    achievement_key: str = Field(primary_key=True, max_length=50)
    unlocked_at: datetime = Field(default_factory=datetime.utcnow)


class UserInventory(SQLModel, table=True):
    """Tracks purchased items from the gem shop."""

    __tablename__ = "user_inventory"

    user_id: ULID = Field(foreign_key="user.id", primary_key=True, sa_type=ULIDType)
    streak_freezes: int = Field(default=0, ge=0)
    extra_attempts: int = Field(default=0, ge=0)
    hint_packs: int = Field(default=0, ge=0)
    has_avatar_decoration: bool = Field(default=False)
    premium_scenarios: int = Field(default=0, ge=0)
