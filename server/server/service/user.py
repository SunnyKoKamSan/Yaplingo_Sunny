from collections import Counter
from datetime import date, datetime, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from pydantic import BaseModel, Field
from pydantic_extra_types.language_code import LanguageAlpha2
from pydantic_extra_types.timezone_name import TimeZoneName
from ulid import ULID

from server.repository import Repository
from server.repository.entities import User
from server.store import Store


class UserCredentials(BaseModel):
    name: str
    password: str


class UserCreation(BaseModel):
    name: Annotated[str, Field(min_length=2, max_length=32, pattern=r"^[a-z0-9._]+$")]
    password: Annotated[str, Field(min_length=8, max_length=128)]
    language: Annotated[LanguageAlpha2, Field(default=LanguageAlpha2("en"))]
    timezone: Annotated[TimeZoneName, Field(default=TimeZoneName("UTC"))]


class UserService:
    hasher = PasswordHasher()

    def __init__(self, store: Store, repository: Repository):
        self.store = store
        self.repository = repository

    async def verify(self, credentials: UserCredentials) -> User | None:
        if (user := await self.repository.user.get(credentials.name)) is not None:
            try:
                self.hasher.verify(user.password, credentials.password)
            except VerifyMismatchError:
                return None
            return user

    async def create(self, creation: UserCreation) -> User:
        password = self.hasher.hash(creation.password)
        user = User(**creation.model_dump(exclude={"password"}), password=password)
        return await self.repository.user.dump(user)

    async def get(self, id: ULID) -> User | None:
        user = await self.repository.user.get(id)
        # reset streak if over 1 day gap since last streak
        if user is not None and user.streak > 0:
            today = datetime.now(ZoneInfo("UTC")).date()
            if today - user.streaked_at.date() >= timedelta(days=1):
                await self.repository.user.reset_streak(user)
        return user

    async def get_year_activity(self, user: User) -> dict[date, int]:
        tz = ZoneInfo(user.timezone)
        year = datetime.now(tz).year
        start = datetime(year, 1, 1, tzinfo=tz)
        end = datetime(year + 1, 1, 1, tzinfo=tz)
        sessions = await self.repository.user.get_sessions(user, start=start, end=end)
        return Counter([s.completed_at.astimezone(tz).date() for s in sessions])

    async def get_total_points(self, user: User) -> int:
        sessions = await self.repository.user.get_sessions(user)
        return sum(s.points for s in sessions)

    async def get_today_points(self, user: User) -> int:
        points_today = await self.store.points.get_today(user)
        if points_today is None:
            start = datetime.now(ZoneInfo(user.timezone)).replace(hour=0, minute=0, second=0, microsecond=0)
            sessions = await self.repository.user.get_sessions(user, start=start)
            points_today = sum(s.points for s in sessions)
            return await self.store.points.add_today(user, points_today)
        return points_today

    async def add_points_with_streak(self, user: User, points_to_add: int) -> None:
        assert points_to_add >= 0, "points to add must be non-negative"
        points_today = await self.store.points.add_today(user, points_to_add)
        if points_today >= user.streak_milestone and not user.streak_claimed_today:
            await self.repository.user.increment_streak(user)


__all__ = ["UserService", "UserCredentials", "UserCreation"]
