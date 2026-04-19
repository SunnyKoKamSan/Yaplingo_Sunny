from datetime import date

from pydantic import BaseModel
from pydantic_extra_types.language_code import LanguageAlpha2
from pydantic_extra_types.timezone_name import TimeZoneName
from ulid import ULID

from server.service.user import UserCreation, UserCredentials, UserInsightsWithSummary, UserStatistics


class UserCreationInput(UserCreation): ...


class UserCredentialsInput(UserCredentials): ...


class UserResponse(BaseModel):
    class Points(BaseModel):
        today: int
        total: int
        milestone: int

    class Boost(BaseModel):
        multiplier: int
        expiry: int

    id: ULID
    name: str
    language: LanguageAlpha2
    timezone: TimeZoneName
    streak: int
    streak_freezes: int
    gems: int
    points: Points
    boost: Boost | None
    activity: dict[date, int]


class UserInsightsResponse(UserInsightsWithSummary): ...


class UserStatisticsResponse(UserStatistics): ...


__all__ = [
    "UserResponse",
    "UserCreationInput",
    "UserCredentialsInput",
    "UserInsightsResponse",
    "UserStatisticsResponse",
]
