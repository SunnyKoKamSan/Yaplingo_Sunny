from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from ulid import ULID

from server.repository.models import Language


class UserCreation(BaseModel):
    name: str = Field(min_length=2, max_length=32, pattern=r"^[a-z0-9._]+$")
    password: str = Field(min_length=8, max_length=128)
    language: Language


class UserResponse(BaseModel):
    id: ULID
    name: str
    language: Language


class UserCredentials(BaseModel):
    name: str
    password: str


class CheckInRequest(BaseModel):
    xp_amount: int = Field(gt=0)
    topic: str | None = Field(default=None)
    accuracy_percentage: int | None = Field(default=None, ge=0, le=100)
    completion_time_ms: int | None = Field(default=None, ge=0)


class CheckInResponse(BaseModel):
    user_id: ULID
    date_key: str
    xp_earned: int
    goal_met: bool
    lessons_completed: int
    high_accuracy_hits: int
    new_streak: int
    bonus_xp: int = Field(default=0)
    multiplier_active: bool = Field(default=False)
    event_name: str | None = Field(default=None)
    gems_earned: int = Field(default=0)
    newly_unlocked: list[str] = Field(default_factory=list)
    
    class Config:
        from_attributes = True


class LeaderboardItem(BaseModel):
    rank: int
    name: str
    total_xp: int
    user_id: ULID


class MyRankResponse(BaseModel):
    rank: int
    total_xp: int
    current_streak: int = 0
    period_key: str
    is_current_period: bool = True


class ActiveEventResponse(BaseModel):
    id: int
    name: str
    description: str
    multiplier: float
    starts_at: datetime
    ends_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TopicMasteryResponse(BaseModel):
    topic: str
    total_xp: int
    lesson_count: int
    avg_accuracy: float
    avg_speed_ms: float
    mastery_score: float
    tier: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GemTransactionResponse(BaseModel):
    id: int
    amount: int
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GemBalanceResponse(BaseModel):
    balance: int
    transactions: list[GemTransactionResponse] = Field(default_factory=list)


class SpendGemsRequest(BaseModel):
    item_key: str


class SpendGemsResponse(BaseModel):
    new_balance: int
    item_key: str


class ClaimAchievementRequest(BaseModel):
    achievement_key: str


class ClaimAchievementResponse(BaseModel):
    achievement_key: str
    gems_awarded: int
    new_balance: int


class UserInventoryResponse(BaseModel):
    streak_freezes: int = 0

    model_config = ConfigDict(from_attributes=True)


class AchievementResponse(BaseModel):
    key: str
    title: str
    desc: str
    unlocked: bool
    unlocked_at: datetime | None = None
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    gem_reward: int = 15
    ultimate: bool = False


class ProximityNeighbour(BaseModel):
    user_id: str
    name: str
    total_xp: int
    rank: int
    xp_gap: int


class ProximityResponse(BaseModel):
    above: list[ProximityNeighbour]
    below: list[ProximityNeighbour]
    my_xp: int
    my_rank: int
