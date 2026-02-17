from typing import TYPE_CHECKING, Optional

from sqlalchemy import Index
from sqlmodel import Field, Relationship, SQLModel
from ulid import ULID

from .models import ULIDType

if TYPE_CHECKING:
    from .models import User


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
