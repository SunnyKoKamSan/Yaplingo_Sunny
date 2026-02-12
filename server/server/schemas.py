from pydantic import BaseModel, Field
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


# Gamification Schemas
class CheckInRequest(BaseModel):
    xp_amount: int = Field(gt=0, description="XP amount earned (must be positive)")
    topic: str | None = Field(default=None, description="Topic category (e.g. Food, Culture, Travel, Business, Technology). None = Global only.")


class CheckInResponse(BaseModel):
    user_id: ULID
    date_key: str
    xp_earned: int
    goal_met: bool
    lessons_completed: int
    new_streak: int
    
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
    period_key: str
    is_current_period: bool = True
