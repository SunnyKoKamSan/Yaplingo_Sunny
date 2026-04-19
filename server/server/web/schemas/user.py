from datetime import date

from pydantic import BaseModel
from pydantic_extra_types.language_code import LanguageAlpha2
from pydantic_extra_types.timezone_name import TimeZoneName
from ulid import ULID

from server.service.user import UserCreation, UserCredentials, UserInsightsWithSummary


class UserCreationInput(UserCreation): ...


class UserCredentialsInput(UserCredentials): ...


class UserResponse(BaseModel):
    id: ULID
    name: str
    language: LanguageAlpha2
    timezone: TimeZoneName
    streak: int
    gems: int
    milestone: int
    points: tuple[int, int]  # (today, total)
    activity: dict[date, int]


class UserInsightsResponse(UserInsightsWithSummary): ...


__all__ = ["UserResponse", "UserCreationInput", "UserCredentialsInput", "UserInsightsResponse"]
